# Contributing

Datacenter Twin Lab is a deterministic, local-first simulator for synthetic electrical-continuity what-if scenarios. Contributions should make a bounded behavior easier to reproduce, inspect, teach, or review.

## Good first contributions

- Report a reproducible mismatch with the exact preset or sanitized scenario, revision, command, units, expected result, and observed result.
- Add an independently derived numerical edge case with a test and a short explanation of the equation.
- Improve a scenario page, glossary, diagram, or first-run instruction without changing model semantics.
- Correct a dated primary-source citation while preserving the source date, identifier, and uncertainty.

Browse the [scenario catalog](docs/scenarios/index.md) and [beginner contribution ideas](docs/scenarios/contribution-ideas.md) before opening a feature proposal. Keep a proposed change to one bounded subsystem and explain the user outcome in the issue or pull request.

## Before opening a pull request

Use Python 3.12 or later from the repository root:

```sh
python -m unittest discover -s tests -v
npm --prefix apps/web run build
```

For a numerical or scenario change, also run the affected preset and record the command, input hash, expected values, observed values, units, and whether the result is synthetic. A changed snapshot alone is not an independent derivation. Keep unknown costs and unavailable values explicit.

For a documentation-only change, check links, code blocks, Mermaid fences, and caveat wording. Do not include generated output files, private manuals, licensed standards text, credentials, customer traces, or internal planning/history.

## Model and scope rules

The current model covers one synthetic IT load, topology, finite stored energy, generator delay/failure, conversion losses, path limits, shared-domain events, and deterministic replay. It does not establish facility calibration, protection coordination, AC transients, cooling behavior, workload throughput, certification, uptime, or physical safety. Do not add physical-control instructions or imply that a test is an equipment validation.

New calculations need explicit units, deterministic behavior or a documented source of nondeterminism, provenance for third-party data, and at least one independently stated expected result. Keep schema-1 planning/PUE inputs separate from schema-2 electrical topology; neither model may silently infer the other.

## Pull requests

Use the pull-request template. Describe the user-visible result, files changed, checks run, assumptions, and any open limitation. Small focused changes are easier to verify. Preserve third-party notices and Apache-2.0 licensing terms.

For confidential security concerns, follow [SECURITY.md](SECURITY.md). Do not put credentials, private source material, or customer data in a public issue or pull request. For normal questions and reproducibility help, use [GitHub Discussions](https://github.com/mohammadrezwankhan/datacenter-twin-lab/discussions) when enabled or open a focused issue.
