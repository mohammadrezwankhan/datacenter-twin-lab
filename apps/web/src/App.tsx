import { useEffect, useRef, useState } from 'react';
import type { Asset, Catalog, Interval, Run, SiteScenario } from './types';
import { Evidence } from './Evidence';
import { n, request } from './client';

const clock = (seconds: string | number) =>
  `${Math.floor(Number(seconds) / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(Number(seconds) % 60)
    .toString()
    .padStart(2, '0')}`;
const words = (value: string) => value.toLowerCase().replaceAll('_', ' ');

function PowerChart({
  run,
  cursor,
  onSelect,
}: {
  run: Run;
  cursor: number;
  onSelect: (index: number) => void;
}) {
  const rows = run.intervals,
    width = 940,
    height = 170,
    left = 46,
    bottom = 140;
  const ymax = Math.max(1, ...rows.map((row) => Number(row.requested_it_kw))) * 1.12;
  const x = (seconds: string | number) =>
    left + (Number(seconds) / run.scenario.duration_s) * (width - left - 16);
  const y = (kw: string | number) => bottom - (Number(kw) / ymax) * 116;
  const path = (key: 'served_it_kw' | 'requested_it_kw') =>
    rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.start_s)},${y(r[key])} H${x(r.end_s)}`).join(' ');
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="IT power over the complete run, requested and served, in kilowatts"
      className="power-chart"
    >
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={left} y1={y(f * ymax)} x2={width - 16} y2={y(f * ymax)} className="gridline" />
          <text x={left - 9} y={y(f * ymax) + 4} textAnchor="end">
            {n(f * ymax, 0)}
          </text>
        </g>
      ))}
      <path
        d={`${path('served_it_kw')} L${x(run.scenario.duration_s)},${bottom} L${left},${bottom} Z`}
        className="chart-fill"
      />
      <path d={path('served_it_kw')} className="chart-served" />
      <path d={path('requested_it_kw')} className="chart-requested" />
      {run.events
        .filter((e) => e.action.endsWith('_down') || e.action.endsWith('_up'))
        .map((e, i) => (
          <line key={i} x1={x(e.at_s)} x2={x(e.at_s)} y1={17} y2={bottom} className="eventline" />
        ))}
      <line
        x1={x(rows[cursor].start_s)}
        x2={x(rows[cursor].start_s)}
        y1={12}
        y2={bottom}
        className="cursorline"
      />
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <text
          key={f}
          x={x(f * run.scenario.duration_s)}
          y={height - 7}
          textAnchor={f === 1 ? 'end' : 'middle'}
        >
          {clock(f * run.scenario.duration_s)}
        </text>
      ))}
      <rect
        x={left}
        y={0}
        width={width - left - 16}
        height={bottom}
        fill="transparent"
        onClick={(e) => {
          const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
          const seconds =
            ((((e.clientX - rect.left) / rect.width) * width - left) / (width - left - 16)) *
            run.scenario.duration_s;
          onSelect(
            Math.max(
              0,
              rows.findLastIndex((r) => Number(r.start_s) <= seconds),
            ),
          );
        }}
      />
    </svg>
  );
}

function Topology({
  run,
  row,
  selected,
  onSelect,
}: {
  run: Run;
  row: Interval;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { assets, dependencies } = run.scenario;
  const edges = dependencies.filter((d) => d.relation === 'feeds');
  const ranks = new Map(assets.map((a) => [a.id, 0]));
  for (let i = 0; i < assets.length; i++)
    for (const d of edges)
      ranks.set(d.target, Math.max(ranks.get(d.target)!, ranks.get(d.source)! + 1));
  const maxRank = Math.max(...ranks.values(), 1);
  const groups = Array.from({ length: maxRank + 1 }, (_, r) =>
    assets.filter((a) => ranks.get(a.id) === r),
  );
  const height = Math.max(270, Math.max(...groups.map((g) => g.length)) * 94);
  const width = Math.max(1030, (maxRank + 1) * 176);
  const positions = new Map(
    assets.map((a) => {
      const r = ranks.get(a.id)!,
        group = groups[r];
      return [
        a.id,
        {
          x: 20 + (r * (width - 196)) / maxRank,
          y: ((group.indexOf(a) + 0.5) * height) / group.length - 31,
        },
      ];
    }),
  );
  return (
    <div className="topology-scroll">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ minWidth: Math.min(width, 850) }}
        className="topology"
        role="group"
        aria-label="Electrical supply topology"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {edges.map((d) => {
          const s = positions.get(d.source)!,
            t = positions.get(d.target)!,
            flow =
              row.feed_flows_kw.find((f) => f.source === d.source && f.target === d.target)?.kw ||
              '0';
          const mid = (s.x + 150 + t.x) / 2;
          return (
            <g
              key={`${d.source}-${d.target}`}
              className={Number(flow) > 0 ? 'edge active' : 'edge'}
            >
              <path
                d={`M${s.x + 150},${s.y + 31} H${mid} V${t.y + 31} H${t.x - 4}`}
                markerEnd="url(#arrow)"
              />
              <text x={mid + 4} y={(s.y + t.y) / 2 + 22}>
                {n(flow, 0)} kW
              </text>
            </g>
          );
        })}
        {assets.map((a) => {
          const p = positions.get(a.id)!,
            state = row.asset_states[a.id];
          return (
            <g
              key={a.id}
              transform={`translate(${p.x}, ${p.y})`}
              role="button"
              tabIndex={0}
              aria-label={`${a.name}: ${words(state)}`}
              onClick={() => onSelect(a.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(a.id);
                }
              }}
              className={`asset ${state} ${selected === a.id ? 'selected' : ''}`}
            >
              <rect width={150} height={62} rx={9} />
              <circle cx={14} cy={17} r={3} />
              <text className="asset-kind" x={24} y={20}>
                {words(a.kind)}
              </text>
              <text className="asset-name" x={12} y={39}>
                {a.name.length > 21 ? `${a.name.slice(0, 20)}…` : a.name}
              </text>
              <text className="asset-state" x={12} y={54}>
                {words(state)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AssetDetail({
  asset,
  row,
  onEvidence,
}: {
  asset: Asset;
  row: Interval;
  onEvidence: () => void;
}) {
  return (
    <div className="asset-detail">
      <div>
        <span className="eyebrow">Selected asset</span>
        <h3>{asset.name}</h3>
      </div>
      <div>
        <span className="detail-label">Path rating</span>
        <strong>{n(asset.capacity_kw, 0)} kW</strong>
      </div>
      <div>
        <span className="detail-label">State</span>
        <strong>{words(row.asset_states[asset.id])}</strong>
      </div>
      <div className="domains">
        <span className="detail-label">Failure domains</span>
        <span>{asset.failure_domains.join(' · ')}</span>
      </div>
      <button className="text-button" onClick={onEvidence}>
        View source ↗
      </button>
    </div>
  );
}

function Compare({ baseline, run }: { baseline: Run; run: Run }) {
  const sameService =
    baseline.scenario.currency === run.scenario.currency &&
    baseline.scenario.duration_s === run.scenario.duration_s &&
    baseline.scenario.it_demand_kw === run.scenario.it_demand_kw &&
    JSON.stringify(baseline.scenario.events.filter((e) => e.action === 'set_demand')) ===
      JSON.stringify(run.scenario.events.filter((e) => e.action === 'set_demand'));
  return (
    <section className="panel compare">
      <div className="section-title">
        <h2>Baseline comparison</h2>
        <span className="muted">
          {baseline.run_id.slice(0, 10)} → {run.run_id.slice(0, 10)}
        </span>
      </div>
      <p>
        {sameService
          ? 'Service and energy are shown together. A lower bill can reflect an interruption.'
          : 'Demand, duration, currency, or demand events differ. These runs are not a like-for-like cost comparison.'}
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Whole run</th>
              <th>Saved baseline</th>
              <th>Current run</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Served IT energy', 'served_it_kwh', 'kWh'],
              ['Unserved IT energy', 'unserved_it_kwh', 'kWh'],
              ['Grid energy', 'grid_kwh', 'kWh'],
              [
                'Incremental energy charge',
                'total_incremental_energy_charge',
                run.scenario.currency,
              ],
            ].map(([label, key, unit]) => (
              <tr key={key}>
                <td>{label}</td>
                <td>
                  {n(baseline.summary[key], 2)}{' '}
                  {key.includes('charge') ? baseline.scenario.currency : unit}
                </td>
                <td>
                  {n(run.summary[key], 2)} {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function App() {
  const [page, setPage] = useState<'overview' | 'topology' | 'evidence'>('overview');
  const [draft, setDraft] = useState<SiteScenario | null>(null),
    [run, setRun] = useState<Run | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [presets, setPresets] = useState<{ id: string; name: string }[]>([]);
  const [preset, setPreset] = useState('utility_loss'),
    [busy, setBusy] = useState(true),
    [error, setError] = useState('');
  const [cursor, setCursor] = useState(0),
    [playing, setPlaying] = useState(false),
    [selected, setSelected] = useState('it-load');
  const [baseline, setBaseline] = useState<Run | null>(null),
    [notice, setNotice] = useState('');
  const active = useRef<AbortController | null>(null);
  const dirty = !!draft && !!run && JSON.stringify(draft) !== JSON.stringify(run.scenario);
  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    (async () => {
      try {
        const [p, c, d] = await Promise.all([
          request<typeof presets>('presets', controller.signal),
          request<Catalog>('catalog', controller.signal),
          request<SiteScenario>('demo', controller.signal),
        ]);
        const r = await request<Run>('simulations', controller.signal, d);
        setPresets(p);
        setCatalog(c);
        setDraft(d);
        setRun(r);
        setBusy(false);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError((e as Error).message);
          setBusy(false);
        }
      }
    })();
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!playing || !run) return;
    const timer = window.setInterval(
      () =>
        setCursor((i) => {
          if (i >= run.intervals.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        }),
      120,
    );
    return () => window.clearInterval(timer);
  }, [playing, run]);
  async function calculate(nextPreset?: string) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    setNotice('');
    setPlaying(false);
    try {
      const scenario = nextPreset
        ? await request<SiteScenario>(
            `demo?preset=${encodeURIComponent(nextPreset)}`,
            controller.signal,
          )
        : draft!;
      const result = await request<Run>('simulations', controller.signal, scenario);
      setRun(result);
      setDraft(result.scenario);
      setCursor(0);
      setSelected('it-load');
      if (nextPreset) setPreset(nextPreset);
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function exportRun() {
    if (!run) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `twin-run-${run.run_id.slice(0, 12)}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Run exported with inputs, timeline, source IDs, and energy ledger.');
  }
  const row = run?.intervals[cursor];
  const asset = run?.scenario.assets.find((a) => a.id === selected) || run?.scenario.assets[0];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage('overview');
          }}
          aria-label="Datacenter Twin Lab home"
        >
          <span className="brand-mark">◈</span>
          <span>
            DATACENTER<span className="brand-sub">TWIN LAB</span>
          </span>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {(
            [
              ['overview', '◫', 'Overview'],
              ['topology', '⌘', 'Power topology'],
              ['evidence', '▤', 'Evidence & options'],
            ] as const
          ).map(([id, icon, label]) => (
            <button
              key={id}
              className={page === id ? 'nav-item current' : 'nav-item'}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => setPage(id)}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="status-dot" /> Local workspace
          <p>
            Synthetic reference site
            <br />
            Engine {run?.engine_version || '0.2.0a0'}
          </p>
          <span className="mini-tag">No live equipment</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            Research workspace <span>/</span> <b>Reference site 01</b>
          </span>
          <span className="mode-badge">
            <i /> SIMULATED
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">ELECTRICAL CONTINUITY LAB</div>
              <h1>
                {page === 'evidence'
                  ? 'Evidence & options'
                  : page === 'topology'
                    ? 'Power topology'
                    : 'Site overview'}
              </h1>
              <p>
                {page === 'evidence'
                  ? 'Trace each option to a source. Keep unknowns visible.'
                  : 'Explore supply interruptions across a synthetic 1 MW site.'}
              </p>
            </div>
            <div className="heading-actions">
              <button
                disabled={!run || busy}
                onClick={() => {
                  setBaseline(run);
                  setNotice('Baseline saved for this session.');
                }}
              >
                Save baseline
              </button>
              <button disabled={!run} onClick={exportRun}>
                Export run <span aria-hidden="true">↗</span>
              </button>
            </div>
          </div>
          {error && (
            <div role="alert" className="error-banner">
              {error}
              {!run && <button onClick={() => window.location.reload()}>Retry</button>}
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
            </div>
          )}
          {!run && !error && (
            <div className="panel loading" role="status">
              Preparing the reference simulation…
            </div>
          )}
          {run && row && draft && (
            <>
              {page === 'evidence' ? (
                catalog && <Evidence catalog={catalog} run={run} />
              ) : (
                <>
                  <form
                    className="panel scenario-controls"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void calculate();
                    }}
                  >
                    <label className="preset-field">
                      Scenario
                      <select
                        aria-label="Scenario"
                        value={preset}
                        onChange={(e) => void calculate(e.target.value)}
                        disabled={busy}
                      >
                        {presets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      IT demand <span>kW</span>
                      <input
                        aria-label="IT demand (kW)"
                        type="number"
                        min="0"
                        max="1000000"
                        step="any"
                        required
                        value={draft.it_demand_kw}
                        onChange={(e) => setDraft({ ...draft, it_demand_kw: e.target.value })}
                        disabled={busy}
                      />
                    </label>
                    <label>
                      Grid tariff <span>{draft.currency}/kWh</span>
                      <input
                        aria-label="Grid tariff"
                        type="number"
                        min="0"
                        step="any"
                        value={draft.tariff_per_kwh ?? ''}
                        placeholder="Unknown"
                        onChange={(e) =>
                          setDraft({ ...draft, tariff_per_kwh: e.target.value || null })
                        }
                        disabled={busy}
                      />
                    </label>
                    <label>
                      Initial battery <span>kWh</span>
                      <input
                        aria-label="Initial battery (kWh)"
                        type="number"
                        min="0"
                        max={draft.battery_capacity_kwh}
                        step="any"
                        required
                        value={draft.battery_initial_kwh}
                        onChange={(e) =>
                          setDraft({ ...draft, battery_initial_kwh: e.target.value })
                        }
                        disabled={busy}
                      />
                    </label>
                    <label>
                      Generator delay <span>s</span>
                      <input
                        aria-label="Generator delay (seconds)"
                        type="number"
                        min="0"
                        max="86400"
                        required
                        value={draft.generator_start_delay_s}
                        onChange={(e) =>
                          setDraft({ ...draft, generator_start_delay_s: Number(e.target.value) })
                        }
                        disabled={busy}
                      />
                    </label>
                    <button className="primary" type="submit" disabled={busy}>
                      {busy ? 'Calculating…' : 'Run scenario'} <span aria-hidden="true">→</span>
                    </button>
                  </form>
                  <div className="run-context" role="status">
                    <span>
                      {dirty
                        ? 'Unapplied edits · results below belong to the last completed run'
                        : `${run.scenario.name} · ${n(run.scenario.it_demand_kw, 0)} kW demand · ${run.scenario.duration_s / 60} min`}
                    </span>
                    <span className="mono" data-testid="run-id">
                      RUN {run.run_id.slice(0, 12)}
                    </span>
                  </div>
                  <div className="kpi-grid">
                    <div className="kpi">
                      <span className="kpi-label">
                        Delivered IT power <b className="accent">↗</b>
                      </span>
                      <div className="kpi-value" data-testid="served-power">
                        {n(row.served_it_kw)} <small>kW</small>
                      </div>
                      <span className="kpi-foot">
                        {n(row.requested_it_kw, 0)} kW requested at {clock(row.start_s)}
                      </span>
                    </div>
                    <div className="kpi">
                      <span className="kpi-label">
                        Electrical source power <b>ϟ</b>
                      </span>
                      <div className="kpi-value" data-testid="source-power">
                        {n(row.electrical_source_kw)} <small>kW</small>
                      </div>
                      <span className="kpi-foot">Grid + generator + battery discharge</span>
                    </div>
                    <div className="kpi">
                      <span className="kpi-label">
                        Stored battery energy <b>▰</b>
                      </span>
                      <div className="kpi-value" data-testid="battery-energy">
                        {n(row.battery_end_kwh, 2)} <small>kWh</small>
                      </div>
                      <span className="kpi-foot">
                        At interval end · {n(run.scenario.battery_capacity_kwh, 0)} kWh capacity
                      </span>
                    </div>
                    <div className="kpi">
                      <span className="kpi-label">
                        Grid energy charge <b>◎</b>
                      </span>
                      <div className="kpi-value" data-testid="grid-cost">
                        {n(row.grid_energy_charge_to_date, 2)}{' '}
                        <small>{run.scenario.currency}</small>
                      </div>
                      <span className="kpi-foot">
                        Through {clock(row.end_s)} · illustrative tariff
                      </span>
                    </div>
                  </div>
                  <section className="panel power-panel">
                    <div className="section-title">
                      <div>
                        <h2>Supply paths</h2>
                        <span className="muted">
                          Select an asset to inspect its rating, state, and dependencies.
                        </span>
                      </div>
                      <span className="pill">
                        {run.scenario.assets.length} assets ·{' '}
                        {run.scenario.dependencies.filter((d) => d.relation === 'feeds').length}{' '}
                        feeds
                      </span>
                    </div>
                    <Topology run={run} row={row} selected={selected} onSelect={setSelected} />
                    {asset && (
                      <AssetDetail asset={asset} row={row} onEvidence={() => setPage('evidence')} />
                    )}
                    {page === 'topology' && (
                      <div className="dependency-list">
                        <h3>Declared relationships</h3>
                        <p>
                          Feed arrows show gross electrical kW. The charge connection shares
                          available utility capacity and does not feed itself. Requires dependencies
                          propagate availability.
                        </p>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Source</th>
                                <th>Relationship</th>
                                <th>Target</th>
                              </tr>
                            </thead>
                            <tbody>
                              {run.scenario.dependencies.map((d, i) => (
                                <tr key={i}>
                                  <td>{d.source}</td>
                                  <td>{d.relation}</td>
                                  <td>{d.target}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </section>
                  <div className="analysis-grid">
                    <section className="panel timeline-panel">
                      <div className="section-title">
                        <div>
                          <h2>Power through the event</h2>
                          <span className="muted">IT power, kW · relative simulation time</span>
                        </div>
                        <div className="legend">
                          <span className="served-key">Served</span>
                          <span className="request-key">Requested</span>
                        </div>
                      </div>
                      <PowerChart
                        run={run}
                        cursor={cursor}
                        onSelect={(i) => {
                          setPlaying(false);
                          setCursor(i);
                        }}
                      />
                      <div className="replay">
                        <button
                          aria-label={playing ? 'Pause replay' : 'Play replay'}
                          onClick={() => {
                            if (cursor === run.intervals.length - 1) setCursor(0);
                            setPlaying(!playing);
                          }}
                        >
                          {playing ? 'Ⅱ' : '▶'}
                        </button>
                        <span className="mono">{clock(row.start_s)}</span>
                        <input
                          aria-label="Replay interval"
                          type="range"
                          min={0}
                          max={run.intervals.length - 1}
                          value={cursor}
                          onChange={(e) => {
                            setPlaying(false);
                            setCursor(Number(e.target.value));
                          }}
                        />
                        <span className="mono">{clock(run.scenario.duration_s)}</span>
                      </div>
                      <div className="timeline-footer">
                        <span>
                          Interval {cursor + 1} / {run.intervals.length} · {n(row.duration_s, 3)} s
                        </span>
                        <span>Precomputed replay · 1 interval / 120 ms</span>
                      </div>
                    </section>
                    <section className="panel event-panel">
                      <div className="section-title">
                        <h2>Events & warnings</h2>
                        <span className="pill">{run.events.length} events</span>
                      </div>
                      <div className="warnings" data-testid="warnings">
                        {row.warnings.length ? (
                          row.warnings.map((w) => (
                            <div className="warning" key={w}>
                              △ {words(w)}
                            </div>
                          ))
                        ) : (
                          <div className="clear-state">✓ No warnings in this interval</div>
                        )}
                      </div>
                      <div className="events">
                        {run.events.length ? (
                          run.events.map((e, i) => (
                            <button
                              className="event"
                              key={i}
                              onClick={() => {
                                setPlaying(false);
                                setCursor(
                                  Math.max(
                                    0,
                                    run.intervals.findLastIndex(
                                      (r) => Number(r.start_s) <= Number(e.at_s),
                                    ),
                                  ),
                                );
                              }}
                            >
                              <time>{clock(e.at_s)}</time>
                              <span>
                                {words(e.action)}
                                <small>{e.target || 'Automatic generator sequence'}</small>
                              </span>
                              <b>↗</b>
                            </button>
                          ))
                        ) : (
                          <p className="muted">No scheduled failures in this scenario.</p>
                        )}
                      </div>
                    </section>
                  </div>
                  <section className="panel outcome">
                    <div>
                      <span className="eyebrow">WHOLE RUN OUTCOME</span>
                      <h2
                        className={
                          Number(run.summary.unserved_it_kwh) > 0 ? 'danger-text' : 'accent'
                        }
                      >
                        {Number(run.summary.unserved_it_kwh) > 0
                          ? 'Demand was not fully served'
                          : 'Demand served throughout'}
                      </h2>
                    </div>
                    <div>
                      <span>Unserved IT energy</span>
                      <strong data-testid="unserved-energy">
                        {n(run.summary.unserved_it_kwh, 2)} kWh
                      </strong>
                    </div>
                    <div>
                      <span>Incremental energy charge</span>
                      <strong>
                        {n(run.summary.total_incremental_energy_charge, 2)} {run.scenario.currency}
                      </strong>
                    </div>
                    <div>
                      <span>Energy balance residual</span>
                      <strong>{n(run.summary.energy_balance_residual_kwh, 5)} kWh</strong>
                    </div>
                  </section>
                  {baseline && <Compare baseline={baseline} run={run} />}
                  <details className="panel assumptions">
                    <summary>
                      Model boundary & run evidence <span>Synthetic · uncalibrated</span>
                    </summary>
                    <p>{run.boundary}</p>
                    <ul>
                      {run.limitations.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                    <p>
                      Source IDs: {run.scenario.source_ids.join(', ')}. Input SHA-256:{' '}
                      <code>{run.input_sha256}</code>
                    </p>
                    <button onClick={() => setPage('evidence')}>Open evidence register ↗</button>
                  </details>
                </>
              )}
            </>
          )}
          <footer className="footer">
            <span>Datacenter Twin Lab</span>
            <span>Synthetic planning · uncalibrated · electrical boundary only</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
