import type { KeyboardEvent, ReactNode } from 'react';
import type { EmtConfig, EmtRow } from './engine';

export type DeviceId = 'source' | 'reactor' | 'capacitor' | 'bus' | 'load';

const devices: Record<DeviceId, { title: string; role: string; color: string }> = {
  source: { title: 'DC source', role: 'Input voltage', color: '#58d8e8' },
  reactor: { title: 'Series reactor', role: 'Stored magnetic energy', color: '#a88aff' },
  capacitor: { title: 'DC-link capacitor', role: 'Stored electric energy', color: '#a88aff' },
  bus: { title: 'DC bus', role: 'Observed bus voltage', color: '#f0788f' },
  load: { title: 'Resistive load', role: 'Load current', color: '#f1b451' },
};

function selectOnKey(
  event: KeyboardEvent<SVGGElement>,
  id: DeviceId,
  onSelect: (id: DeviceId) => void,
) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onSelect(id);
  }
}

function DeviceButton({
  id,
  selected,
  onSelect,
  children,
}: {
  id: DeviceId;
  selected: boolean;
  onSelect: (id: DeviceId) => void;
  children: ReactNode;
}) {
  const device = devices[id];
  return (
    <g
      className={'emt-device emt-device-' + id + (selected ? ' is-selected' : '')}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={device.title + '. ' + device.role + '. Select for details.'}
      onClick={() => onSelect(id)}
      onKeyDown={(event) => selectOnKey(event, id, onSelect)}
    >
      <title>
        {device.title} · {device.role}
      </title>
      {children}
    </g>
  );
}

