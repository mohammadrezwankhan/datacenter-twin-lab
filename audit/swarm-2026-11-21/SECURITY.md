# Security and supply-chain evidence, redacted

At the base SHA `519152b6fb2289607f6bb77ccb24976a537675f0` on 2026-11-19:
- Hardened CI security jobs (workflow, secrets, sast, dependencies, trivy) were **successful**: https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44641661527.
- Python and JavaScript/TypeScript CodeQL jobs were **successful**: https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44641661302.
- Workflow code declares least-privilege `contents: read` globally, `security-events: write` for CodeQL, checkout with `persist-credentials: false`, immutable action SHAs, PR-only supersession cancellation, and manual/OIDC-gated PyPI publication. No changes proposed to these protections.
- Python API `datacenter_twin/api.py` restricts Host, CORS, and loopback use; input requests capped at 4 MiB; simulations are stateless.

**NOT_VERIFIED on audit branch:** a new full-history Gitleaks/TruffleHog scan, current exact dependency CVE inventory, served production security response headers, hosted CSP compatibility, and results of production penetration testing. No credentials are included in this evidence.

Source observation: `apps/web/public/_headers` presently contains `script-src 'self' 'unsafe-eval'`; do not change it without confirming Pyodide/runtime needs, actual deployed CSP, and browser parity. This is an investigation, not a confirmed exploitable vulnerability. Avoid adding `'unsafe-eval'` to new pages unnecessarily.

DTL-001 closes a schema type-check gap without changing input permissions, APIs, or the deployment boundary. Exact final-SHA security/CodeQL results still gate release.

## Newly detected scanner CVE during this PR (2026-11-21)

The *first* PR-head security dependency audit failed (`pip-requirements-2`) at
[Hardened CI](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44957669592).
The preserved audit report lists `wcmatch==8.5.2`,
`CVE-2026-132276` (moderate regex complexity, fixed 11.2). It is limited to
hash-locked **development scanner tooling** in the known evidence; this is not
a confirmed public simulation-engine issue.

The patch updates scanner source constraint and locked, PyPI-attested hashes to
11.2; existing `bracex` pin remains compatible. This is a deliberate major-version
exception to OpenGrep's original `~=8.3` constraint. No vulnerability
suppression/allowlist or weakening of the security gate occurred. Qualification
requires final-SHA `Security / dependencies`, `Security / sast`, `Security /
workflow` and scanner bootstrap to succeed before declaring DTL-002 resolved.
