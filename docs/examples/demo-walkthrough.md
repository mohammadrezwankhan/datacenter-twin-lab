# Watch and reproduce the first experiment

[Open the interactive demo](https://mohammadrezwankhan.github.io/datacenter-twin-lab/) or [view a still frame](../images/demo-preview.png).

![Actual browser walkthrough](../images/demo-walkthrough.gif)

This 21-second animation contains seven unannotated screenshots from the actual application, held for three seconds each. It omits waiting, downloads, and pointer movement. It does not measure load or calculation speed. The fixture is synthetic and uncalibrated.

| Frame | What happens |
| --- | --- |
| 1 | The generator-failure preset starts with a 100 kWh battery and 1,000 kW IT demand. |
| 2 | Select depletion at 607.8 s; delivered IT power is zero. |
| 3 | Edit initial battery energy to 50 kWh. The prior completed result stays visible until the next run. |
| 4 | Run again and select depletion, now at 478.2675 s (displayed as 478.3 s). |
| 5 | Select utility recovery at 900 s; delivered IT power returns to 1,000 kW. |
| 6 | Compare 0, 50, and 100 kWh initial reserves with other inputs fixed. |
| 7 | Open the downloaded HTML report, including its input hash, assumptions, and energy ledger. |

The battery charges before the outage in this preset. The 50 kWh case reaches `50 + 100 × 0.95 × 300/3600 = 57.916666… kWh` at 300 s. It then supplies `57.916666… × 0.90 × 0.95 × 3600/1000 = 178.2675 s` of IT demand. See the [teaching notebook](battery-ride-through.ipynb) for an independent reconstruction and a case with charging disabled.

## Capture the actual application

Follow the [browser build instructions](../engineering/browser-demo.md#rebuild-and-verify). From `apps/web`, start the preview:

```sh
npx vite preview --mode demo --host 127.0.0.1 --port 4175 --strictPort
```

In a second terminal at the repository root, using Python 3.12+ and Node 24:

```sh
node apps/web/scripts/record-demo.mjs
npm --prefix .local/recording-tools install --ignore-scripts --save-exact gifenc@1.0.3 pngjs@7.0.0
node scripts/encode_demo_gif.mjs
```

Set `TWIN_PYTHON` to the Python executable if it is not on PATH. Install the Playwright browser from `apps/web` with `npx playwright install chromium` if needed. Recording requires a new `.local/demo-recording` folder; pass the preview URL and a new output directory as arguments for another take. The encoder accepts that directory as its optional first argument and writes to its `encoded` subfolder by default. An optional second argument selects a different destination. Existing output files are protected. Inspect the encoded files before deliberately replacing published documentation assets.

The capture script asserts depletion/recovery, compares both full exported runs with native Python, and checks the actual report's hash reference. It saves frame and source hashes. [The recording manifest](../images/demo-walkthrough.json) names the base revision and exact changed source files; it is scoped to this recording, not a release manifest. Fonts and browser rendering can change raster bytes across operating systems.

The optional [gifenc](https://github.com/mattdesl/gifenc) and [pngjs](https://github.com/pngjs/pngjs) packages only encode these captured pixels. They are not application or Python-wheel dependencies. No generated artwork or reconstructed interface is used in this walkthrough.
