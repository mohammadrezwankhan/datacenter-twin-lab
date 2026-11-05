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
| OpenGrep | Registered `p/security-audit` pack plus the twelve checked-in rules | Every unsuppressed finding and scanner/configuration failure; live registry pack may evolve |
| pip-audit | Static runtime, extras, build and PEP 735 dev declarations plus every requirements manifest, including scanner dependencies | Every reported vulnerability; no ignored vulnerability IDs |
| npm audit | Every checked-in npm lockfile | HIGH/CRITICAL; all severities remain in JSON |
| Trivy | Filesystem dependency vulnerabilities and supported misconfigurations, including dev dependencies | HIGH/CRITICAL, including unfixed vulnerabilities; database/network failures fail |
| CodeQL | Detected Python and JavaScript/TypeScript, with security-extended queries | Analysis/upload errors fail; SARIF gate fails severity >=7 or error-level results |

MATLAB and Simulink are not supported languages in the configured OpenGrep/CodeQL engines.
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

The checked-in `.semgrepignore` preserves the explicit test-inclusive scanner scope and
only excludes installed dependencies, caches and generated scanner artifacts.
The scanner disables the target-size limit, runs one worker and permits 180
seconds per rule/file. A timeout remains a failure under `--strict`; it is never
a clean bill of health. JSON findings and errors identify the actual analyzed
scope. The registry pack is live, while the CLI and local twelve-rule policy are
pinned in this change. An audit-pattern match needs source review before being
called a confirmed exploitable vulnerability.

## Scanner dependency remediation

The historical Semgrep 1.183.0 distribution requires vulnerable MCP and
OpenTelemetry versions. Its incompatible patched constraints and all five
advisories remain in `known-scanner-findings.json`; that file is not an allowlist.
The scanner now uses the complete OpenGrep 1.33.1 upstream Python CLI and native
engine, built from commit `092c80faa0817840228349f93eff12a50fb9cf6b`. The supported
upstream build targets and all declared Python dependency ranges are preserved.
The Python environment has a complete 47-package hash lock and is checked with
strict pip-audit, including its pip/setuptools/wheel build tools. CMake's separate
build lock is also audited. Existing Semgrep environments are rejected so their
old packages cannot remain hidden in a reused environment.

`native-scanner.json` records 56 SHA-256-verified source/tool/library assets.
`native-switch.export` freezes all 182 installed opam packages, archive checksums,
and both upstream Git pins. Import uses a local empty repository rather than a
floating package index. The original hmap archive is fetched through HTTPS with
its original strong checksum preserved. GMP/libev are extracted into a private
prefix from pinned Ubuntu packages; every opam system-library probe still runs.
The build retains its JIT and all supported parser targets.

The frozen switch selects upstream `ocaml-variants.5.5.2+options` and
`ocaml-option-no-compression.1`, retaining the identical `ocaml-compiler.5.5.2`
source archive. These two metadata packages replace `ocaml-base-compiler` and
its conflicting `ocaml-options-vanilla` selection. The supported `--without-zstd`
option makes compiler artifact compression independent of libraries installed on
the runner. A hosted cold build had otherwise picked up an unrecorded system
`libzstd.so.1`. After import, the builder records `ocamlc -config` and requires
the expected compiler version and a present, unambiguous empty
`compression_c_libraries` field before building OpenGrep. The original runtime
library closure still rejects `libzstd`, unresolved libraries, dynamic PCRE2 and
every unknown library; no runtime dependency is added to its accepted set.
The two upstream metadata definitions are frozen from opam-repository commit
`7652d3fcd371d9bfed1b9c2498f72dd9c5d4c5b9`, with their exact source hashes in
`provenance.json`.

The official OpenGrep native release embeds OCaml 5.5.1, so this build uses patched
OCaml 5.5.2. PCRE2 10.49 is still flagged by the current advisory database; the build
uses accepted upstream commit `ee7b43963d9a6a95c1745fa8ff1b56625d7b1dc3`, whose
source version is **10.50~DEV**, and runs all four upstream PCRE2 test suites.
This is an explicitly pinned development source revision, not a released PCRE2
tarball. No advisory is ignored to accept either older native component.

The native audit queries every locked opam package, source commit, vendored
libyaml revision, tool and bundled Ubuntu library: 237 distinct component queries.
Every returned advisory blocks, including build dependencies. Missing, malformed,
partial or paginated results fail. The gate independently verifies that the saved
report matches the exact locked query scope, even if a subprocess exits zero.
The Ubuntu runner supplies its standard C/C++ runtime; these are not bundled into
the scanner artifact. Database coverage is not proof that no unknown vulnerability
exists in a component.

Only `sast` or `all` builds the native engine. Other security matrix jobs audit
its lock without compiling it. A completed source build produces a verified local
wheel plus the three native libraries, with input/output digests. The wheel is
labelled for the actual Linux platform and used only on Ubuntu 24.04 x86_64.
Cached bytes are verified and the full native advisory audit runs again on every
reuse. The registry pack, all twelve local rules, source targets, strict failures,
severity policies, report completeness checks and source-drift protection remain
unchanged. JSON output retains the existing `semgrep.json` artifact name for the
shared validator. Only the obsolete metrics CLI option is removed.

Local positive/negative controls exercised all twelve local rules and the live
225-rule registry pack: every baseline detection was retained, unsafe inputs
failed, safe inputs passed, malformed YAML failed, and omitted authored sources
were rejected by the independent target validator. Hosted same-head checks still
must pass before merging the candidate.

## Continuation scan integrity and narrow reviews

