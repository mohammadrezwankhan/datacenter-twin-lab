# Verification evidence ledger

**Snapshot:** 19 November 2026. **Source:** `d8dc3773830a397409a7a9c00a6ffed33c46fb4b`. **Git tree:** `fde01a007a4ff05f685f88be2158b672a31c118f`. This ledger separates executed local source checks, historical provider records, documentation checks and future delivery stages. It does not assign a commit or deployment identity to an uncommitted documentation candidate.

## Local source execution

The source extraction contains all 711 canonical blobs and 97 directory entries. Tests ran in an isolated source copy, with generated outputs kept outside the documentation candidate. Raw commands, original timestamps, exit status and stdout/stderr digests are retained in the author handoff's numbered runtime receipts. The following times are original completion times in UTC, not dates when this page was written.

| Receipt | Check | Original completion time | Observed result and scope |
| --- | --- | --- | --- |
| DC-RUN-01 | Lock-only validation | 2026-11-19T21:06:58.947571+00:00 | PASS; declared extras and lock files agree |
| DC-RUN-02 | Standard-library unittest discovery | 2026-11-19T21:07:32.292826+00:00 | PASS; 306 discovered, 247 executed passes, 59 optional skips |
| DC-RUN-03 | Native-test fixture preparation | 2026-11-19T21:27:17.412721+00:00 | PASS; two JSON fixtures, 18 presets; no full browser preparation |
| DC-RUN-04 | Native Node subset | 2026-11-19T21:27:22.354684+00:00 | PASS; 132 tests in 18 files; two parse5-dependent files excluded |
| DC-RUN-06 | Infrastructure verifier | 2026-11-19T21:29:39.348611+00:00 | PASS; 24 cases, 222 comparisons, 11 model families |
| DC-RUN-07 | Fresh evidence build | 2026-11-19T21:29:39.784293+00:00 | PASS; 14 artifacts |
| DC-RUN-08 | Fresh evidence verification | 2026-11-19T21:29:40.199467+00:00 | PASS; hashes and current-engine numerical reproduction |
| DC-RUN-09 | Planning CLI example | 2026-11-19T21:29:40.429746+00:00 | PASS; baseline-1mw result |
| DC-RUN-10 | Continuity CLI example | 2026-11-19T21:29:40.697795+00:00 | PASS; charging-enabled generator_failure |
| DC-RUN-11 | Reserve sweep CLI example | 2026-11-19T21:29:41.175802+00:00 | PASS; 0, 50, 100 kWh in caller order |
| DC-RUN-12 | EMT CLI example | 2026-11-19T21:29:41.458730+00:00 | PASS; voltage-sag, 2,001 sampled rows |
| DC-RUN-13 | Installed-version diagnostic | 2026-11-19T21:29:41.628798+00:00 | FAIL / exit 1; FastAPI 0.141.1 differs from declared 0.162.2 |
| DC-RUN-14 | Supplementary research tests | 2026-11-19T21:30:20.609619+00:00 | PASS; 37 tests, available NumPy 2.3.5/SciPy 1.17.0 |
| DC-RUN-15 | Supplementary spectrum parity | 2026-11-19T21:30:20.937094+00:00 | PASS; 2 tests, available NumPy 2.3.5 |
| DC-RUN-16 | Existing notebook code cells | 2026-11-19T21:49:36.354790+00:00 | PASS; 8 cells/assertions; no Jupyter/rendering claim |

The standard-library run used an isolated Python 3.12.14 environment without optional packages. Its 59 skips comprise 37 research tests, 6 spectrum-boundary tests, 2 spectrum-parity tests and 14 API-related tests. Later supplementary runs did not rewrite that result. The six spectrum-boundary tests and fourteen API-related tests remained unexecuted locally. The native run used Node 24.22.3; its exact 18-file list is retained in receipt04. `build-security.test.ts` and `seo-delivery.test.ts` were excluded because their parse5-dependent build pipeline was unavailable locally. Arithmetic/native tests are not browser interaction, CSS layout or TypeScript compiler checks. [tests/test_research.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/tests/test_research.py), [tests/test_research_guards.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/tests/test_research_guards.py), [tests/test_spectrum_parity.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/tests/test_spectrum_parity.py), [apps/web/package.json](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/package.json).

The 24-case infrastructure verifier uses independently written Python equations and Node-executed TypeScript, covering 11 lesson model families at relative `1e-11` / absolute `1e-10`. Native unit tests additionally cover the other exported models. The source test labelled “seven presets” actually iterates the current 18-preset fixture; avoid treating a stale test name as a count. [scripts/verify_infrastructure.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/verify_infrastructure.py), [apps/web/tests-engine/infrastructure.test.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/tests-engine/infrastructure.test.ts), [apps/web/tests-engine/engine.test.ts](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/apps/web/tests-engine/engine.test.ts).

