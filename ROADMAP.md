# Roadmap

Engineering work follows reproducible user needs. Star counts are observations, not release gates or evidence of model accuracy.

## Available in this source version (0.3.0a0)

- Deterministic synthetic electrical continuity, finite battery, generator delay/failure, surviving-path limits, shared-domain failure, recovery, and exact energy accounting.
- A loopback API and dashboard, plus the same Python engine running in a static browser demo without installation or a shared simulation service.
- Five documented scenarios with diagrams, expected values, and runnable commands.
- Four bounded sensitivity parameters, JSON exports, and reproducible Markdown/HTML reports.
- Issue forms, support and conduct guidance, contribution paths, and an external-review worksheet.
- Windows/Linux numerical tests, installed-wheel checks, local browser journeys, and browser/native result equality.

The [0.2.0a0 release](https://github.com/mohammadrezwankhan/datacenter-twin-lab/releases/tag/v0.2.0a0) remains the earlier continuity/dashboard baseline. Release assets are versioned separately from current source.

## Next evidence to obtain

1. Independent external checks of the [reproducibility capsule](docs/validation/reproducibility-capsule.md), with review scope, corrections, and unresolved limitations recorded publicly.
2. First-run feedback and scenario reuse by people outside the maintainer workflow; distinguish voluntary reports from automated test activity.
3. A small educator notebook that explains one existing scenario with independently calculated expectations.
4. Repeat use, release downloads, forks, Discussions, and contributions measured with explicit sources and denominators. Demo completion remains unknown without voluntary reports; no tracking pixels or client telemetry are installed.

## Deferred until a concrete need is demonstrated

PyPI/uvx distribution, additional sweep parameters, optional public-data adapters, a stable extension API, and carefully bounded synthetic GPU/rack examples need separate contracts and provenance. 3D scenes, operational integrations, and a new fluent API do not take priority over reproducibility and first-run feedback.

A shared multi-user service, live facility telemetry, cooling/workload prediction, calibrated alarms, physical controls, and certification claims are outside the current project scope. A 5,000-star aspiration has no validated timeline and is not a reason to broaden those claims.
