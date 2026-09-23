import type { CSSProperties } from 'react';
import { facilityProfiles, scenarioModes } from './facility-profiles';
import type { Run, SiteScenario } from './types';
import { n } from './client';

export function ScenarioMilestones({
  run,
  onSelect,
}: {
  run: Run;
  onSelect: (at: number) => void;
}) {
  const utility = run.scenario.assets.find((asset) => asset.kind === 'utility')?.id;
  const failure = run.events.find(
    (event) => event.action === 'asset_down' && event.target === utility,
  );
  const recovery = run.events.find(
    (event) => event.action === 'asset_up' && event.target === utility,
  );
  const depletion = run.events.find((event) => event.action === 'battery_depleted');
  const markers: { label: string; at: string }[] = failure
    ? [
        { label: 'Supply fails', at: failure.at_s },
        ...(depletion ? [{ label: 'Battery depleted', at: depletion.at_s }] : []),
        ...(recovery ? [{ label: 'Utility recovers', at: recovery.at_s }] : []),
      ]
    : run.events
        .filter((event) => event.action === 'set_demand')
        .map((event, index) => ({ label: `Demand step ${index + 1}`, at: event.at_s }));
  if (!markers.length) return null;
  return (
    <section className="scenario-milestones" aria-label="Scenario milestones">
      <div className="demo-stages">
        {markers.map((marker) => (
          <button key={`${marker.label}-${marker.at}`} onClick={() => onSelect(Number(marker.at))}>
            {marker.label}
            <strong>{n(marker.at, 1)} s</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

export function FacilitySelector({
  preset,
  busy,
  onSelect,
}: {
  preset: string;
  busy: boolean;
  onSelect: (preset: string) => void;
}) {
  const profile = facilityProfiles.find((item) => Object.values(item.presets).includes(preset));
  const mode = scenarioModes.find((item) => profile?.presets[item.id] === preset)?.id ?? 'outage';
  return (
    <section className="facility-selector" aria-label="Facility configuration">
      <div className="workspace-section-label">
        <span>01 / SELECT YOUR FACILITY</span>
        <span>Illustrative starting points · editable below</span>
      </div>
      <div className="facility-profiles">
        {facilityProfiles.map((item, index) => (
          <button
            key={item.id}
            className={`facility-card ${profile?.id === item.id ? 'is-selected' : ''}`}
            style={{ '--profile-color': item.color } as CSSProperties}
            aria-pressed={profile?.id === item.id}
            aria-label={`${item.name} profile`}
            disabled={busy}
            onClick={() => onSelect(item.presets[mode])}
          >
            <span className="facility-card-top">
              <span className="facility-glyph" aria-hidden="true">
                {['◈', '▦', '⬡', '▥'][index]}
              </span>
              <span>{item.eyebrow}</span>
              <span className="selection-dot" />
            </span>
            <strong>{item.name}</strong>
            <span className="facility-card-bottom">
              <span>{item.description}</span>
              <b>
                {item.loadMw}
                <small> MW</small>
              </b>
            </span>
          </button>
        ))}
      </div>
      <div className="scenario-mode-row">
        <span className="scenario-mode-label">TEST A PRESSURE</span>
        <div role="group" aria-label="Energy scenario mode" className="scenario-modes">
          {scenarioModes.map((item, index) => (
            <button
              key={item.id}
              aria-pressed={!!profile && mode === item.id}
              disabled={busy}
              title={item.description}
              onClick={() => onSelect((profile ?? facilityProfiles[0]).presets[item.id])}
            >
              <span aria-hidden="true">0{index + 1}</span>
              {item.name}
            </button>
          ))}
        </div>
        {!profile && <span className="custom-case">Reference scenario selected</span>}
      </div>
    </section>
  );
}

export function RunInsight({ run }: { run: Run }) {
  const depletion = run.events.find((event) => event.action === 'battery_depleted');
  const unmet = Number(run.summary.unserved_it_kwh);
  const served = Number(run.summary.served_it_kwh);
  const requested = Number(run.summary.requested_it_kwh);
  const fraction = requested > 0 ? Math.max(0, Math.min(100, (served / requested) * 100)) : 0;
  return (
    <section className="run-insight" aria-label="Scenario outcome">
      <div className="insight-eyebrow">
        <span className="status-dot" /> COMPLETED SCENARIO
      </div>
      <h2>
        Every second.
        <br /> Every kilowatt.
      </h2>
      <p>See what reaches the load when the supply changes.</p>
      <div
        className="energy-ring"
        style={{ '--served-angle': `${fraction * 3.6}deg` } as CSSProperties}
      >
        <div>
          <strong>
            {requested ? n(fraction, 1) : '—'}
            <small>{requested ? '%' : ''}</small>
          </strong>
          <span>requested energy served</span>
        </div>
      </div>
      <div className="insight-metrics">
        <div>
          <span>Unserved energy</span>
          <strong className={unmet ? 'energy-coral' : 'energy-green'}>
            {n(unmet / 1000, 3)} <small>MWh</small>
          </strong>
        </div>
        <div>
          <span>Stored energy at start</span>
          <strong>
            {n(Number(run.scenario.battery_initial_kwh) / 1000, 2)} <small>MWh</small>
          </strong>
        </div>
        <div>
          <span>Battery depleted at</span>
          <strong>{depletion ? `${n(depletion.at_s, 1)} s` : 'Not depleted'}</strong>
        </div>
      </div>
      <div className={`insight-verdict ${unmet ? 'has-gap' : ''}`}>
        <span aria-hidden="true">{unmet ? '△' : '✓'}</span>
        <span>
          {unmet ? 'A supply gap appears in this run.' : 'Demand is served throughout this run.'}
          <small>Energy coverage within this scenario; not an uptime rating.</small>
        </span>
      </div>
    </section>
  );
}

export function ScenarioSettings({
  draft,
  busy,
  onChange,
}: {
  draft: SiteScenario;
  busy: boolean;
  onChange: (scenario: SiteScenario) => void;
}) {
  const fields = [
    ['battery_capacity_kwh', 'Battery energy capacity', 'kWh', 0, 1000000000],
    ['battery_charge_kw', 'Battery charging limit', 'kW', 0, 1000000],
    ['distribution_efficiency', 'Distribution efficiency', 'ratio', 0.01, 1],
    ['battery_discharge_efficiency', 'Battery discharge efficiency', 'ratio', 0.01, 1],
    ['battery_charge_efficiency', 'Battery charge efficiency', 'ratio', 0.01, 1],
  ] as const;
  return (
    <details
      className="advanced-scenario"
      onInvalid={(event) => {
        event.currentTarget.open = true;
      }}
    >
      <summary>
        Configure storage, losses & asset limits <span>Advanced inputs</span>
      </summary>
      <p>
        Changing these assumptions creates an editable scenario. Run it again to update the results.
      </p>
      <div className="advanced-inputs">
        {fields.map(([field, label, unit, min, max]) => (
          <label key={field}>
            {label}
            <span>{unit}</span>
            <input
              aria-label={`${label} (${unit})`}
              type="number"
              required
              min={min}
              max={max}
              step="any"
              disabled={busy}
              value={draft[field]}
              onChange={(event) => onChange({ ...draft, [field]: event.target.value })}
            />
          </label>
        ))}
        {draft.assets
          .filter((asset) => asset.kind !== 'control')
          .map((asset) => (
            <label key={asset.id}>
              {asset.name}
              <span>kW capacity</span>
              <input
                aria-label={`${asset.name} capacity (kW)`}
                type="number"
                required
                min="0"
                max="1000000"
                step="any"
                disabled={busy}
                value={asset.capacity_kw}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    assets: draft.assets.map((item) =>
                      item.id === asset.id ? { ...item, capacity_kw: event.target.value } : item,
                    ),
                  })
                }
              />
            </label>
          ))}
      </div>
      <p>
        Asset limits are gross electrical power. Stored battery energy is a separate quantity.
        Scheduled demand steps retain their declared values when the initial IT demand is edited.
      </p>
    </details>
  );
}

const pressures = [
  {
    number: '01',
    title: 'Speed to power',
    subtitle: 'Plan the bridge to utility power',
    color: 'cyan',
    copy: 'Explore a longer utility outage and see how much reserve reaches the IT load after losses. Make the capacity and energy assumptions explicit.',
    action: 'Explore extended reserve',
    mode: 'reserve' as const,
  },
  {
    number: '02',
    title: 'AI load changes',
    subtitle: 'Make the power step visible',
    color: 'green',
    copy: 'Step the aggregate electrical demand and inspect served power, source headroom and unmet energy. Compare what changes when demand exceeds a surviving path.',
    action: 'Explore a load step',
    mode: 'ramp' as const,
  },
  {
    number: '03',
    title: 'Renewable integration',
    subtitle: 'Energy is only part of the question',
    color: 'amber',
    copy: 'Solar and wind availability, dispatch and carbon accounting require time-series inputs. This workspace provides continuity experiments; it does not yet calculate a renewable mix or emissions.',
    action: null,
  },
  {
    number: '04',
    title: 'Beyond short ride-through',
    subtitle: 'Distinguish battery power from energy',
    color: 'violet',
    copy: 'A battery may have enough energy but too little discharge power. Test finite storage, generator failure and distribution capacity together, then export the complete ledger.',
    action: 'Explore a grid outage',
    mode: 'outage' as const,
  },
  {
    number: '05',
    title: 'Grid independence',
    subtitle: 'Study continuity before controls',
    color: 'coral',
    copy: 'A reserve study can expose a supply shortfall. Establishing voltage and frequency, protection coordination, island transitions and black start need separate dynamic models and equipment evidence.',
    action: null,
  },
];

export function EnergyGuide({
  onScenario,
}: {
  onScenario: (mode: 'outage' | 'ramp' | 'reserve') => void;
}) {
  return (
    <div className="energy-guide">
      <section className="energy-guide-lead">
        <span className="eyebrow">FROM INFRASTRUCTURE PRESSURE TO A CHECKABLE EXPERIMENT</span>
        <h2>
          Explore the power problem.
          <br />
          <span>Make your assumptions visible.</span>
        </h2>
        <p>
          Five questions for an energy strategy. Three runnable experiments today. Start with a
          facility profile, change the inputs, and trace the result back to the energy ledger.
        </p>
      </section>
      <div className="pressure-grid">
        {pressures.map((item) => (
          <article className={`pressure-card pressure-${item.color}`} key={item.number}>
            <div className="pressure-heading">
              <span>{item.number}</span>
              <span className="pressure-category">
                {item.action ? 'RUNNABLE EXPERIMENT' : 'DESIGN CONTEXT'}
              </span>
            </div>
            <h3>{item.title}</h3>
            <h4>{item.subtitle}</h4>
            <p>{item.copy}</p>
            {item.action && item.mode && (
              <button onClick={() => onScenario(item.mode!)}>
                {item.action}
                <span aria-hidden="true">↗</span>
              </button>
            )}
          </article>
        ))}
        <article className="pressure-card pressure-reference">
          <span className="eyebrow">A TRACEABLE STARTING POINT</span>
          <h3>Bring the evidence with you.</h3>
          <p>
            Each run contains its inputs, event timeline, numerical results and input hash. Share a
            Markdown or HTML report to make your comparison reproducible.
          </p>
          <a href="https://github.com/mohammadrezwankhan/datacenter-twin-lab/blob/main/docs/engineering/energy-scenario-workspace.md">
            Read the engineering guide ↗
          </a>
        </article>
      </div>
      <section className="panel capability-matrix">
        <div className="section-title">
          <h2>What belongs in this workspace?</h2>
          <span className="pill">Capability map</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Available here</th>
                <th>Further evidence needed</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Will supply cover demand?</td>
                <td>Finite battery, source failure, generator delay, feed capacity</td>
                <td>Facility measurements and selected equipment ratings</td>
              </tr>
              <tr>
                <td>How will a fast load change behave?</td>
                <td>Piecewise aggregate kW demand and energy shortfall</td>
                <td>Voltage, frequency and converter transient models</td>
              </tr>
              <tr>
                <td>Which hybrid assets should I select?</td>
                <td>Editable electrical continuity assumptions</td>
                <td>Renewable forecasts, fuel curves, equipment and dispatch models</td>
              </tr>
              <tr>
                <td>Is a commercial EMS ready?</td>
                <td>Local simulation and reproducible reports</td>
                <td>
                  Hardware control, black-start tests, cybersecurity assessment, availability and
                  grid-service qualification
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          No vendor response-time, CapEx, uptime, equipment-lifetime or renewable-share promises are
          used as results.
        </p>
      </section>
    </div>
  );
}
