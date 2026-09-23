# One minute from prediction to proof

[Watch the captioned browser recording](https://mohammadrezwankhan.github.io/datacenter-twin-lab/?mode=evidence#demo), [download the WebM](../images/proof-demo.webm), or [read the English captions](../images/proof-demo.vtt).

This is a continuous recording of the actual `0.4.0rc1` browser application at 1280 × 900. It has no audio. Deliberate reading pauses make it approximately one minute long; they are not measurements of calculation or download speed. The native result and on-demand Python result were checked during recording. The [recording receipt](../images/proof-demo-recording.json) records input identity, source-file hashes, media hashes and step times. It is maintainer verification, not outside review.

## Transcript

| Approximate time | What the viewer sees and learns |
| --- | --- |
| 0–7 s | A 1 MW IT load loses utility power. How long can 100 kWh bridge the outage? |
| 7–14 s | Predict 300 seconds **from the outage**. Charging is disabled and the generator is failed. |
| 14–22 s | Run: `100 × 0.90 × 0.95 = 85.5 kWh` delivered to IT. At 1 MW, that lasts **307.8 seconds**. |
| 22–31 s | The outage begins at 300 s, the battery empties at 607.8 s elapsed, and utility returns at 900 s. |
| 31–35 s | Export the complete JSON with exact inputs, input hash, events and interval energy ledger. |
| 35–38 s | Optional verification loads Python only when requested. |
| 38–45 s | The displayed exact match covers all inputs, hashes and calculated values. |
| 45–60 s | The evidence hub connects three reproduced cases, reports and review instructions. These are teaching calculations, not a facility reliability rating. |

## Three annotated views

![01: actual prediction controls before calculation](../images/guide-predict.png)

**01 — Predict.** The three small diagrams explain before, outage and recovery. The highlighted **100 kWh** control is the starting reserve; **300** is the learner's estimate, not a model output. Efficiencies and the charging-disabled assumption remain visible next to the controls.

![02: actual result and independent hand calculation](../images/guide-result.png)

**02 — Explain.** The large **307.8** is duration after the outage. The timeline distinguishes it from **607.8 s elapsed**. The equation accounts for both efficiencies; the adjacent ledger separates 166.667 kWh requested, 85.5 kWh served and 81.167 kWh unserved during the outage. Display values are rounded; JSON retains full strings.

![03: actual input identity and completed Python verification](../images/guide-evidence.png)

**03 — Verify.** JSON preserves the input identity. The checked optional Python control displays an actual complete-result match. Agreement between implementations establishes consistency for this example; it does not establish facility calibration or independent endorsement.

## Recreate the recording

Prepare the static app and Playwright Chromium as in the [quickstart](../quickstart.md). Serve the built demo on loopback port 4175, then run the original recording script from the repository root:

```sh
cd apps/web
npx vite preview --host 127.0.0.1 --port 4175 --strictPort --mode demo
# In another terminal at the repository root, with Python available (or TWIN_PYTHON set):
node apps/web/scripts/record-proof-demo.mjs http://127.0.0.1:4175/datacenter-twin-lab/ outputs/new-proof-recording
```

Choose a fresh output directory. The script captures real UI states, checks the exported JSON against native Python, requires the optional Python match, and emits captions and a hash receipt. It does not upload, post, or change any simulation algorithm. Original screenshots and recording are distributed with the repository's Apache-2.0 notice.
