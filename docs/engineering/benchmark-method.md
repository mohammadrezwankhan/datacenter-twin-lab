# Reviewer-facing measurements

These measurements describe execution of the `0.4.0rc1` working build on one Windows machine on 23 September 2026. They are observations, not latency targets, physical controller speeds or a scalability claim. The raw files retain every sample and the environment. Ordinary background processes were not isolated.

## Native engine

Python **3.12.14**, Windows 11, AMD64. Each case has eight assets and 180 or 181 output intervals. One warm-up is excluded; 25 timed samples include `simulate_continuity(...).to_dict()`. Import time, JSON encoding, HTTP and rendering are excluded. P95 uses the nearest rank, not an interpolated percentile.

| Synthetic preset | Median | P95 | Maximum |
| --- | ---: | ---: | ---: |
| Normal supply | 46.56 ms | 56.55 ms | 59.90 ms |
| Generator failure | 54.74 ms | 82.40 ms | 83.17 ms |
| Surviving path maintenance | 44.95 ms | 65.15 ms | 67.29 ms |

[Raw native samples and exact input hashes](../validation/native-benchmark-0.4.0rc1.json).

```sh
python scripts/benchmark_continuity.py --runs 25 --preset normal --preset generator_failure --preset path_maintenance
```

The ordinary `generator_failure` preset is measured here. The guided case disables charging and has its own input hash; do not interchange full run identities because their 100 kWh depletion numbers happen to match.

## Browser entry and replay

Chromium **153.0.8010.12**, Windows x64, 1280 × 900, unthrottled loopback Vite preview. Three isolated contexts provide cold browser caches; the OS cache may remain warm. Stopwatch intervals include automation and assertion overhead. Bytes are decoded response bodies captured through first result, including worker requests, rather than compressed network-transfer sizes.

| Observation | Three samples or measured value |
| --- | --- |
| Navigation to visible prediction controls | 830 / 798 / 823 ms |
| Run click to visible guided result | 151 / 173 / 165 ms |
| First-result decoded payload | 462,718 bytes in each sample (about 452 KiB) |
| Python, cover image or video requested before first result | None |
| Generator-failure replay | 181 precomputed intervals at 120 ms per tick; 21.72 s programmed including stop tick; 21.89 s observed including automation |

[Raw browser samples and per-resource bytes](../validation/guide-benchmark-0.4.0rc1.json). The video and poster load on the separate evidence page. Python is an optional later download. Replay is an animation of an already computed result; it is neither simulation execution time nor real-time physical behavior. These local timings cannot predict mobile or internet load times.

```sh
python scripts/prepare_browser_demo.py
npm --prefix apps/web run build:demo
npm --prefix apps/web run test:demo -- benchmark.spec.ts
```

Set `TWIN_PYTHON` to the desired Python executable when it is not on PATH. Install the pinned frontend dependencies and Playwright browser first, as in the [quickstart](../quickstart.md). The test writes a fresh `guide-benchmark.json` into its test-output directory; it does not replace this historical receipt.

## Reproducibility matrix

| Environment | Verification performed by the configured workflow |
| --- | --- |
| Ubuntu / Python 3.12 | Core, API, installed wheel, three-case packet, native timing, loopback browser journeys |
| Ubuntu / Python 3.14 | Core, API, installed wheel, three-case packet, native timing |
| Windows / Python 3.12 | Core, API, installed wheel, three-case packet, native timing |
| Windows / Python 3.14 | Core, API, installed wheel, three-case packet, native timing |
| Chromium / Ubuntu | Browser/native equality, all 24 lesson default/challenge results, optional browser-Python verification, guided journey, reports, comparisons, responsive and accessibility checks |

Inspect the [exact commit's CI runs](https://github.com/mohammadrezwankhan/datacenter-twin-lab/actions/workflows/tests.yml). Each successful matrix run retains its own `numerical-evidence-*` packet and timing artifact for 90 days. The release receipt records the actual successful run IDs; this table describes coverage and is not an assertion that an untested commit passed. Timing differences across runners do not establish a speed ranking. SHA-256 integrity and numerical reproduction are distinct from an independent person's review.

## Accessibility scope

The regression runs axe-core's WCAG 2 A/AA and 2.1 A/AA rules on the guide before and after calculation, the evidence hub, all twelve lesson themes, and advanced overview/topology/source-register states. Keyboard skip/focus, changing-result announcements, mobile fit, diagram text and reduced motion have targeted browser checks. Color alone does not carry scenario or status meaning. Automated checks are a focused engineering pass, not a complete accessibility certification or user study.
