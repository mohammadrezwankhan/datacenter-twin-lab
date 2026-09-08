# Contributing

Useful first contributions are independently derived numerical edge cases, reproducible mismatches, and dated primary-source corrections. Explain the input assumptions, units, expected result, observed result, and exact revision. Discuss a bounded subsystem change in an issue before expanding the model.

```sh
python -m unittest discover -s tests -v
npm --prefix apps/web run build
```

The [quickstart](docs/quickstart.md) covers locked optional dependencies and browser journeys. The core uses only the Python standard library. Numerical changes require an independent derivation, not only an updated snapshot. Keep unavailable values explicit and separate synthetic assumptions from equipment specifications or measured evidence.

Original contributions use Apache-2.0. Preserve third-party notices and identify data rights. Do not contribute private manuals, licensed standards text, credentials, or customer traces. No physical controls, calibrated facility claims, or public shared-service deployment belong in this alpha's existing boundary.
