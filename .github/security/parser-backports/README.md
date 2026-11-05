# Stable OpenGrep PEP 695 parser backport

This package applies a custom Python-only parser backport to the exact official
OpenGrep 1.33.1 source, commit `092c80faa0817840228349f93eff12a50fb9cf6b`.
It is a modified build of that release, not an unchanged upstream distribution.

The combined patch contains the five production changes from merged upstream
PR #845 (simple aliases) followed by the previously reviewed authored Menhir
type-parameter adaptation. The union is six production files: AST, generic
conversion, grammar, soft-keyword rewriting, token visitor and the Tree-sitter
constructor arity bridge. The original stable Python string decoding, decorator
conversion, exception grammar, parser ordering and Tree-sitter grammar asset
remain unchanged. No TypeScript, JavaScript, CLI, package or compiler change is
part of this parser package. The existing Python CLI and stable core stay paired.

The adaptation preserves alias expression trees, bounded declaration parameters,
ordinary parameters/defaults and bodies. It distinguishes TypeVarTuple and
ParamSpec. It does not add PEP 696 type-parameter defaults or claim complete
Python 3.13/3.14 language support. Existing LGPL-2.1 headers and full upstream
license are retained; the AST qualification overlay is LGPL-2.1-only.

## Evidence and required qualification

The patch was applied in an isolated exact-stable copy, checked before and after
against all six hashes, and compared byte-for-byte with the two original patch
stages. The existing stable generic AST APIs and Dune libraries used by the
overlay are present. These are source/applicability checks, not a native compile.

All 19 declaration checks and their expected native findings are unchanged.
Twenty-six fixture source strings are exact preserved bytes; the actual restored
reproduce_demand_timing.py differs only by its retained review comment and has an
identical CPython AST. The three upstream match/guard/as-pattern fixtures
are byte-identical in this stable source. Metadata now identifies the stable
source. Both the historical oracle and a fresh 27-case CPython 3.12 syntax oracle
are included. The five repository fixtures bind the actual restored files at
the timestamp in repository-fixture-binding.json. Recheck those hashes against
the final candidate before publication.

Before accepting or caching a build, compile the AST overlay in the SAME frozen
opam switch as the patched stable core and run every fixture. Then exercise the
actual pinned Python CLI with that core: require all 27 parser fixtures, all
13 exact expected findings, the safe-line controls, strict malformed-source
rejection, invalid-rule rejection and the existing CLI/target inventory controls.
Python CLI error JSON must be qualified directly; do not assume the unreleased
full-native CLI schema or `show dump-config` subcommand. Finally run the full
repository scanner, all registered/local rules, strict errors, source binding,
advisory audit, numerical, lint/type and browser gates on the exact new head.
No native build, native AST execution, patched scanner execution or hosted run
has been performed by this package-preparation review.
