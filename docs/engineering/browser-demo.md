# Browser demo

Open the [50 MW outage experiment](https://mohammadrezwankhan.github.io/datacenter-twin-lab/) and change the reserve, or follow [twelve browser lessons](../tutorials/power-systems-course.md). The first result uses the local JavaScript continuity engine. **Verify against Python** explicitly loads the reference Python engine when you want a second calculation.

The JavaScript port uses exact rational arithmetic for dispatch and accounting, then matches Python's 100-digit decimal formatting, canonical inputs and result hashes. It handles the bounded topology contract, including max-flow, charging, generator delay, shared failures and event boundaries. It does not use a preset lookup table of precomputed results. Reports, sensitivity and the separate PUE exercise also calculate locally.

Both engines run in Web Workers. The optional Python check uses pinned Pyodide 314.0.6 (CPython 3.14.2). The Python source archive has an explicit per-file manifest and a checked SHA-256 digest. Equality checks compare the complete result: normalized inputs, hashes, interval ledger, warnings and event times. A mismatch is an error; it cannot produce a successful verification badge. A failed optional download leaves the completed JavaScript result available and offers retry.

The browser compares the downloaded archive with its manifest's archive digest. Per-file hashes are audit metadata, not separate browser checks; they describe archived text after CRLF-to-LF normalization. Compare normalized source bytes when auditing on Windows. These hashes detect mismatched files and do not replace trust in the host serving both archive and manifest.

## First experiment

The opening generator-failure case loses utility and generator availability at 300 s and restores utility at 900 s. With 5,000 kWh initial battery energy in the 50 MW case, depletion occurs at 607.8 s. Change **Initial battery** to **2,500 kWh** and run again. Depletion moves to **478.2675 s**, displayed as 478.3 s: the battery charges during the first 300 s while utility is available. Its outage-opening balance is `2500 + 5000 × 0.95 × 300/3600 = 2895.833333... kWh`; ride-through is that balance times `0.90 × 0.95 × 3600/50000`, giving `178.2675 s`.

Use the event buttons to inspect failure and recovery, export JSON, download a Markdown/HTML report, or compare empty/half/full initial reserves. Reports use the last completed scenario; unapplied edits are labeled. For a simpler hand calculation with charging disabled, use the [reproducibility capsule](../validation/reproducibility-capsule.md).

## Observed first result

The [12 September local observation](../validation/browser-entry-measurement.json) recorded **322,816 decoded response bytes** for the first 50 MW result, including a **42,262-byte JavaScript worker**, and **605 ms** from navigation to the displayed result. This was one fresh Chromium context against loopback Vite on Windows, with no network or CPU throttling. It is not a compressed transfer size or a promise of visitor latency. The test confirms no Pyodide, Python archive, catalog or cover request on this path.

## Privacy and limits

The first result does not request Pyodide, the Python source archive or the cover image. The optional verifier downloads about 14 MB the first time; browser cache can reduce later transfers. The browser test writes a timestamped `first-result-measurement.json` listing observed decoded response sizes and local time to result. Its 600,000-byte regression budget covers the default journey; local timing is not a claim about every visitor or network. All runtime assets come from the same site. The application sends no scenario inputs, exports, completion events, cookies, or analytics identifiers to a server. Host request logs are governed by [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). Browser extensions and local filtering software may make their own requests; they are outside the application.

There is no automatic collection of demo completion or repeat use. Those metrics remain unknown unless someone voluntarily reports a reproducible journey. Browser execution uses the same bounded scenario contract (including a 4 MiB request limit and bounded simulation size), plus a 90-second worker deadline. A deadline terminates the worker and reports an actionable error. Closing/reloading the page discards workspace state. Downloads happen only when requested. There is no service worker or offline-install guarantee.

Results remain synthetic and uncalibrated. This does not establish facility safety, cooling or workload performance, AC transients, protection coordination, certified uptime, or live controls. No login or sensitive inputs are required.

## Rebuild and verify

Use Python 3.12+ and Node 24 from the repository root:

```sh
npm --prefix apps/web ci --ignore-scripts
python scripts/prepare_browser_demo.py
npm --prefix apps/web run test:engine
npm --prefix apps/web run build:demo
npm --prefix apps/web exec playwright install chromium
npm --prefix apps/web run test:demo
```

If Python is not on PATH, set `TWIN_PYTHON` to its executable before the browser tests. The build lives in `.local/browser-demo-site` and uses the `/datacenter-twin-lab/` base path. From `apps/web`, run `npx vite preview --mode demo --host 127.0.0.1 --port 4174` and open `http://127.0.0.1:4174/datacenter-twin-lab/`. Stop that preview before running `test:demo`, which starts its own server on the same port.

The HTML entry includes a readable example and Python/documentation links before scripts load. If JavaScript is disabled, it explicitly directs visitors to those alternatives; it does not claim the interactive simulation works without JavaScript. Seven presets and all twelve default/challenge lesson pairs are checked against native Python. Phone-width and JavaScript-disabled journeys, optional Python verification, corruption/retry and default network requests are checked as well. The [recorded walkthrough](../examples/demo-walkthrough.md) provides a small visual preview and a text transcript.

`npm run build` in `apps/web` still produces the small loopback dashboard for the Python wheel. It does not include the browser Python runtime. See [third-party notices](../third-party/README.md) and the pinned dependency lockfile. The static deployment workflow requires native tests, JavaScript/native differential checks and browser journeys before uploading an artifact. These are maintainer software checks, not an independent external technical review.
