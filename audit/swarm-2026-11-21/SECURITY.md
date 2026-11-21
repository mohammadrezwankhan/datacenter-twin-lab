# Security and supply-chain evidence, redacted

At the base SHA `519152b6fb2289607f6bb77ccb24976a537675f0` on 2026-11-19:
- Hardened CI security jobs (workflow, secrets, sast, dependencies, trivy) were **successful**: https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44641661527.
- Python and JavaScript/TypeScript CodeQL jobs were **successful**: https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/runs/44641661302.
- Workflow code declares least-privilege `contents: read` globally, `security-events: write` for CodeQL, checkout with `persist-credentials: false`, immutable action SHAs, PR-only supersession cancellation, and manual/OIDC-gated PyPI publication. No changes proposed to these protections.
- Python API `datacenter_twin/api.py` restricts Host, CORS, and loopback use; input requests capped at 4 MiB; simulations are stateless.

**NOT_VERIFIED on audit branch:** a new full-history Gitleaks/TruffleHog scan, current exact dependency CVE inventory, served production security response headers, hosted CSP compatibility, and results of production penetration testing. No credentials are included in this evidence.

Source observation: `apps/web/public/_headers` presently contains `script-src 'self' 'unsafe-eval'`; do not change it without confirming Pyodide/runtime needs, actual deployed CSP, and browser parity. This is an investigation, not a confirmed exploitable vulnerability. Avoid adding `'unsafe-eval'` to new pages unnecessarily.

DTL-001 closes a schema type-check gap without changing input permissions, APIs, or the deployment boundary. Exact final-SHA security/CodeQL results still gate release.
