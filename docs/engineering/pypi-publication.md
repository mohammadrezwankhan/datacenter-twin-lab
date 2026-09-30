# Core package publication

The requested PyPI distribution name is `datacenter-twin`; the Python import and
CLI remain `datacenter_twin` and `datacenter-twin`. Earlier GitHub release wheels
named `datacenter-twin-lab` remain unchanged. Do not install both distributions
into the same environment, because they provide the same import package.

The initial PyPI build is the dependency-free core from a clean public checkout.
It includes the numerical source and optional API/scientific extras; it does not
bundle the compiled local web dashboard. Use https://khanlab.co.technology/ for
the interactive course. The package metadata links back to that website.

`.github/workflows/publish-pypi.yml` is manually dispatched on public `main`.
It requires successful full CI for that exact commit, builds one wheel, installs
it into a fresh environment outside the checkout, exercises the module and CLI,
checks metadata, and records the source SHA and wheel SHA-256. The publish job
has no source checkout and consumes only that verified wheel artifact. It uses
short-lived PyPI trusted publishing, scoped to this repository, workflow file
and the `pypi` environment; no long-lived upload token is stored in GitHub.

Publisher configuration in the package owner's PyPI account:

| Field | Exact value |
| --- | --- |
| PyPI project | `datacenter-twin` |
| GitHub owner | `mohammadrezwankhan` |
| Repository | `datacenter-twin-lab` |
| Workflow filename | `publish-pypi.yml` |
| Environment | `pypi` |

The workflow and package preparation are not a publication receipt. Only a
successful PyPI upload, matching public file hashes, and a fresh installation
from PyPI establish publication. Existing GitHub release downloads remain the
fallback until that verification is recorded. A claimed project name or an
authentication prerequisite must be resolved before upload; do not reuse another
owner's project or overwrite an existing release.

After publication, verify in a new environment:

```sh
python -m pip install datacenter-twin
datacenter-twin simulate --preset generator_failure
```

The example reports battery depletion at elapsed 607.8 s and exact zero energy
balance residual for its stated synthetic scenario. A successful installation
is package QA, not outside adoption or facility validation.

References checked 1 October 2026: [PyPI trusted publishing](https://docs.pypi.org/trusted-publishers/),
[publisher configuration](https://docs.pypi.org/trusted-publishers/adding-a-publisher/).
