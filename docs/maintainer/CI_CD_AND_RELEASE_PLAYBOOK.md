# CI, documentation publication and release playbook

This is a description of source `d8dc3773830a397409a7a9c00a6ffed33c46fb4b` and the dated metadata in [the evidence ledger](VERIFICATION_EVIDENCE_LEDGER.md). Current required checks and review policy must be discovered from the actual PR/effective rules before integration. Workflow source alone does not reveal every merge requirement.

## Configured providers and jobs

The complete tracked tree contains seven GitHub Actions workflow files. No CircleCI or Buildkite pipeline is configured in this source snapshot; their absence here is a repository-tree observation, not an assertion about inaccessible organization infrastructure.

| Workflow | Trigger / job role | Publication boundary |
| --- | --- | --- |
| `tests.yml` | Main pushes, PR/merge-group/manual events; Python platform matrix, browser/Python parity, packaging/evidence and reader checks | Existing guarded `Publish static demo` job follows the validated main route |
| `hardened-ci.yml` | Main/PR/merge-group/manual and weekly schedule; five security modes and seven language-quality modes | Preserves scanner diagnostics/artifacts; no site deployment |
| `codeql.yml` | Main and named hardening branch, PR/merge-group/manual and weekly schedule | Python and JavaScript/TypeScript analysis plus SARIF gate |
| `deploy-dashboard.yml` | Companion/flagship validation | Its separate deployment job is explicitly disabled; that skipped job is not the active Pages publisher |
| `qa-audit.yml` | PR and manual audit | Full parity/visual/performance observations; optional manual hosted crawl/hash check; no deployment |
| `publish-pypi.yml` | Manual dispatch on the owner repository's main branch | Requires successful exact-source push `tests.yml`, verifies a wheel, then uses the existing `pypi` environment/trusted publisher |
| `portfolio-dashboard-check.yml` | Filtered guide paths on PR/main/tag events | Validates the existing portfolio guide, source paths and SVG |

[.github/workflows/tests.yml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/tests.yml), [.github/workflows/hardened-ci.yml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/hardened-ci.yml), [.github/workflows/codeql.yml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/codeql.yml), [.github/workflows/deploy-dashboard.yml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/deploy-dashboard.yml), [.github/workflows/qa-audit.yml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/qa-audit.yml), [.github/workflows/publish-pypi.yml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/publish-pypi.yml), [.github/workflows/portfolio-dashboard-check.yml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/portfolio-dashboard-check.yml).

The repository's [AGENTS.md](../../AGENTS.md) requires keeping check names, Python/OS matrices, browser parity, numerical tolerances, least privilege, pinned actions and publish guards. PR cancellation is separated from manual/release/deploy execution. Runtime observations and billed usage are different measurements; no cost-saving claim follows from this audit.

## Documentation candidate gate

1. Bind the source, complete candidate tree and full diff. Check the 24 requested outputs and source/interface dispositions; preserve all protected application, model, test, dependency, license and historical evidence bytes/modes.
2. Rebuild the handbook and run its `--check`; validate new Markdown links/anchors, immutable source ranges, CFF against schema 1.2.0, and machine-readable handoffs with actual date/URI validation.
3. Have an independent reviewer assess the exact frozen candidate. Preserve the original review and any repair round; refresh the candidate identity after a repair.
4. At PR time, identify required provider contexts, approvals, head/base revisions, merge-queue semantics and conflict state. Keep PR-head checks separate from synthetic merge/queue revisions and their mappings.
5. Refresh those facts immediately before any guarded integration. Missing/stale/inaccessible requirements are unresolved, not passes. A branch-protection 403 must not be interpreted as permission to bypass it.

The final source-test records and candidate documentation validation belong in external execution receipts. Embedding a candidate's own commit hash into a file before that commit exists would be self-referential; record source pin inside docs and commit/merge/deploy identities afterward.

## Existing GitHub Pages route

The active `tests.yml` path builds the static demo, creates legacy Pages entry points with `scripts/build_pages_redirect.py`, and then executes `copytree(Path('docs'), output, dirs_exist_ok=True)`. Its assertions protect the companion marker and lesson configuration. The new `docs/reference/index.html`, CSS and chapter sources are inside that copied tree, and the existing companion links to the handbook. No new workflow, hosting service, branch or DNS setting is required. [.github/workflows/tests.yml:200–219](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/tests.yml#L200-L219), [scripts/build_pages_redirect.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/build_pages_redirect.py).

After an authorized merge, connect the merged revision to the actual workflow run/artifact and deployment. Inspect the repository Pages route, the new `reference/` page, and its distinctive source-snapshot/handbook content. Confirm that the companion's new reference link resolves. A successful old run, an HTTP 200 or the old home page does not prove these new files were deployed. Preserve the observed URL, time, deployment/artifact identity and content evidence.

## Separate custom-domain publication

The canonical React course origin in `apps/web/site.config.json` is `https://khanlab.co.technology/`. The existing deployment note documents Cloudflare Pages **Direct Upload**, an out-of-tree Windows publisher and a Worker-managed `/robots.txt` route. Its dated receipts describe earlier actions; they are not new live verification. The repository's `docs/` copy does not by itself prove the handbook is included in that separate custom-domain upload. [apps/web/site.config.json](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/site.config.json), [docs/cloudflare-pages-deployment.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/cloudflare-pages-deployment.md).

Before a future custom-domain publication, retrieve the authorized publisher and its version, verify the exact public asset set, match build/source identity and inspect the actual route. This documentation task does not create an account, upload a new custom-domain build, change DNS or weaken a policy. If one existing route publishes and the other is unverified, report them separately.

## Releases and package identity

The preserved CFF declares version 2.0.1 and release date 2026-10-26. Read-only release metadata at the audit snapshot lists v2.0.1 as latest, matching the existing receipt. The source README describes PyPI publication as pending; this audit did not independently query a current PyPI project to turn that historical statement into a live status claim. [CITATION.cff](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/CITATION.cff), [docs/releases/v2.0.1.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/releases/v2.0.1.md), [docs/engineering/pypi-publication.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/engineering/pypi-publication.md).

No new tag or release is part of this documentation change. For a separately authorized release, follow existing packaging and source-linked evidence rules: verify exact-source CI, build and check the actual wheel, preserve its digest/publication manifest and trusted-publisher environment, and confirm the resulting artifact. Documentation updates alone do not justify a model/version change or an archive DOI.

## Failed or interrupted delivery

Reconcile the actual PR, source/head/base and remote provider state before retrying an interrupted action. Preserve prior receipts. For an in-scope documentation defect, repair and independently recheck the changed candidate. For a pre-existing required source failure, record the blocker rather than editing application tests or disabling checks. Use [recovery](../owner/BUS_FACTOR_RECOVERY_RUNBOOK.md) for a missing publisher, unavailable dependency/toolchain or owner handoff.