All eight existing notebook code cells were executed in source order with their assertions under Python 3.12.14. The harness retained each code-cell hash and expression result. It did not start an IPython kernel, render the notebook or rewrite its saved outputs. Source notebook SHA-256 is `01b0f6cc0d1b895e4985dd532485c45532c48a126865266c06a23643892174e9`. [docs/examples/battery-ride-through.ipynb](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/examples/battery-ride-through.ipynb).

### Revision binding and retained output digests

The initial 711-file manifest was retained before documentation edits. Receipt05 reconciles the source copy after runs02–04; it is explicitly a **post-run** reconciliation, not a retained pre-test snapshot. Runs06–16 bracket execution with before/after byte, size and Git-mode checks against that manifest. The normalized identity-list digest is `cb274e6a1a1bb31e6cc3f9a9d9fe60d7a0a07b5a8a11cc7380eb0033d6fcb121`. No application source changed during these runs.

| Evidence | SHA-256 | Meaning |
| --- | --- | --- |
| Standard-library stderr log | `f2390a6a3bf2027dab5d3c6ccb32bdda1434913cd4918252a2788532d0794df4` | Original test names, skips and 306-test summary |
| Native subset stdout log | `701c5c70288118dc7d6d194325542755ae5f82dfcbf86395f1b32c0eb27ae567` | 132-test execution record |
| Infrastructure verifier stdout | `894134741176d3701faf117786b2af4f8d40d13fd4d149b8020ef9995dec5dde` | 24 cases / 222 comparisons |
| Fresh packet manifest | `9c435f005764f65fcc02d8a5a2db4b9918118fccaeb0bf3b0cee0919b894228f` | Author-built 14-artifact packet; not a new release |
| Research stderr log | `09478816e741f0c86b04350f2a3ab93a9e6e035693b8cec6e4d8163c4756f281` | Separate 37-test supplementary run |
| Spectrum parity stderr log | `a8a93a1cb6eabce49c7be80efee5f1a728aa5daab0f49d85665c0ef1433646b4` | Separate two-test supplementary run |

These digests identify retained evidence; a hash alone is not a test result, authenticity signature or proof of physical accuracy. The existing packet verifier itself treats revision/environment fields as declared metadata rather than a remote checkout attestation. The author separately bound the local source files. [docs/validation/evidence-method.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/validation/evidence-method.md).

## Historical exact-source GitHub evidence

At **2026-11-19 21:06:47 UTC**, the read-only GitHub query for this source returned the provider's default latest set of **23 check runs: 22 success and one skipped**. This was not a `filter=all` history of every attempt. Their executions belong to **17 November 2026**, not this documentation candidate.

| Workflow / check | Provider reference | Recorded status |
| --- | --- | --- |
| Tests | [run 44121851395](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44121851395) | Success for source SHA; updated 2026-11-17 16:28:11 UTC |
| Hardened CI | [run 44121851699](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44121851699) | Success for source SHA; updated 16:08:48 UTC |
| Flagship dashboard | [run 44121852205](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44121852205) | Success for source SHA; updated 16:06:17 UTC; separate deploy job skipped |
| CodeQL | [run 44121852380](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44121852380) | Success for source SHA; updated 16:07:44 UTC |
| Browser demo / Python parity | [job 134177923737](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44121851395/job/134177923737) | Historical success; completed 16:27:48 UTC |
| Publish static demo | [job 134189960912](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44121851395/job/134189960912) | Historical success; completed 16:28:10 UTC; not proof of this handbook's publication |

The classic branch-protection query returned 403; a ruleset list was visible but does not replace a complete effective-policy review. The Pages endpoint was unavailable through the supported connector and returned a 400 endpoint error. These failures do not prove absence of protection or absence of a site. The source contains a configured Pages publisher. Refresh policy, PR head/base and required checks at integration time. [.github/workflows/tests.yml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/tests.yml), [.github/workflows/deploy-dashboard.yml](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/deploy-dashboard.yml), [CI and release playbook](CI_CD_AND_RELEASE_PLAYBOOK.md).

## Verification that remains distinct

- **Candidate documents:** exact allowed-file diff, protected source bytes/modes, source citations, required-output navigation, MathML/HTML generation, declared CFF schema and structured handoff schemas are author-side deterministic checks. Their final identities belong in the frozen author handoff.
- **Independent candidate QA:** a separate reviewer must assess the frozen candidate's science, wording, coverage, commands, privacy and roadmap. Source-only reviewer preparation does not approve an unseen candidate.
- **Locked environment and browser:** local typecheck/build, both parse5-dependent tests, browser journeys, fresh visual inspection and exact locked scientific/API runs were not established by this author environment. Use correctly revision-linked CI and any required current candidate checks.
- **Merge and publication:** documentation commit SHA, merged SHA, deployed artifact identity and distinctive live content are separate future observations. No author test here certifies them.
- **External scientific review:** maintainer-produced artifacts and agent QA do not satisfy the project's recorded independent external reproduction goal.

No failed, skipped, historical, unavailable or pending check is relabelled as an executed candidate pass. [Existing external review protocol](../validation/review-protocol.md), [release readiness](../engineering/release-readiness.md).
