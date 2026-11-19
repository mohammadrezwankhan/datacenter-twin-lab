# Documentation maintenance runbook

The Markdown files are the reference source; `docs/reference/index.html` is a generated reading view. Existing tutorials, contracts, historical release packets and native lesson material remain canonical for their own scopes. Start at [INDEX.md](../INDEX.md) before adding a second explanation of the same behavior.

## When a source change needs documentation work

| Change | Update together | Evidence to retain |
| --- | --- | --- |
| Contract/CLI/HTTP/worker change | Interface guide, setup, relevant existing contract and error examples | Exact source pin, parser/route/argument declarations and focused compatibility checks |
| Equation, unit, sign, default or solver change | All three science chapters, worked example and affected lesson/source notes | Independent arithmetic or appropriate convergence/residual comparison, not only a changed snapshot |
| Dependency/toolchain change | Matrix, setup and existing dependency guide | Manifest/lock checks plus installed-version and platform/runtime results |
| Course/catalog change | Course registry, discovery material and documentation counts | Registry `--check`, unique IDs/sequence and working reading/runtime routes |
| Release/publication change | Changelog/CFF only when historically justified; release playbook and recovery | Actual tag/artifact/merge/deployment identity and dated provider receipt |
| New evidence or repaired failure | Verification ledger and affected roadmap item | Original and new results with different timestamps/revisions kept distinct |

[scripts/sync_course_registry.mjs](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/sync_course_registry.mjs), [scripts/check_dependency_versions.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/check_dependency_versions.py), [docs/validation/evidence-method.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/validation/evidence-method.md), [CITATION.cff](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/CITATION.cff).

## Update the handbook deliberately

The chapter manifest lists the 24 required canonical paths and their reading order. The renderer uses Pandoc GFM/MathML, namespaces chapter anchors and rewrites source links. Local images within the published docs tree retain their relative image route; remote/unpublished images become readable source links/text. An already-linked image must not produce nested anchors. This preserves a restrictive content policy without adding remote image hosts or application dependencies.

```sh
python docs/reference/build_reference.py
python docs/reference/build_reference.py --check
```

Check the generated file together with its inputs, manifest, CSS and renderer. Keep the new companion reference link outside its existing hashed inline script/style blocks; changing executable bytes would require an independently reviewed CSP/build change. The renderer does not execute the scientific examples or verify a live site.

## Review and validation sequence

1. Record the exact source revision/tree and complete file inventory. Inventory binary/vendor/generated items honestly; indexing is not semantic review or execution.
2. Review affected implementations and public boundaries. Keep immutable source citations and claim types: implemented behavior, declared configuration, observed execution, inference or proposal.
3. Update relevant canonical docs and regenerate HTML. Check new relative links/anchors, tables, code fences, MathML, navigation, input hashes and source-locator ranges.
4. Validate CFF against its declared schema while preserving known author/release/license facts. A schema pass does not attest an invented DOI, author or release.
5. Run only applicable meaningful commands in an isolated environment. Record source/candidate identity, command, versions, exit, log digest, timestamp and limits. Preserve skips and failed diagnostics.
6. Review the entire diff and protected bytes/modes. Obtain independent QA bound to the frozen candidate. Keep any prior candidate and review as history before repair.
7. After integration, verify the actual existing publishing route and distinctive changed content. Record merge/publication separately and refresh the dated ledger in a later change if appropriate.

The author handoff contains six schema-validated reports and exact tree/diff manifests; independent QA is a seventh, separate report. External run records can contain final candidate/merge hashes without forcing self-referential content into the commit itself.

## Preserve historical evidence and limits

Do not overwrite release evidence under `data/evidence/` to make a current run pass. Create a fresh directory below `outputs/`, retain its manifest digest separately, and verify reproduction. Do not relabel a screenshot, parser result, old CI check or source-only review as current browser/candidate/deployment verification. The roadmap is rolling planning: preserve stable IDs and close items with measurable evidence rather than deleting their history. [Evidence ledger](VERIFICATION_EVIDENCE_LEDGER.md), [roadmap](../../ROADMAP.md#rolling-plan-19-november-2026-to-18-november-2027).
