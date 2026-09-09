# Battery ride-through notebook

[`battery-ride-through.ipynb`](battery-ride-through.ipynb) is a deterministic first-run teaching example for the bundled `generator_failure` scenario. It derives the 100 kWh ride-through (`307.8 s`) and absolute depletion (`607.8 s`), then compares the charging-enabled and charging-disabled 50 kWh cases.

From the repository root, use an isolated Python 3.12+ environment and install the notebook runner:

```sh
python -m pip install nbconvert ipykernel
python -m jupyter nbconvert --execute --to notebook --inplace docs/examples/battery-ride-through.ipynb
```

Use the same environment for both commands. The notebook can also be opened in JupyterLab or a notebook-capable editor; restart its kernel and run all cells from the top.

The notebook uses only the standard library and the local `datacenter_twin` package for computation. Its outputs include the engine version, actual scenario input SHA-256 digests, and exact assertions. Jupyter is optional for the package itself. The model is synthetic and uncalibrated; it does not size equipment, estimate a facility's reliability, or produce a complete cost model.