The SAST gate additionally checks its JSON analysis report: missing errors/results/target
fields, nonempty errors, an empty analyzed scope, or any authored Python/JavaScript/
TypeScript file absent from the analyzed target list fails the gate. The 180-second
per-rule/file budget and 30-minute process budget allow large checked-in bundles to
finish, with a 4096 MB per-worker budget; reaching any limit remains a failure. Source SHA-256 values in every
mode receipt bind the command to the scanned candidate. A source change during a
scan invalidates that receipt and requires a new run.

The two previously reviewed Semgrep-compatible annotations are attached to two reviewed scanner-helper
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

### Build time and cache policy

Only the `sast` mode (or an explicit local `all` invocation) builds the native
scanner. The other security matrix jobs retain their 40-minute limits. The SAST
limit is 90 minutes: completed local source-build phases plus the full Power SAST
scan total about 68.7 minutes, with about 21.3 minutes (31%) of explicit margin.
`native-build-timings.json` records the individual measurements, initial failures
and their corrections. These are local staged measurements, not GitHub Actions
usage or a claim that the full cold hosted job has passed. Its first same-head
execution is required before merge.

The cache stores only the built wheel, pinned shared libraries and their receipts.
Its exact key includes Ubuntu 24.04, runner architecture and all seven source,
builder and lock inputs; there are no broad restore keys. Every reuse verifies
input identity and every output hash, rejects extra or altered files, reruns the
complete native vulnerability audit, and installs the wheel without dependency
resolution. A fresh environment with an existing verified cache took 136.33
seconds locally and created no native build directory. Cache upload follows a
successful bootstrap, so app findings cannot force another compiler build.

The frozen opam switch retains all package metadata and required strong checksums.
Its two development dependencies use byte-for-byte equivalent archives of their
original full commits, now with SHA256. The official content-addressed opam archive
mirror supplies the same checksum-verified archives, with the original upstream
URLs as fallback; it never supplies a replacement version. Native HTTPS downloads
retry transient network failures at most three times and still fail after bounded
exhaustion, TLS failure or a checksum mismatch.

### Native sandbox prerequisite

The Battery Power pilot's first hosted cold build at
`5efafb219c145f60f04948b7702f034a1e589301` failed at opam initialization because
`bwrap` was absent from the runner. The
current Ubuntu 24.04 package `0.9.0-1ubuntu0.3` still has CVE-2026-87766: Ubuntu
reverted its initial fix because of a regression. The native audit rejected it;
no advisory was ignored.

The lock instead includes Ubuntu 26.10's patched `bubblewrap` package `0.12.0-1`,
extracted privately without installing another distribution or running package
scripts. Its declared minima (libc6 2.38, libcap2 2.10 and libselinux1 3.1) are
satisfied by the Ubuntu 24.04 runner. The package and extracted executable have
separate SHA-256 checks, and the exact Ubuntu 26.10 identity and upstream source
commit are both included in the native audit. Ubuntu's archive signature and its
SHA-512 index and package checksums were verified before deriving the locked
SHA-256; the published SHA-512 and signing-key identity are retained in the lock.
Actual library resolution and version execution are recorded before use. The
helper uses the runner's libc, libcap and SELinux runtime, including libselinux's
PCRE2 dependency.

The next hosted run reached the actual sandbox and failed with `bwrap: loopback:
Failed RTM_NEWADDR: Operation not permitted`. On a GitHub-hosted Ubuntu 24.04 VM
only, the builder now copies the verified helper to the dedicated root-owned
`/usr/libexec/rezwan-native-sandbox/bin/bwrap` path and loads a dedicated AppArmor policy.
The qualified runner image makes `/opt` world-writable for tool installation.
The helper uses the system `/usr/libexec` prefix instead; every existing ancestor
must still pass the unchanged ownership and permission checks. No existing
directory ownership or permissions are changed to make a path acceptable.
The policy comes from Ubuntu 24.04's hash-locked `apparmor-profiles`
`4.0.1really4.0.1-0ubuntu0.24.04.9` package, which is separately audited by its
source package identity. The package was verified against the signed Ubuntu
archive index; its extracted policy has a separate SHA-256 check. No package
scripts run. The runner supplies its existing AppArmor parser.

The derived policy changes the helper attachment and paired profile names,
limits its setup capabilities to the six required by the pinned Bubblewrap
source (`sys_admin`, `sys_chroot`, `net_admin`, `setuid`, `setgid`, `sys_ptrace`),
and removes optional local overrides. It retains Ubuntu's child profile stacking
and unconditional child capability denial. The executable, policy and every
parent directory must be root-owned, without symlinks or non-root write access;
installed bytes are rechecked before use. The helper is mode `0555`, without
setuid/setgid, and the policy is mode `0444`. System Bubblewrap, other AppArmor
profiles, and global kernel restrictions remain untouched. Local containers and
self-hosted runners receive no policy or system-path changes.

Opam's `--yes` can accept disabling sandboxing after a failed namespace probe.
Initialization now answers `--no`, independently verifies the exact upstream
build/install/remove wrappers, and executes the upstream build sandbox before
importing the compiler or dependency switch. The hosted child must additionally
report both enforcing AppArmor profiles, zero effective and permitted
capabilities, and `NoNewPrivs=1`. Missing, altered, shadowed or nonworking helpers
fail the build. A constrained local container reproduced
the original silent fallback; the corrected initialization retains its wrappers
and fails on the actual sandbox operation. Successful sandbox execution and the
complete cold source build still require the hosted run; local source-build
timings do not establish that result. The derived policy compiled successfully
with the real Ubuntu 4.0.1 parser without loading any local kernel policy; that
syntax check also does not establish a successful hosted sandbox or cold build.
