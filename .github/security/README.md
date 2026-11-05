# Security gates and coverage

Run `python3.12 .github/security/bootstrap.py all --destination /tmp/rezwan-security-tools`,
then run `python3.12 .github/security/run.py MODE --tools /tmp/rezwan-security-tools`.
The modes are `workflow`, `secrets`, `sast`, `dependencies`, and `trivy`.
These tools are development dependencies. They are never imported by application code.
Use a dedicated writable tool directory. The verified binary releases support Linux x86_64.

`hardened-ci.yml` runs each mode independently on pushes, pull requests, merge queues,
manual requests, and a weekly schedule. A missing executable, rule download, vulnerability
database, invalid configuration, scanner failure, or blocking finding produces a nonzero gate.
Reports and command/coverage receipts are preserved even on failure; missing artifacts also fail.
Each execution writes to a new `hardening-artifacts/MODE/run-*/` directory. Earlier
reports are retained and cannot satisfy a later run. Zizmor, Gitleaks, pip-audit,
npm and Trivy reports are validated independently of process exit status. Empty
or skipped dependency audits, malformed counts, missing targets and contradictory
findings fail. Valid empty finding arrays remain acceptable. Actionlint's normal
empty output on a successful clean run remains valid. Language quality receipts
also bind source hashes before and after execution and reject source drift.
A checkout of all history allows Gitleaks to inspect all refs actually fetched by that runner.
It cannot inspect deleted or unreachable commits or remote refs that GitHub does not expose.

| Gate | What it checks | Blocking policy |
| --- | --- | --- |
| actionlint + zizmor | Workflow syntax and local security rules | Any reported error/finding; zizmor runs offline, so remote advisory/action metadata checks are not covered |
| Gitleaks | Reachable Git history and a source-only working-tree snapshot | Every unsuppressed default-rule match; reports use 100% redaction |
| Semgrep | Registered `p/security-audit` pack plus the twelve checked-in rules | Every unsuppressed finding and scanner/configuration failure; live registry pack may evolve |
| pip-audit | Static runtime, extras, build and PEP 735 dev declarations plus every requirements manifest, including scanner dependencies | Every reported vulnerability; no ignored vulnerability IDs |
| npm audit | Every checked-in npm lockfile | HIGH/CRITICAL; all severities remain in JSON |
| Trivy | Filesystem dependency vulnerabilities and supported misconfigurations, including dev dependencies | HIGH/CRITICAL, including unfixed vulnerabilities; database/network failures fail |
| CodeQL | Detected Python and JavaScript/TypeScript, with security-extended queries | Analysis/upload errors fail; SARIF gate fails severity >=7 or error-level results |

MATLAB and Simulink are not supported languages in the configured Semgrep/CodeQL engines.
The two MATLAB repositories have a separate R2026a numerical gate. Local CI configuration
validation does not prove MATLAB execution or CodeQL/cloud scan success. Inspect their actual
Actions runs and retained artifacts before treating those gates as passed.

The secret working-tree snapshot includes tracked and nonignored untracked regular files.
It excludes generated dependencies, scanner reports and symlinks. Git history is still scanned
with the built-in Gitleaks rules. No historical findings are silently baselined or discarded.
Review a detection before calling it a confirmed credential; rotate any real credential even
if it has subsequently been removed from the tree. Never rewrite history as an automatic fix.

`binaries.json` contains exact release archive digests verified against upstream release checksums.
`requirements.txt` pins the complete Python scanner dependency graph and package hashes for
Python 3.12. `provenance.json` records source URLs and review date. Hash verification detects
unexpected artifact changes; it does not independently prove publisher trust. Trivy is installed
from the verified post-incident v0.76.1 release archive rather than an affected mutable Action tag.
No network bootstrap script is piped into a shell. Narrow Ruff annotations document the reviewed
HTTPS and subprocess calls; scanner code is included in ordinary Python linting.

Every action reference uses an immutable commit with its verified upstream version comment.
Dependabot checks application and security-tool dependencies weekly. Seven-day cooldown applies
to version updates. Dependabot security updates are exempt by GitHub's documented behavior;
there is no invented security-bypass field. Keep urgent advisory fixes eligible for immediate review.
`harden-runner` uses audit mode, which records outbound activity and does not block egress.
Coverage depends on the runner and StepSecurity account capabilities; no private-plan activation
or firewall enforcement is claimed by this configuration.

