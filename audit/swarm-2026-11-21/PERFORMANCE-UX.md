# Browser, performance and accessibility evidence

- Existing source: dedicated JS worker for initial calculations and optional separate Pyodide/Python worker loaded only on visitor action (`docs/engineering/browser-demo.md`, `apps/web/src/worker-request.ts`).
- **Historical only:** a 2026-09-12 unthrottled Windows loopback observation documented 322,816 decoded first-result bytes and 605 ms to displayed result. Neither is a current compressed transfer, field performance, or claim about production.
- **Documented only:** optional Python verifier downloads approximately 14 MB on first request. This is Pyodide/scientific runtime, **not** a <500 KB first-party WASM payload.
- Existing automated browser tests include viewport and accessibility suites; the last baseline browser/Python parity CI succeeded on 2026-11-19. No current screenshots were generated or inspected here.
- Live HTML at `https://khanlab.co.technology/` and `/learn/` was retrievable read-only; execution and response-header inspection not performed.
- **NOT_VERIFIED:** viewport screenshots at requested 375/390/430/768/1024/1440/1920 widths, 200% zoom, axe runtime output, memory/worker leak traces, actual gzipped WASM/JS bytes, LCP, field INP, CLS, 60-fps percentiles, 50-ms long tasks, 8,760-hour workload (if supported).
- Any benchmark target requires a tested browser, test hardware, network profile and repeat count; no current numeric score is asserted.
