import { useRef, useState, useEffect } from 'react';
import type { Catalog, Run } from './types';
import { n, request } from './client';

const readable = (s: string) => s.replaceAll('_', ' ');
function Sources({ ids }: { ids: string[] }) {
  return (
    <div className="source-links">
      {ids.map((id) => (
        <a key={id} href={`#source-${id}`}>
          {id} ↗
        </a>
      ))}
    </div>
  );
}

interface Quote {
  cost: string | null;
  currency: string;
  billed_units: string;
  billing_unit: string;
  normalized_node_hour_rate: string | null;
  provisioned_gpu_hour_rate: string | null;
  price_status: string;
}

export function Evidence({ catalog, run }: { catalog: Catalog; run: Run }) {
  const [offer, setOffer] = useState(catalog.cloud_offers[0].id),
    [rate, setRate] = useState(''),
    [hours, setHours] = useState('1'),
    [nodes, setNodes] = useState('1');
  const [result, setResult] = useState<Quote | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const selected = catalog.cloud_offers.find((o) => o.id === offer)!;
  const allSources = [
    ...new Set([...run.scenario.source_ids, ...run.scenario.assets.flatMap((a) => a.source_ids)]),
  ];
  const unresolved = allSources.filter((id) => !catalog.sources.some((s) => s.id === id));
  const unit = selected.billing_unit === 'gpu_hour' ? 'GPU-hour' : 'node-hour';
  const invalidate = () => {
    setResult(null);
    setError('');
  };
  async function normalize() {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(
        await request<Quote>('quotes/normalize', current.signal, {
          offer_id: offer,
          node_count: Number(nodes),
          billed_hours: hours,
          assumed_rate: rate || null,
        }),
      );
    } catch (e) {
      if (!current.signal.aborted) setError((e as Error).message);
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      <section className="panel evidence-note">
        <strong>Evidence reviewed {catalog.reviewed_on} · no calibration claimed</strong>
        <p>
          Specifications describe candidate options. The current electrical run uses the synthetic
          reference assumptions below. Workload throughput, real-site performance and commercial
          capacity are unverified.
        </p>
        <Sources ids={allSources} />
        {unresolved.length > 0 && (
          <p className="danger-text">
            Unresolved source IDs: {unresolved.join(', ')}. Attach supporting evidence before using
            these assumptions for a decision.
          </p>
        )}
      </section>
      <h2 className="evidence-section-title">Hardware reference options</h2>
      <div className="model-grid">
        {catalog.hardware.map((h) => (
          <section className="panel option-card" key={h.id}>
            <span className="eyebrow">{h.vendor} · VENDOR SPECIFICATION</span>
            <h3>{h.sku}</h3>
            <div className="option-meta">
              <span>Accelerators</span>
              <strong>
                {h.gpu_count} × {h.gpu}
              </strong>
              <span>Aggregate GPU memory</span>
              <strong>{n(h.gpu_memory_total_gb, 0)} GB</strong>
              <span>Maximum system power</span>
              <strong>{h.max_system_power_kw} kW</strong>
              <span>Chassis</span>
              <strong>{h.rack_units}U</strong>
              <span>Purchase price</span>
              <strong className="empty-rate">Unknown</strong>
            </div>
            <p>
              Maximum power is a specification. It is not a measured workload power curve or a count
              of nodes supported by this site.
            </p>
            <Sources ids={h.source_ids} />
          </section>
        ))}
      </div>
      <h2 className="evidence-section-title">Cloud offering register</h2>
      <div className="evidence-grid">
        {catalog.cloud_offers.map((o) => (
          <section className="panel option-card" key={o.id}>
            <span className="eyebrow">{o.provider} · DOCUMENTED SHAPE</span>
            <h3>{o.sku}</h3>
            <div className="option-meta">
              <span>Accelerators</span>
              <strong>
                {o.gpu_count} × {o.gpu}
              </strong>
              <span>Aggregate GPU memory</span>
              <strong>
                {n(o.gpu_memory_total, 0)} {o.gpu_memory_unit}
              </strong>
              <span>Comparison unit</span>
              <strong>{readable(o.billing_unit)}</strong>
              <span>Region / availability</span>
              <strong>{o.region || 'Unselected'} / unverified</strong>
              <span>{o.rate === null ? 'Numeric rate' : 'Retail snapshot'}</span>
              <strong className={o.rate === null ? 'empty-rate' : ''}>
                {o.rate === null ? 'Unknown' : `${n(o.rate, 3)} ${o.currency}/hour`}
              </strong>
            </div>
            {o.rate !== null && (
              <p>
                Observed {o.observed_on}; effective {o.effective_from?.slice(0, 10)}. Base
                non-Windows Consumption meter. Recheck before purchasing.
              </p>
            )}
            {o.billing_status !== 'documented' && (
              <p>Whole-VM hourly basis requires verification against a selected regional meter.</p>
            )}
            <Sources ids={o.source_ids} />
          </section>
        ))}
      </div>
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Normalize a rate assumption</h2>
            <span className="muted">
              Use already-billed hours. This calculation is separate from the electrical run.
            </span>
          </div>
          <span className="pill">USD · assumption only</span>
        </div>
        <form
          className="quote-form"
          onSubmit={(e) => {
            e.preventDefault();
            void normalize();
          }}
        >
          <label>
            Offering
            <select
              aria-label="Cloud offering"
              value={offer}
              disabled={busy}
              onChange={(e) => {
                setOffer(e.target.value);
                setRate('');
                invalidate();
              }}
            >
              {catalog.cloud_offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.provider} · {o.sku}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nodes
            <input
              aria-label="Cloud node count"
              type="number"
              min="1"
              max="100000"
              step="1"
              required
              value={nodes}
              disabled={busy}
              onChange={(e) => {
                setNodes(e.target.value);
                invalidate();
              }}
            />
          </label>
          <label>
            Billed hours / node
            <input
              aria-label="Billed hours per node"
              type="number"
              min="0"
              step="any"
              required
              value={hours}
              disabled={busy}
              onChange={(e) => {
                setHours(e.target.value);
                invalidate();
              }}
            />
          </label>
          <label>
            Assumed USD / {unit}
            <input
              aria-label="Assumed cloud rate"
              type="number"
              min="0"
              step="any"
              value={rate}
              placeholder="Unknown"
              disabled={busy}
              onChange={(e) => {
                setRate(e.target.value);
                invalidate();
              }}
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? 'Calculating…' : 'Calculate'}
          </button>
        </form>
        {selected.rate !== null && (
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => {
              setRate(selected.rate!);
              invalidate();
            }}
          >
            Use {selected.observed_on} retail snapshot as an assumption ↗
          </button>
        )}
        {error && (
          <p role="alert" className="danger-text">
            {error}
          </p>
        )}
        {result && (
          <div className="quote-result" role="status" data-testid="quote-result">
            <strong>
              {n(result.cost, 2)} {result.currency}
            </strong>{' '}
            · {n(result.billed_units, 3)} {readable(result.billing_unit)} units
            <p>
              Normalized node rate: {n(result.normalized_node_hour_rate, 4)} USD/hour · provisioned
              GPU rate: {n(result.provisioned_gpu_hour_rate, 4)} USD/hour.
            </p>
            <p>
              {result.price_status === 'unknown'
                ? 'No price provided. Unknown is preserved.'
                : 'Calculated from your assumption. This is not a fetched vendor quote.'}
            </p>
          </div>
        )}
        <p className="assumption-text">
          AWS and Azure whole-node rates are charged once per node-hour. OCI GPU-hour rates multiply
          by eight GPUs per node. Hours exclude invoice minimums, rounding and non-compute charges.
          Provisioned GPU hours do not measure delivered workload or support a performance ranking.
        </p>
      </section>
      <h2 className="evidence-section-title">Model deployment routes</h2>
      <div className="evidence-grid">
        {catalog.models.map((m) => (
          <section className="panel option-card" key={m.id}>
            <span className="eyebrow">{m.provider}</span>
            <h3>{m.exact_model}</h3>
            <span className="pill">{readable(m.deployment_route)}</span>
            <p>
              {m.weights_license
                ? `Published weights license: ${m.weights_license}. Review the selected weight revision and obligations before deployment.`
                : 'API route documented. A downloadable weights license and self-hosting permission are not established by this source.'}
            </p>
            <p>Measured throughput and deployment suitability: unknown.</p>
            <Sources ids={m.source_ids} />
          </section>
        ))}
      </div>
      <h2 className="evidence-section-title">Jurisdiction screening</h2>
      <div className="evidence-grid">
        {catalog.jurisdictions.map((j) => (
          <section className="panel option-card jurisdiction-card" key={j.id}>
            <span className="eyebrow">APPLICABILITY REQUIRES PROJECT REVIEW</span>
            <h3>{j.name}</h3>
            <span className="pill">{j.instrument}</span>
            <p>{j.screening_question}</p>
            <p>{j.decision}</p>
            <Sources ids={j.source_ids} />
          </section>
        ))}
      </div>
      <section className="panel">
        <div className="section-title">
          <h2>Source register</h2>
          <span className="pill">
            {catalog.sources.length} records · links, not copied publications
          </span>
        </div>
        {catalog.sources.map((s) => (
          <article className="source-record" id={`source-${s.id}`} key={s.id}>
            <code>{s.id}</code>
            <h3>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title} ↗
                </a>
              ) : (
                s.title
              )}
            </h3>
            <p>{s.claim}</p>
            <p>
              <b>Limit:</b> {s.limitations}
            </p>
            <p>
              Locator: {s.locator} · reviewed {s.retrieved_on} · {readable(s.evidence_type)}
            </p>
          </article>
        ))}
      </section>
    </>
  );
}