The optional pre-commit hooks use the same scanner runner. Bootstrap the tools first and set
`SECURITY_TOOL_DIR`; hooks do not install scanners or silently skip missing tools. Workflow and
secret hooks run on commit; all gates can be invoked manually. The hooks are not installed by CI.

`sonar-project.properties` supplies source layout and encoding only. A real SonarQube Cloud project,
organization/project identifiers, authorized credentials and quality-gate settings must exist before
an analysis can run. No external project activation, successful analysis, or quality-gate pass is
claimed. Supply the registered identifiers to the scanner; never fabricate account/project IDs.

## Mandatory language and numerical quality

Hardened CI runs Python Ruff, strict Mypy, branch-enabled pytest coverage, ESLint,
strict TypeScript, Prettier and browser contract tests as independent jobs. Local
pre-commit hooks invoke the same quality runner; coverage and browser tests run
on pre-push. `python3.12 .github/security/quality.py MODE --install` installs only
the declared development and test dependencies before running a selected check.
Use `quality.json` to inspect the exact project installations, test targets,
coverage sources and numerical core paths. Missing tools or targets fail.

Seven repositories declare a Python numerical core. Its source files alone must
achieve **at least 95% line coverage and at least 95% branch coverage separately**.
Tooling, security helpers and tests cannot dilute either numerical denominator.
The gate requires branch measurement, every expected core file, valid integer
counts, executed core statements, measured branches and actual executed JUnit
cases. A report with only skipped cases or omitted source files fails. Aggregate
coverage including tooling is recorded separately. BESS and the MATLAB lab's
Python validator have tooling coverage, not a Python numerical coverage claim;
MATLAB and Simulink retain their separate execution gate.

The checked-in `.semgrepignore` replaces Semgrep's implicit test exclusions and
only excludes installed dependencies, caches and generated scanner artifacts.
The scanner disables the target-size limit, runs one worker and permits 180
seconds per rule/file. A timeout remains a failure under `--strict`; it is never
a clean bill of health. JSON findings and errors identify the actual analyzed
scope. The registry pack is live, while the CLI and local twelve-rule policy are
pinned in this change. An audit-pattern match needs source review before being
called a confirmed exploitable vulnerability.

## Recorded scanner dependency blocker

The 2026-11-04 pip-audit run reports five advisories in the Semgrep tool's locked
`mcp==1.29.0` and `opentelemetry-api==1.37.0` dependencies. The checked latest
Semgrep release, 1.183.0, still requires these vulnerable ranges. The patched
combination cannot satisfy its published dependency constraints. Details and
primary metadata URLs are in `known-scanner-findings.json`. These are development
tool dependencies; application dependency declarations are separate audit targets.
The dependency gate remains failed. No advisory is ignored, no package constraint
is overridden, and this configuration does not claim a clean security release.


## Continuation scan integrity and narrow reviews

Semgrep additionally checks its JSON analysis report: missing errors/results/target
fields, nonempty errors, an empty analyzed scope, or any authored Python/JavaScript/
TypeScript file absent from the analyzed target list fails the gate. The 180-second
per-rule/file budget and 30-minute process budget allow large checked-in bundles to
finish, with a 4096 MB per-worker budget; reaching any limit remains a failure. Source SHA-256 values in every
mode receipt bind the command to the scanned candidate. A source change during a
scan invalidates that receipt and requires a new run.

The only new Semgrep annotations are attached to two reviewed scanner-helper
operations, with full rule IDs. The standard-library XML import is paired with
handlers that reject DTDs and internal/external entities before expansion; the
bootstrap download requires HTTPS and checks the exact release SHA-256 before
writing/executing anything. Adversarial contract tests exercise those guards.
These annotations do not exempt paths, tests, application XML parsers or other
network operations. Other raw findings remain blocking and require source review.

A requirements file using `-e .[extra]` is audited by statically expanding the
adjacent pyproject runtime requirements and requested extras. This avoids looking
up an unpublished local distribution on PyPI or executing its build merely to
read metadata. The pyproject's build dependencies are audited separately. Missing
or dynamic declarations, unknown extras, other editable paths/URLs and mixed
requirement directives fail closed instead of dropping dependency coverage.

The pip-audit child process receives `PIP_IGNORE_INSTALLED=1`. Its isolated resolver
preinstalls setuptools and wheel; without this supported pip flag, the resolver's
dry-run report can omit those required build packages as already satisfied. The
flag includes them in resolution while preserving declared version constraints.
It is scoped to the scanner process and does not change the application runtime
or the parent environment. Empty audited-package reports still fail independently.
