import { useEffect, useState } from 'react';
import { ENGINE_VERSION } from './js-engine/version';
import './evidence-hub.css';

type EvidenceIndex = {
  version: string;
  manifest_path: string;
  receipt_path: string;
  cases: {
    id: string;
    title: string;
    input_sha256: string;
    run_id: string;
    run_path: string;
    scenario_path: string;
    report_path: string;
    equation: string;
    outcome: string;
  }[];
};

const repository = 'https://github.com/mohammadrezwankhan/datacenter-twin-lab';
const suppliedRevision = import.meta.env.VITE_PUBLIC_SOURCE_REVISION || '';
const revision = /^[a-f0-9]{40}$/.test(suppliedRevision) ? suppliedRevision : null;
const source = (path: string) => `${repository}/blob/${revision || 'main'}/${path}`;
const media = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export function EvidenceHub() {
  const [index, setIndex] = useState<EvidenceIndex | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch(media('evidence-index.json'), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            'The evidence index could not be loaded. Open the source evidence page below.',
          );
        const value = (await response.json()) as EvidenceIndex;
        if (value.version !== ENGINE_VERSION || value.cases?.length !== 3)
          throw new Error(
            'Evidence version does not match this build. Use the versioned source packet.',
          );
        setIndex(value);
      })
      .catch((cause: Error) => {
        if (!controller.signal.aborted) setError(cause.message);
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="evidence-hub">
      <section className="proof-intro panel" aria-label="Research assurance overview">
        <span className="eyebrow">THE PROOF PATH</span>
        <h2>Predict a number. Follow the evidence.</h2>
        <p>
          A reproducible synthetic continuity laboratory for datacenter power systems. The three
          reference cases connect a short equation to complete inputs, outputs and energy
          accounting.
        </p>
        <ol className="proof-chain">
          <li>
            <b>01</b>
            <span>State the assumptions</span>
          </li>
          <li>
            <b>02</b>
            <span>Reconstruct the arithmetic</span>
          </li>
          <li>
            <b>03</b>
            <span>Reproduce the complete run</span>
          </li>
        </ol>
        <div className="proof-links">
          <a href={source('docs/evidence.md')}>Read the evidence page ↗</a>
          <a href={`${repository}/releases/tag/v${ENGINE_VERSION}`}>
            Versioned release candidate ↗
          </a>
          <a href={`${repository}/actions/workflows/tests.yml`}>Inspect actual CI runs ↗</a>
        </div>
      </section>

      <section aria-labelledby="proof-cases-title">
        <div className="proof-section-heading">
          <span className="eyebrow">THREE HAND-CHECKABLE CASES</span>
          <h2 id="proof-cases-title">The inputs and the answer travel together.</h2>
        </div>
        {!index && !error && <p role="status">Loading the versioned evidence index…</p>}
        {error && <p role="alert">{error}</p>}
        <div className="proof-cases">
          {index?.cases.map((item, position) => (
            <article className="panel proof-case" key={item.id}>
              <span className="proof-case-number">0{position + 1}</span>
              <h3>{item.title}</h3>
              <p className="proof-outcome">{item.outcome}</p>
              <p className="proof-equation">{item.equation}</p>
              <div className="proof-links">
                <a href={source(item.scenario_path)}>Scenario JSON</a>
                <a href={source(item.run_path)}>
                  {revision ? 'Immutable result JSON' : 'Current source result JSON'}
                </a>
                <a href={media(item.report_path)}>Readable report</a>
              </div>
              <details>
                <summary>Input identity</summary>
                <p>
                  SHA-256 <code>{item.input_sha256}</code>
                </p>
                <p>
                  Run <code>{item.run_id}</code>
                </p>
              </details>
            </article>
          ))}
        </div>
        {index && (
          <p className="proof-build-note">
            Engine {index.version} ·{' '}
            {revision ? (
              <>
                published source{' '}
                <a href={`${repository}/commit/${revision}`}>{revision.slice(0, 12)}</a>; result
                links contain the full immutable commit and input hash.
              </>
            ) : (
              'Development build: immutable source links become available in the published build.'
            )}{' '}
            Custom experiments remain available through their JSON and report exports.
          </p>
        )}
      </section>

      <section className="panel proof-video" id="demo" aria-labelledby="proof-video-title">
        <div>
          <span className="eyebrow">ONE MINUTE, ONE EXPERIMENT</span>
          <h2 id="proof-video-title">Watch prediction become a checkable result.</h2>
          <p>
            An actual browser recording with English captions. The video has no audio and loads only
            when played.
          </p>
        </div>
        <video
          controls
          playsInline
          preload="none"
          poster={media('guide-preview.png')}
          aria-label="Captioned demonstration of the canonical 1 MW experiment"
        >
          <source src={media('proof-demo.webm')} type="video/webm" />
          <track
            kind="captions"
            src={media('proof-demo.vtt')}
            srcLang="en"
            label="English"
            default
          />
          <p>Read the demonstration transcript using the link below.</p>
        </video>
        <a href={source('docs/examples/proof-demo.md')}>
          Transcript, screenshot annotations and recording method ↗
        </a>
      </section>

      <section className="proof-assurance-grid" aria-label="Verification scope and review">
        <article className="panel">
          <span className="eyebrow">REPRODUCIBILITY</span>
          <h2>Run the same packet locally.</h2>
          <pre>
            <code>
              python scripts/build_evidence.py --output outputs/evidence{'\n'}python
              scripts/build_evidence.py --verify outputs/evidence
            </code>
          </pre>
          <p>
            The packet contains three scenarios, full outputs, readable reports,
            expected-versus-observed arithmetic and per-file hashes. Its checks reconstruct the
            ledger independently of the engine's reported residual.
          </p>
          <div className="proof-links">
            <a href={source('docs/validation/evidence-method.md')}>Method and tolerance</a>
            <a href={source('docs/engineering/benchmark-method.md')}>
              Measurements and supported environments
            </a>
            {index && <a href={source(index.receipt_path)}>One-page receipt</a>}
          </div>
        </article>
        <article className="panel">
          <span className="eyebrow">OUTSIDE REVIEW</span>
          <h2>Independent reproduction is welcome.</h2>
          <p>
            Current evidence is maintainer and automated engineering verification. Independent
            external technical review has not yet been received; no endorsement is implied.
          </p>
          <div className="proof-links">
            <a href={`${repository}/discussions/5`}>Use the existing review discussion</a>
            <a href={source('docs/validation/reviewer-receipt-template.md')}>
              Reviewer receipt template
            </a>
          </div>
        </article>
      </section>
      <details className="panel proof-limits">
        <summary>Model boundary, source rights and citation</summary>
        <p>
          These original teaching inputs describe assumed electrical ratings, finite energy,
          failures and recovery. They do not establish facility calibration, AC transients,
          protection, cooling, GPU jobs, grid adequacy, safety, certified uptime or physical
          control. The annual PUE planning model is separate.
        </p>
        <p>
          Original software and synthetic examples use Apache-2.0. Runtime and reference sources
          retain their notices. Cite the exact version and source revision; there is no DOI or
          external endorsement attached to this candidate.
        </p>
        <div className="proof-links">
          <a href={source('CITATION.cff')}>Citation metadata</a>
          <a href={source('data/provenance/manifest.json')}>Provenance</a>
          <a href={source('docs/third-party/README.md')}>Runtime notices</a>
          <a href={source('docs/engineering/release-readiness.md')}>Stable-release criteria</a>
        </div>
      </details>
    </div>
  );
}