export function EmtScene({
  config,
  row,
  peakCurrentA,
  playing,
  selected,
  onSelect,
}: {
  config: EmtConfig;
  row: EmtRow;
  peakCurrentA: number;
  playing: boolean;
  selected: DeviceId;
  onSelect: (id: DeviceId) => void;
}) {
  const currentFraction = peakCurrentA > 0 ? Math.min(1, Math.abs(row.source_a) / peakCurrentA) : 0;
  const loadFraction = peakCurrentA > 0 ? Math.min(1, Math.abs(row.load_a) / peakCurrentA) : 0;
  const busFraction =
    config.source_v > 0 ? Math.max(0, Math.min(1, row.bus_v / config.source_v)) : 0;
  const initialCurrent = config.source_v / (config.resistance_ohm + config.load_ohm);
  const initialBus = config.load_ohm * initialCurrent;
  const initialEnergy = ((0.5 * config.capacitance_mf) / 1000) * initialBus ** 2;
  const capacitorEnergy = ((0.5 * config.capacitance_mf) / 1000) * row.bus_v ** 2;
  const energyFraction = Math.max(0, Math.min(1, capacitorEnergy / Math.max(1e-9, initialEnergy)));
  const wireAlpha = 0.28 + currentFraction * 0.72;
  const busAlpha = 0.22 + busFraction * 0.76;

  return (
    <div className={'emt-scene-wrap' + (playing ? ' is-playing' : '')}>
      <svg
        className="emt-scene"
        viewBox="0 0 1000 420"
        role="group"
        aria-label="Interactive isometric DC-link study. Select the source, reactor, capacitor, bus, or load to inspect its model role."
      >
        <defs>
          <linearGradient id="emt-sky" x2="0" y2="1">
            <stop stopColor="#112535" />
            <stop offset="1" stopColor="#0b1722" />
          </linearGradient>
          <linearGradient id="emt-ground" x2="0.8" y2="1">
            <stop stopColor="#1b343b" />
            <stop offset="1" stopColor="#10242c" />
          </linearGradient>
          <linearGradient id="emt-source-top" x2="0.8" y2="1">
            <stop stopColor="#25606d" />
            <stop offset="1" stopColor="#173e4b" />
          </linearGradient>
          <linearGradient id="emt-source-front" x2="0" y2="1">
            <stop stopColor="#143a46" />
            <stop offset="1" stopColor="#0c2531" />
          </linearGradient>
          <linearGradient id="emt-violet" x2="0" y2="1">
            <stop stopColor="#554879" />
            <stop offset="1" stopColor="#272640" />
          </linearGradient>
          <linearGradient id="emt-amber" x2="0" y2="1">
            <stop stopColor="#66503a" />
            <stop offset="1" stopColor="#302a28" />
          </linearGradient>
          <pattern
            id="emt-grid"
            width="38"
            height="28"
            patternUnits="userSpaceOnUse"
            patternTransform="skewY(-24)"
          >
            <path d="M38 0H0V28" fill="none" stroke="#31515a" strokeOpacity=".38" strokeWidth="1" />
          </pattern>
          <filter id="emt-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="1000" height="420" fill="url(#emt-sky)" />
        <circle cx="842" cy="64" r="82" fill="#35aeb8" opacity=".055" />
        <path d="M0 285 384 156 1000 273V420H0Z" fill="#0b1821" opacity=".7" />
        <path
          d="M63 303 409 155 938 305 581 411Z"
          fill="url(#emt-ground)"
          stroke="#365962"
          strokeWidth="1.5"
        />
        <path d="M63 303 409 155 938 305 581 411Z" fill="url(#emt-grid)" opacity=".75" />
        <path
          d="M107 305 410 177 883 310 577 394Z"
          fill="none"
          stroke="#7a9aa1"
          strokeOpacity=".28"
          strokeDasharray="3 8"
        />

        <g aria-hidden="true" className="emt-circuit">
          <path
            d="M226 215 331 179 420 205"
            fill="none"
            stroke="#58d8e8"
            strokeOpacity={wireAlpha}
            strokeWidth={3 + currentFraction * 4}
          />
          <path
            d="M226 215 331 179 420 205"
            fill="none"
            stroke="#a5f2f3"
            strokeOpacity={currentFraction * 0.7}
            strokeWidth="1"
            strokeDasharray="3 12"
            className={'emt-flow-dash' + (row.source_a < 0 ? ' is-reverse' : '')}
          />
          <path
            d="M516 239 590 259 688 225"
            fill="none"
            stroke="#f1b451"
            strokeOpacity={0.28 + loadFraction * 0.72}
            strokeWidth={3 + loadFraction * 4}
          />
          <path
            d="M516 239 590 259 688 225"
            fill="none"
            stroke="#ffe0a0"
            strokeOpacity={loadFraction * 0.7}
            strokeWidth="1"
            strokeDasharray="3 12"
            className={'emt-flow-dash' + (row.load_a < 0 ? ' is-reverse' : '')}
          />
          <path
            d="M590 259 590 319"
            fill="none"
            stroke="#a88aff"
            strokeOpacity=".84"
            strokeWidth="3"
          />
          <path
            d="M590 319 590 347"
            fill="none"
            stroke="#a88aff"
            strokeOpacity=".84"
            strokeWidth="3"
          />
          <path d="M590 347 670 369" fill="none" stroke="#5a6574" strokeWidth="2" />
          <path
            d="M573 345H607M578 354H602M583 363H597"
            stroke="#c3a9ff"
            strokeOpacity={0.3 + energyFraction * 0.7}
            strokeWidth="3"
          />
          <circle
            cx="331"
            cy="179"
            r="5"
            fill="#58d8e8"
            filter="url(#emt-glow)"
            opacity={wireAlpha}
          />
          <circle
            cx="590"
            cy="259"
            r="5"
            fill="#f1b451"
            filter="url(#emt-glow)"
            opacity={wireAlpha}
          />
          <circle
            cx="516"
            cy="239"
            r="5"
            fill="#f0788f"
            filter="url(#emt-glow)"
            opacity={busAlpha}
          />
        </g>

        <DeviceButton id="source" selected={selected === 'source'} onSelect={onSelect}>
          <rect x="105" y="186" width="150" height="116" rx="10" className="emt-hit" />
          <path
            d="M128 225 186 202 237 219 179 242Z"
            fill="url(#emt-source-top)"
            stroke="#58d8e8"
          />
          <path d="M128 225 179 242V302L128 282Z" fill="url(#emt-source-front)" stroke="#348492" />
          <path d="M179 242 237 219V278L179 302Z" fill="#102b38" stroke="#28606c" />
          <path
            d="M144 246 160 240V279L144 285ZM165 238 174 235V284L165 288Z"
            fill="#59dbe5"
            opacity={0.35 + (row.source_v / config.source_v) * 0.55}
          />
          <rect x="132" y="310" width="106" height="34" rx="6" className="emt-label-plate" />
          <text x="185" y="324" textAnchor="middle" className="emt-label">
            DC SOURCE
          </text>
          <text x="185" y="337" textAnchor="middle" className="emt-value">
            {Math.round(row.source_v)} V
          </text>
        </DeviceButton>

        <DeviceButton id="reactor" selected={selected === 'reactor'} onSelect={onSelect}>
          <rect x="283" y="149" width="180" height="140" rx="12" className="emt-hit" />
          <path d="M311 199 365 178 427 198 372 219Z" fill="#473e66" stroke="#a88aff" />
          <path d="M311 199 372 219V272L311 250Z" fill="url(#emt-violet)" stroke="#8170b0" />
          <path d="M372 219 427 198V250L372 272Z" fill="#27253c" stroke="#66548f" />
          {[0, 1, 2, 3].map((index) => (
            <path
              key={index}
              d={'M' + (328 + index * 11) + ' ' + (208 + index * 3.5) + ' q7 -17 14 -6 q7 11 14 -6'}
              fill="none"
              stroke="#d0bdff"
              strokeWidth="2.3"
              opacity=".88"
            />
          ))}
          <rect x="317" y="280" width="113" height="34" rx="6" className="emt-label-plate" />
          <text x="373" y="294" textAnchor="middle" className="emt-label">
            SERIES REACTOR
          </text>
          <text x="373" y="307" textAnchor="middle" className="emt-value">
            {config.inductance_mh} mH
          </text>
        </DeviceButton>

        <DeviceButton id="bus" selected={selected === 'bus'} onSelect={onSelect}>
          <rect x="445" y="151" width="149" height="147" rx="12" className="emt-hit" />
          <path d="M467 202 518 182 572 201 520 221Z" fill="#633e59" stroke="#f0788f" />
          <path d="M467 202 520 221V274L467 255Z" fill="#4a2f43" stroke="#b65472" />
          <path d="M520 221 572 201V254L520 274Z" fill="#342735" stroke="#974d69" />
          <rect
            x="481"
            y={247 - 31 * busFraction}
            width="9"
            height={31 * busFraction}
            rx="3"
            fill="#f0788f"
            opacity=".8"
          />
          <rect
            x="494"
            y={247 - 31 * busFraction}
            width="9"
            height={31 * busFraction}
            rx="3"
            fill="#f5a1aa"
            opacity=".52"
          />
          <rect x="467" y="282" width="105" height="34" rx="6" className="emt-label-plate" />
          <text x="519" y="296" textAnchor="middle" className="emt-label">
            DC BUS
          </text>
          <text x="519" y="309" textAnchor="middle" className="emt-value">
            {Math.round(row.bus_v)} V
          </text>
        </DeviceButton>

        <DeviceButton id="capacitor" selected={selected === 'capacitor'} onSelect={onSelect}>
          <rect x="561" y="293" width="143" height="105" rx="12" className="emt-hit" />
          <path d="M579 321 618 306 657 320 618 336Z" fill="#44375f" stroke="#a88aff" />
          <path d="M579 321 618 336V375L579 359Z" fill="url(#emt-violet)" stroke="#8973bc" />
          <path d="M618 336 657 320V359L618 375Z" fill="#28243b" stroke="#695594" />
          <path
            d="M587 350 612 359V371L587 361Z"
            fill="#bca0ff"
            opacity={0.22 + energyFraction * 0.7}
          />
          <path d="M626 353V382M640 347V378" stroke="#d4c5ff" strokeWidth="2.5" />
          <rect x="566" y="382" width="126" height="29" rx="6" className="emt-label-plate" />
          <text x="629" y="394" textAnchor="middle" className="emt-label">
            DC-LINK CAPACITOR
          </text>
          <text x="629" y="405" textAnchor="middle" className="emt-value">
            {config.capacitance_mf} mF
          </text>
        </DeviceButton>

        <DeviceButton id="load" selected={selected === 'load'} onSelect={onSelect}>
          <rect x="650" y="158" width="200" height="178" rx="12" className="emt-hit" />
          <path d="M686 196 749 171 817 194 753 220Z" fill="#67513a" stroke="#f1b451" />
          <path d="M686 196 753 220V292L686 265Z" fill="url(#emt-amber)" stroke="#ad8147" />
          <path d="M753 220 817 194V266L753 292Z" fill="#302a27" stroke="#977340" />
          <path
            d="M699 210V264M712 215V269M725 220V274M738 225V279"
            stroke="#f1b451"
            strokeOpacity=".65"
            strokeWidth="4"
          />
          <path
            d="M767 224V274M779 219V269M791 214V264M803 208V258"
            stroke="#f1b451"
            strokeOpacity=".35"
            strokeWidth="3"
          />
          <rect x="694" y="300" width="116" height="34" rx="6" className="emt-label-plate" />
          <text x="752" y="314" textAnchor="middle" className="emt-label">
            RESISTIVE LOAD
          </text>
          <text x="752" y="327" textAnchor="middle" className="emt-value">
            {row.load_a.toFixed(1)} A
          </text>
        </DeviceButton>

        <g aria-hidden="true" className="emt-live-readouts">
          <rect x="766" y="36" width="195" height="79" rx="9" />
          <text x="784" y="58" className="emt-live-kicker">
            SAMPLED STATE · {row.time_ms.toFixed(2)} ms
          </text>
          <text x="784" y="83" className="emt-live-value">
            {row.source_a.toFixed(1)} A
          </text>
          <text x="877" y="83" className="emt-live-label">
            source current
          </text>
          <path d="M784 96H942" stroke="#36505d" />
          <text x="784" y="108" className="emt-live-foot">
            Values from solver output
          </text>
        </g>
        <text x="38" y="389" className="emt-scene-note">
          IDEAL DC EQUIVALENT · LINEAR RLC NETWORK · NOT SWITCHING DETAIL
        </text>
      </svg>
      <div className="emt-scene-caption">
        <span>
          <i className="key-source" /> Source
        </span>
        <span>
          <i className="key-capacitor" /> Stored energy
        </span>
        <span>
          <i className="key-current" /> Load current
        </span>
        <span>
          <i className="key-dip" /> Bus voltage
        </span>
      </div>
      <div className="emt-device-inspector" aria-live="polite">
        <span className="emt-inspector-swatch" style={{ background: devices[selected].color }} />
        <div>
          <strong>{devices[selected].title}</strong>
          <span>{devices[selected].role}</span>
        </div>
        <b>
          {selected === 'source'
            ? row.source_v.toFixed(1) + ' V'
            : selected === 'reactor'
              ? config.inductance_mh + ' mH'
              : selected === 'capacitor'
                ? config.capacitance_mf +
                  ' mF · ' +
                  (((0.5 * config.capacitance_mf) / 1000) * row.bus_v ** 2).toFixed(1) +
                  ' J'
                : selected === 'bus'
                  ? row.bus_v.toFixed(1) + ' V'
                  : row.load_a.toFixed(2) + ' A'}
        </b>
      </div>
    </div>
  );
}
