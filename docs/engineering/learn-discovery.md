# Learn discovery and model explanations

The [learning index](https://khanlab.co.technology/learn/) is a static reading page with optional, small JavaScript enhancements. It does not load React, Python, NumPy, SciPy or a simulation worker. Following **Run experiment** opens the existing numerical application; its own explicit runtime controls govern scientific downloads.

## Content contract

`apps/web/learn-manifest.ts` builds a learning-content manifest from the existing course definitions and study introductions. This is separate from the scenario catalogue and from input/result manifests.

- **12 continuity-course lessons**, in the original sequence. The final PUE lesson has the distinct `annual-pue` model family.
- **1 separate EMT study**, with its own DC-link circuit.
- **5 power-dynamics studies**, sharing one canonical overview and using five distinct runtime query destinations.

The combined count is 18 learning items. The 18 continuity scenario presets are a different inventory. No difficulty, completion time, certification, independent review or learner-completion claim is inferred from either count.

The generated `learn/manifest.json` records stable IDs, source prose, reviewed topic terms, model families, destinations, source-file hashes and a content hash. Source hashes use UTF-8 with CRLF normalized to LF, matching repository text across Windows and Linux. They cover the listed source files, not every transitive numerical dependency. `contentSha256` hashes the UTF-8 JSON representation of the content fields before `sourceFiles` and `contentSha256` are added. `sourceRevision` is the declared full public commit, or null when a local build does not declare it.

Manifest overview/runtime paths begin with `/` and are relative to the site's deployment base. Evidence links beginning with `/` address public site records; other evidence links are repository paths at `sourceRevision`. This permits the same complete artifact to work at a custom-domain root or the historical repository subpath. Historical release assets retain their original identity.

## Progressive discovery

All cards, descriptions, ordinary guide links and runtime links are generated HTML. Without JavaScript, three pathway links jump to the corresponding complete collection. With JavaScript, topic search and pathway filters update visible cards, a restrained result count, and the `q`/`path` URL parameters. Back/Forward restores the selection; unknown paths fall back to all items. Text is treated as text, never evaluated as HTML. The page adds no cookies, local-storage records, analytics or external inference calls.

The plain-text reading export omits interface controls and repeated screen-reader link context. Teaching prose and model assumptions remain present, with all eighteen canonical page sections checked against the 60 KiB limit, including builds with a full source revision.

`learn.css` applies only to the index. The cream/forest editorial styling is a Learn-specific design, not a change to numerical dashboards or lesson-result formatting. Existing lesson and study prose, source notices, canonical URLs, data downloads and runtime settings remain separate preservation dependencies.

## Illustrative systems

The HTML/SVG module offers continuity, EMT and dynamics views, each with Physical, Model, Verification and Decision disclosures. These reveal authored explanations immediately, without generated reasoning or pretend token streaming. The circuit and relationship maps are labeled illustrations, not numerical result replays.

The continuity path block is explicitly aggregated. The EMT capacitor and resistive load occupy parallel branches. The dynamics view is a relationship map across multiple formulations, not a single wiring diagram. Explanations distinguish annual energy from outage accounting, integration from output samples, per-unit bases from MW, convergence from calibration and power flow from dynamic stability.

Rotate/reset and a single three-second flow illustration are user-triggered. Pause/reset, leaving the viewport, hiding the page or changing model stops motion. Reduced-motion and data-saving preferences select a static view. Native disclosures, textual diagram summaries, visible focus, 48px primary targets, forced-colors styling and no-JavaScript reading do not depend on GPU acceleration. No WebGL library is required.

## Checks and release

Use the full browser-demo build documented in [browser-demo.md](browser-demo.md), including pinned runtime preparation. The ordinary dashboard build is not a substitute for the full public site artifact.

`tests-engine/learn-manifest.test.ts` verifies counts, destinations, original text and hash rules. `tests-demo/learn-discovery.spec.ts` covers discovery/history, no-JavaScript links, runtime deferral, lenses, animation, responsive targets, automated accessibility checks and the 35 KiB gzip ceiling for added discovery JavaScript. This budget is not the size of the numerical application or optional scientific packages. Existing search-page, numerical parity, input validation, worker cancellation, exports and solver tests remain required.

Production publication uses the merged source's complete `public-browser-bundle`, retaining the previous full artifact and hosting deployment for rollback. Lab browser checks are not field Core Web Vitals, manual assistive-technology testing, external technical review or facility validation. Numerical release and source versions must not be relabeled as those claims.
