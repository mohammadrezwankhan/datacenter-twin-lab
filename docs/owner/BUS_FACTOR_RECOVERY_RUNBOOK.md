# Bus-factor recovery runbook

The goal is to recover an inspectable source/toolchain/evidence state before attempting publication. This runbook uses the reviewed source `d8dc3773830a397409a7a9c00a6ffed33c46fb4b` and tree `fde01a007a4ff05f685f88be2158b672a31c118f`. An old snapshot is a recovery anchor, not an instruction to overwrite a newer branch.

## 1. Re-establish repository identity and authority

Read the actual default branch, current head, PR state, effective rules and owner permissions. Preserve any uncommitted work and historical receipts. Use a separate checkout for investigation; verify its commit and tree before running commands. An inaccessible protection endpoint does not prove the branch is unprotected. Keep an old source anchor and a current integration candidate distinct. [CI playbook](../maintainer/CI_CD_AND_RELEASE_PLAYBOOK.md).

```sh
git clone https://github.com/mohammadrezwankhan/datacenter-twin-lab.git
cd datacenter-twin-lab
git checkout d8dc3773830a397409a7a9c00a6ffed33c46fb4b
git rev-parse HEAD
git rev-parse 'HEAD^{tree}'
```

The recorded tree accounts for 711 blobs and 97 directory entries, with no submodule or symlink entries in that snapshot. Compare actual bytes/modes to a trusted retained manifest rather than assuming an archive extraction preserved everything.

## 2. Recover the local calculation path

Read `AGENTS.md`, `pyproject.toml`, the lockfiles and the existing quickstart. Create a new Python 3.12+ environment and reproduce the dependency-free CLI/standard-library suite first. Then run offline lock checks, install authorized locked extras and run installed-version checks. Keep `TWIN_PYTHON` consistent for Node helpers. A preinstalled environment with similar versions is not a recovered locked environment. [Setup](../developer/SETUP_AND_REPRODUCIBILITY.md), [AGENTS.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/AGENTS.md), [scripts/check_dependency_versions.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/check_dependency_versions.py).

Rebuild the local dashboard from its lock if needed; a missing bundle should produce the existing build-required response rather than a fabricated successful UI. Recover optional Pyodide study assets only through the hash-verified staging process. Preserve third-party notices and the owner's original scope statements.

## 3. Recover evidence without rewriting history

Use versioned `data/evidence/` packets and indexes as historical records. Copy them for inspection if necessary; do not regenerate in place. Build into a fresh directory below `outputs/`, verify file hashes and numerical reproduction, and retain the printed manifest digest outside the packet. A changed receipt/environment field must not erase original evidence. [scripts/build_evidence.py](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/scripts/build_evidence.py), [docs/validation/evidence-method.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/validation/evidence-method.md).

Start with the battery example, the charging/no-charging contrast and a path-capacity case. Check that stored-energy signs, gross-versus-served power and event ordering match the source. For scientific studies retain the archive provenance and absence of original MATLAB/measurement inputs. The source does not contain a recovery copy of those absent materials. [Worked labs](../developer/WORKED_EXAMPLES_AND_LABS.md), [assumptions](../math-and-physics/ASSUMPTIONS_AND_LIMITS.md).

## 4. Recover documentation and navigation

Use a documentation checkout that contains this package; the pinned source-only checkout in step 1 predates these added files. Record the actual documentation revision separately. The canonical entry is `docs/INDEX.md`. Rebuild `docs/reference/index.html` from its chapter manifest with Python and Pandoc, then use `--check`. Confirm its source pin, local links and the companion's reference link. Do not alter the companion's inline model/configuration, hashed styles/scripts or CSP to solve a documentation-link problem.

The existing Pages path copies `docs/` after redirect staging, so verify the exact artifact includes `reference/index.html` and its CSS. Preserve the workflow's companion/config assertions and main-branch guard. [.github/workflows/tests.yml:200–219](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/.github/workflows/tests.yml#L200-L219).

## 5. Recover the separate custom-domain publisher

The documented custom-domain route is Cloudflare Pages Direct Upload. Its Windows publisher is referenced outside the repository. Retrieve the authorized script/version and its dependency/configuration record from the owner; a clone cannot reconstruct an absent external script. Credential names may be documented, but values belong in the existing secure credential mechanism. Do not paste credentials into a recovery document, repository or public issue. [docs/cloudflare-pages-deployment.md](https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/d8dc3773830a397409a7a9c00a6ffed33c46fb4b/docs/cloudflare-pages-deployment.md).

Confirm the exact staged public asset set and source/build identity before a separately authorized upload. The `/robots.txt` route also has an existing Worker dependency. Reconcile actual deployment/account/route state before retrying an interrupted upload. Do not infer a custom-domain publication from a GitHub Pages success or create replacement hosting/DNS to hide an unavailable path.

## 6. Hand over a reviewable state

Retain source/candidate/merge/deploy identities, environment and command logs, protected-file comparison, full diff, open findings and next actions. Obtain independent review of the candidate and current required provider checks. Report a blocked boundary precisely when an owner-controlled credential, policy or missing publisher prevents continuation. A recovered local CLI is valuable but does not constitute a completed release, restored live service or facility validation.
