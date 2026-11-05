(* Rezwan scanner qualification controls, SPDX-License-Identifier: LGPL-2.1-only.
 * These checks use the actual Python frontend and generic AST in the frozen
 * native build. A parser exception or error statistic fails every valid case;
 * invalid cases must be rejected. No application source is rewritten. *)

module G = AST_generic
module J = Yojson.Basic.Util

let fail context message = failwith (context ^ ": " ^ message)
let member = J.member
let string key value = member key value |> J.to_string
let list key value = member key value |> J.to_list
let strings value = value |> J.to_list |> List.map J.to_string
let json_string s = `String s
let json_list xs = `List xs
let tagged tag xs = `List (`String tag :: xs)

let assert_json context expected actual =
  if not (Yojson.Basic.equal expected actual) then
    fail context
      (Printf.sprintf "expected %s, got %s"
         (Yojson.Basic.to_string expected)
         (Yojson.Basic.to_string actual))

(* This deliberately recognizes only the expression shapes used by the
 * preservation controls. An unexpected shape fails instead of being omitted. *)
let rec expression (e : G.expr) =
  match e.e with
  | G.N (G.Id ((name, _), _)) -> tagged "name" [ json_string name ]
  | G.ArrayAccess (base, (_, index, _)) ->
      tagged "subscript" [ expression base; expression index ]
  | G.Container (G.Tuple, (_, values, _)) ->
      tagged "tuple" (List.map expression values)
  | G.OtherExpr (("Slices", _), values) ->
      tagged "slices"
        (List.map
           (function
             | G.E value -> expression value
             | _ -> fail "expression" "non-expression in Python slices")
           values)
  | G.Call ({ e = G.IdSpecial (G.Op G.BitOr, _); _ }, (_, args, _)) ->
      tagged "union"
        (List.map
           (function
             | G.Arg value -> expression value
             | _ -> fail "expression" "non-expression union argument")
           args)
  | G.Call (callee, (_, args, _)) ->
      tagged "call"
        (expression callee
        :: List.map
             (function
               | G.Arg value -> expression value
               | _ -> fail "expression" "non-expression call argument")
             args)
  | G.L (G.Int value) -> (
      match Parsed_int.to_int_opt value with
      | Some value -> tagged "int" [ `Int value ]
      | None -> fail "expression" "unrepresentable integer in control")
  | G.L (G.String (_, (value, _), _)) -> tagged "string" [ `String value ]
  | G.L (G.Null _) -> tagged "none" []
  | _ -> fail "expression" "unrecognized preserved expression shape"

let type_expression (value : G.type_) =
  match value.t with
  | G.TyExpr value -> expression value
  | _ -> fail "type" "expected the existing Python TyExpr representation"

let optional_type = function
  | None -> `Null
  | Some value -> type_expression value

let optional_expression = function
  | None -> `Null
  | Some value -> expression value

let names any =
  let found = ref [] in
  let visitor =
    object
      inherit [_] G.iter_no_id_info
      method! visit_ident _env (name, _) = found := name :: !found
    end
  in
  visitor#visit_any () any;
  List.rev !found

let require_names context expected actual =
  List.iter
    (fun name ->
      if not (List.mem name actual) then
        fail context ("missing AST identifier " ^ name))
    expected

let declaration_name (entity : G.entity) =
  match entity.name with
  | G.EN (G.Id ((name, _), _)) -> name
  | _ -> fail "declaration" "expected a simple Python declaration name"

let type_parameters (entity : G.entity) =
  match entity.tparams with
  | None -> `Null
  | Some (_, parameters, _) ->
      json_list
        (List.map
           (function
             | G.TP parameter ->
                 `Assoc
                   [
                     ("name", json_string (fst parameter.tp_id));
                     ( "bounds",
                       json_list (List.map type_expression parameter.tp_bounds) );
                   ]
             | G.OtherTypeParam ((kind, _), [ G.I (name, _) ]) ->
                 `Assoc [ ("kind", json_string kind); ("name", json_string name) ]
             | _ -> fail "type_parameters" "unexpected or missing parameter")
           parameters)

let parameter = function
  | G.Param parameter ->
      let name =
        match parameter.pname with
        | Some (name, _) -> name
        | None -> fail "parameter" "missing ordinary parameter name"
      in
      `Assoc
        [
          ("name", json_string name);
          ("annotation", optional_type parameter.ptype);
          ("default", optional_expression parameter.pdefault);
        ]
  | _ -> fail "parameter" "unexpected ordinary parameter kind"

let declarations program =
  let found = ref [] in
  let visitor =
    object
      inherit [_] G.iter_no_id_info as super

      method! visit_definition env ((entity, kind) as definition) =
        (match kind with
        | G.FuncDef _
        | G.ClassDef _
        | G.TypeDef { tbody = G.AliasType _ } ->
            found := (declaration_name entity, definition) :: !found
        | _ -> ());
        super#visit_definition env definition
    end
  in
  visitor#visit_program () program;
  List.rev !found

let check_declaration context definitions check =
  let wanted = string "name" check in
  let matches = List.filter (fun (name, _) -> String.equal name wanted) definitions in
  let entity, definition =
    match matches with
    | [ (_, definition) ] -> definition
    | _ -> fail context ("declaration is missing or ambiguous: " ^ wanted)
  in
  assert_json (context ^ "/type_parameters") (member "type_parameters" check)
    (type_parameters entity);
  let decorator_names =
    entity.attrs |> List.map (fun attr -> names (G.At attr)) |> List.flatten
  in
  require_names (context ^ "/decorators")
    (member "decorator_names" check |> strings)
    decorator_names;
  match (string "kind" check, definition) with
  | "function", G.FuncDef definition ->
      let _, parameters, _ = definition.fparams in
      (match member "parameters" check with
      | `Null -> ()
      | expected ->
          assert_json (context ^ "/parameters") expected
            (json_list (List.map parameter parameters)));
      (match member "return_type" check with
      | `Null -> ()
      | expected ->
          assert_json (context ^ "/return_type") expected
            (optional_type definition.frettype));
      let body =
        match definition.fbody with
        | G.FBStmt statement -> G.S statement
        | _ -> fail context "function body is not retained as statements"
      in
      require_names (context ^ "/body")
        (member "body_names" check |> strings)
        (names body)
  | "class", G.ClassDef definition ->
      let _, fields, _ = definition.cbody in
      let body_names =
        fields |> List.map (fun (G.F statement) -> names (G.S statement))
        |> List.flatten
      in
      require_names (context ^ "/class_body")
        (member "body_names" check |> strings)
        body_names
  | "alias", G.TypeDef { tbody = G.AliasType value } ->
      assert_json (context ^ "/alias_value") (member "alias_value" check)
        (type_expression value)
  | _ -> fail context "declaration kind changed or was discarded"

let with_source source f =
  let path = Filename.temp_file "rezwan-python-control-" ".py" in
  Fun.protect
    ~finally:(fun () -> Sys.remove path)
    (fun () ->
      let channel = open_out_bin path in
      Fun.protect ~finally:(fun () -> close_out channel) (fun () ->
          output_string channel source);
      f (Fpath.v path))

let parse source =
  with_source source (fun path ->
      let result = Parse_python.parse ~parsing_mode:Parse_python.Python3 path in
      if result.stat.have_timeout then
        fail "parse" "a timeout is never an accepted syntax rejection"
      else if result.stat.error_line_count <> 0 then
        Error "parser returned syntax errors"
      else Ok result.ast)

let check_fixture fixture =
  let id = string "id" fixture in
  let result =
    try parse (string "source" fixture)
    with
    | (Parsing_error.Syntax_error _ | Parsing_error.Lexical_error _) as exn ->
        Error (Printexc.to_string exn)
  in
  match (string "expect_parse" fixture, result) with
  | "reject", Error _ ->
      `Assoc [ ("id", `String id); ("result", `String "rejected") ]
  | "reject", Ok _ -> fail id "malformed source was accepted"
  | "success", Error message -> fail id ("valid source rejected: " ^ message)
  | "success", Ok ast ->
      let program = Python_to_generic.program ast in
      if List.length program = 0 then fail id "valid source produced no AST";
      let definitions = declarations program in
      List.iter (check_declaration id definitions) (list "declarations" fixture);
      (match member "type_alias_count" fixture with
      | `Null -> ()
      | `Int expected ->
          let actual =
            List.fold_left
              (fun count (_, (_, definition)) ->
                match definition with
                | G.TypeDef { tbody = G.AliasType _ } -> count + 1
                | _ -> count)
              0 definitions
          in
          if actual <> expected then fail id "soft keyword changed alias count"
      | _ -> fail id "invalid type_alias_count control");
      `Assoc
        [
          ("id", `String id);
          ("result", `String "parsed-and-asserted");
          ("declarations_checked", `Int (List.length (list "declarations" fixture)));
        ]
  | _ -> fail id "unknown parser expectation"

let () =
  try
    if Array.length Sys.argv <> 2 then
      fail "usage" "python_parser_controls.exe <fixtures.json>";
    let document = Yojson.Basic.from_file Sys.argv.(1) in
    let fixtures = list "fixtures" document in
    if List.length fixtures = 0 then fail "controls" "empty fixture inventory";
    let results = List.map check_fixture fixtures in
    Yojson.Basic.to_channel stdout
      (`Assoc
        [
          ("status", `String "passed");
          ("frontend", `String "Parse_python.Python3 (Menhir)");
          ("fixtures", `List results);
        ]);
    output_char stdout '\n'
  with exn ->
    prerr_endline (Printexc.to_string exn);
    exit 1
