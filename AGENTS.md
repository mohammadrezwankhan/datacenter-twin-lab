# CI economics

- Preserve existing check names, supported Python/OS matrix, browser parity, numerical tolerances and deployment guards.
- Validate dependency locks offline with `python scripts/check_dependency_versions.py --lock-only api test-api studies` before downloads. Regenerate the relevant lock with any manifest pin update; installed-version checks and API tests remain mandatory.
- Use PR validation plus default/release branch pushes, avoiding duplicate feature-branch push runs. Preserve manual, release and merge-queue events when present.
- Cancel superseded PR runs only; isolate manual, release and deployment runs. Keep timeouts based on measured runtime plus headroom.
- Reuse existing jobs and lock-keyed package caches when useful. Preserve retained scientific/release evidence; keep transient PR artifacts only as long as needed.
- Keep permissions least-privileged and action references immutable. Never weaken security or publish guards for cost savings.
- Record measured job runtime separately from billed usage. Do not invent savings; global billing and production changes need separate authorization.
