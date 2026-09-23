import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import type { Interval, Run } from './types';
import './power-scene.css';

type SourceKey = 'grid' | 'generator' | 'battery' | 'site';
type PowerSceneProps = {
  run: Run;
  row: Interval;
  motion: boolean;
  onMotionChange: (value: boolean) => void;
};

const numeric = (value: string | number | null | undefined) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
};
const kw = (value: string | number | null | undefined) =>
  `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(numeric(value))} kW`;
const kwh = (value: string | number | null | undefined) =>
  `${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(numeric(value))} kWh`;
const words = (value: string | undefined) => (value ? value.replaceAll('_', ' ') : 'not specified');

function PowerValue({ value }: { value: string }) {
  return <>{kw(value)}</>;
}

function DesktopCampus({
  row,
  selected,
  onSelect,
}: {
  row: Interval;
  selected: SourceKey;
  onSelect: (key: SourceKey) => void;
}) {
  const demand = Math.max(1, numeric(row.requested_it_kw));
  const flows = {
    grid: numeric(row.grid_kw),
    generator: numeric(row.generator_kw),
    battery: numeric(row.battery_discharge_kw),
    charge: numeric(row.battery_charge_kw),
    unserved: numeric(row.unserved_it_kw),
  };
  const states = row.asset_states;
  const selectedClass = (key: SourceKey) => (selected === key ? ' is-selected' : '');
  const strokeWidth = (value: number) => 3 + (Math.min(value, demand) / demand) * 5;
  const assetState = (id: string) => words(states[id]);
  const flowLabel = (value: number) => `${kw(value)}`;

  return (
    <svg
      className="power-scene-svg"
      viewBox="0 0 1080 380"
      role="group"
      aria-label="Interactive isometric data center campus. Select a power source or the server hall for interval details."
    >
      <defs>
        <linearGradient id="ps-sky" x2="0" y2="1">
          <stop stopColor="#112637" />
          <stop offset="1" stopColor="#0e1b27" />
        </linearGradient>
        <linearGradient id="ps-roof" x2="0" y2="1">
          <stop stopColor="#30485a" />
          <stop offset="1" stopColor="#1d3040" />
        </linearGradient>
        <linearGradient id="ps-front" x2="0" y2="1">
          <stop stopColor="#193143" />
          <stop offset="1" stopColor="#102332" />
        </linearGradient>
        <linearGradient id="ps-side" x2="1" y2="0">
          <stop stopColor="#142a3a" />
          <stop offset="1" stopColor="#0c1d2a" />
        </linearGradient>
        <linearGradient id="ps-ground" x2="0.75" y2="1">
          <stop stopColor="#18342f" />
          <stop offset="1" stopColor="#102421" />
        </linearGradient>
        <clipPath id="ps-ground-clip">
          <path d="M96 280 476 113 1052 285 652 378Z" />
        </clipPath>
        <pattern id="ps-rack-lights" width="12" height="15" patternUnits="userSpaceOnUse">
          <rect x="2" y="3" width="3" height="7" rx="1" fill="#44c5d0" opacity=".8" />
          <rect x="7" y="3" width="2" height="7" rx="1" fill="#66e0ba" opacity=".75" />
        </pattern>
      </defs>

      <rect width="1080" height="380" fill="url(#ps-sky)" />
      <circle cx="871" cy="54" r="55" fill="#214554" opacity=".15" />
      <path d="M0 287 325 150 1080 261V380H0Z" fill="#0c1822" opacity=".65" />
      <path
        d="M96 280 476 113 1052 285 652 378Z"
        fill="url(#ps-ground)"
        stroke="#2d5a50"
        strokeWidth="1.4"
      />
      <g clipPath="url(#ps-ground-clip)" className="power-scene-ground-grid" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={`gx${i}`} d={`M${130 + i * 55} 380 ${510 + i * 55} 113`} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <path key={`gy${i}`} d={`M50 ${150 + i * 34} 1090 ${150 + i * 34}`} />
        ))}
      </g>
      <path
        d="M139 279 481 129 1009 287 650 365Z"
        fill="none"
        stroke="#4b8e78"
        strokeDasharray="3 7"
        opacity=".6"
      />
      <path d="M106 303 294 249M662 345 858 280" stroke="#70a491" strokeWidth="2" opacity=".35" />

      {/* Active source paths follow the current replay interval. */}
      <g aria-hidden="true" className="power-scene-cables">
        <path
          className={`power-cable cable-grid${flows.grid > 0 ? ' is-flowing' : ''}`}
          style={{ strokeWidth: strokeWidth(flows.grid) }}
          d="M236 232C284 226 279 267 333 267"
        />
        <path
          className={`power-cable cable-battery${flows.battery > 0 ? ' is-flowing' : ''}`}
          style={{ strokeWidth: strokeWidth(flows.battery) }}
          d="M842 157C781 158 786 209 718 228"
        />
        <path
          className={`power-cable cable-generator${flows.generator > 0 ? ' is-flowing' : ''}`}
          style={{ strokeWidth: strokeWidth(flows.generator) }}
          d="M862 287C803 305 778 270 715 265"
        />
        <path
          className={`power-cable cable-charge${flows.charge > 0 ? ' is-flowing' : ''}`}
          style={{ strokeWidth: strokeWidth(flows.charge) }}
          d="M709 213C769 190 786 142 842 142"
        />
        <path
          className={`power-cable cable-unserved${flows.unserved > 0 ? ' is-flowing' : ''}`}
          style={{ strokeWidth: strokeWidth(flows.unserved) }}
          d="M725 243C751 256 758 258 783 251"
        />
        <g className="cable-tag cable-tag-grid">
          <rect x="249" y="217" width="66" height="20" rx="6" />
          <text x="282" y="231" textAnchor="middle">
            {flowLabel(flows.grid)}
          </text>
        </g>
        <g className="cable-tag cable-tag-battery">
          <rect x="751" y="162" width="74" height="20" rx="6" />
          <text x="788" y="176" textAnchor="middle">
            {flowLabel(flows.battery)}
          </text>
        </g>
        <g className="cable-tag cable-tag-generator">
          <rect x="774" y="281" width="74" height="20" rx="6" />
          <text x="811" y="295" textAnchor="middle">
            {flowLabel(flows.generator)}
          </text>
        </g>
        {flows.charge > 0 && (
          <g className="cable-tag cable-tag-charge">
            <rect x="761" y="184" width="74" height="20" rx="6" />
            <text x="798" y="198" textAnchor="middle">
              +{flowLabel(flows.charge)}
            </text>
          </g>
        )}
        {flows.unserved > 0 && (
          <g className="cable-tag cable-tag-unserved">
            <rect x="727" y="260" width="82" height="20" rx="6" />
            <text x="768" y="274" textAnchor="middle">
              {flowLabel(flows.unserved)} gap
            </text>
          </g>
        )}
      </g>

      {/* Electrical yard and utility pylon. */}
      <g
        className={`power-scene-object source-grid${selectedClass('grid')}`}
        role="button"
        tabIndex={0}
        aria-pressed={selected === 'grid'}
        aria-label={`Utility feed, ${kw(flows.grid)} in this interval, state ${assetState('utility')}. Select for details.`}
        onClick={() => onSelect('grid')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect('grid');
          }
        }}
      >
        <title>
          Utility feed · {kw(flows.grid)} · {assetState('utility')}
        </title>
        <rect className="power-hit-area" x="58" y="35" width="220" height="249" rx="10" />
        <path
          d="M161 87 112 201M161 87 205 202M135 151H187M124 174H196M143 128H179M111 201H205M141 118H181"
          fill="none"
          stroke="#a9c3d1"
          strokeWidth="3"
        />
        <path
          d="M161 88 148 117H174ZM135 151 159 174 187 151M124 174 159 202 196 174"
          fill="none"
          stroke="#668697"
          strokeWidth="2"
        />
        <path d="M95 117H226M104 127H216" stroke="#68cad1" strokeWidth="4" />
        <path d="M159 202V222M112 201 95 225M205 202 224 225" stroke="#a9c3d1" strokeWidth="3" />
        <path d="M86 235 144 215 229 239 171 261Z" fill="#233947" stroke="#507365" />
        <path
          d="M101 229 147 213 170 220 124 236ZM165 238 198 226 220 233 187 247Z"
          fill="#3c5861"
          stroke="#6a8d8a"
        />
        <path
          d="M123 236V251L169 266V251M186 247V262L220 250V235"
          fill="#192b37"
          stroke="#48665e"
        />
        <circle cx="146" cy="226" r="3" fill="#68d4d0" />
        <rect x="91" y="268" width="142" height="31" rx="7" className="power-label-plate" />
        <text x="162" y="281" textAnchor="middle" className="power-label-main">
          UTILITY FEED
        </text>
        <text x="162" y="293" textAnchor="middle" className="power-label-sub">
          {assetState('utility')}
        </text>
      </g>

      {/* Hall foundation, glazed front and the open rack bays. */}
      <path d="M289 259 495 175 778 254 568 348Z" fill="#0a171e" opacity=".7" />
      <path
        d="M316 158 516 91 727 158 531 224Z"
        fill="url(#ps-roof)"
        stroke="#63808e"
        strokeWidth="1.5"
      />
      <path
        d="M316 158 531 224V311L316 242Z"
        fill="url(#ps-front)"
        stroke="#446173"
        strokeWidth="1.5"
      />
      <path
        d="M531 224 727 158V247L531 311Z"
        fill="url(#ps-side)"
        stroke="#354f60"
        strokeWidth="1.5"
      />
      <path
        d="M316 242 531 311 727 247"
        fill="none"
        stroke="#7697a3"
        strokeWidth="2"
        opacity=".6"
      />
      <path
        d="M316 158 531 224 727 158"
        fill="none"
        stroke="#91aab3"
        strokeWidth="1.3"
        opacity=".75"
      />
      <g aria-hidden="true" className="power-scene-front-racks">
        {Array.from({ length: 6 }, (_, i) => {
          const x = 333 + i * 31;
          const y = 181 + i * 9.8;
          return (
            <g key={i}>
              <path
                d={`M${x} ${y}l25 8v52l-25-8Z`}
                fill="#0c1b26"
                stroke="#547182"
                strokeWidth="1.2"
              />
              <path
                d={`M${x + 4} ${y + 8}l17 5v35l-17-5Z`}
                fill="url(#ps-rack-lights)"
                opacity=".9"
              />
              <path d={`M${x + 4} ${y + 48}l17 5`} stroke="#6de0bf" strokeWidth="1.4" />
            </g>
          );
        })}
        <path d="M323 175 519 239V301" fill="none" stroke="#90bbc3" strokeWidth="2" opacity=".55" />
        <path d="M316 169 531 237M316 242 531 311" fill="none" stroke="#71919d" strokeWidth="2" />
        <path d="M316 166 531 234" stroke="#67d4ca" strokeWidth="5" opacity=".56" />
      </g>
      <g aria-hidden="true" className="power-scene-side-details">
        {Array.from({ length: 5 }, (_, i) => (
          <path
            key={i}
            d={`M${552 + i * 31} ${216 - i * 10.4}v73`}
            stroke="#456272"
            strokeWidth="2"
            opacity=".65"
          />
        ))}
        <path d="M545 242 715 185M545 258 715 201" stroke="#183848" strokeWidth="7" opacity=".8" />
        <path
          d="M545 242 715 185M545 258 715 201"
          stroke="#417f89"
          strokeWidth="1.5"
          opacity=".75"
        />
        <path d="M558 291 714 240" stroke="#738f96" strokeWidth="2" />
      </g>

      {/* Rooftop ventilation plant: illustrative building detail, not a performance claim. */}
      <g aria-hidden="true" className="power-scene-roof-plant">
        <path d="M363 144 409 128 440 138 394 155Z" fill="#334e5c" stroke="#78939a" />
        <path d="M363 144v22l31 10v-21ZM394 155v21l46-16v-22Z" fill="#1a303d" stroke="#587480" />
        <path
          d="M370 147 406 134M372 153 408 140M372 159 408 146"
          stroke="#77bdba"
          strokeWidth="1"
          opacity=".65"
        />
        <path d="M466 115 506 102 536 112 496 126Z" fill="#354f5e" stroke="#78939a" />
        <path d="M466 115v23l30 10v-22ZM496 126v22l40-13v-23Z" fill="#1b3341" stroke="#587480" />
        <path
          d="M473 119 503 109M473 125 503 115M473 131 503 121"
          stroke="#79c4c0"
          strokeWidth="1"
          opacity=".65"
        />
        <path d="M566 137 600 126 625 134 591 146Z" fill="#354f5e" stroke="#78939a" />
        <path d="M566 137v20l25 8v-19ZM591 146v19l34-11v-20Z" fill="#1b3341" stroke="#587480" />
      </g>
      <g
        className={`power-scene-object source-site${selectedClass('site')}`}
        role="button"
        tabIndex={0}
        aria-pressed={selected === 'site'}
        aria-label={`Server hall and IT load, ${kw(row.served_it_kw)} served of ${kw(row.requested_it_kw)} requested, ${kw(row.unserved_it_kw)} unserved. Select for details.`}
        onClick={() => onSelect('site')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect('site');
          }
        }}
      >
        <title>
          Server hall · {kw(row.served_it_kw)} served · {kw(row.unserved_it_kw)} unserved
        </title>
        <path className="power-hit-area" d="M293 72H754V347H293Z" />
        <rect x="357" y="274" width="160" height="30" rx="7" className="power-label-plate" />
        <text x="437" y="287" textAnchor="middle" className="power-label-main">
          SERVER HALL · IT LOAD
        </text>
        <text x="437" y="299" textAnchor="middle" className="power-label-sub">
          {kw(row.served_it_kw)} served
        </text>
      </g>

      {/* Battery enclosure and inverter skid. */}
      <g
        className={`power-scene-object source-battery${selectedClass('battery')}`}
        role="button"
        tabIndex={0}
        aria-pressed={selected === 'battery'}
        aria-label={`UPS battery, ${kw(flows.battery)} discharging, ${kw(flows.charge)} charging, ${kwh(row.battery_end_kwh)} at interval end. Select for details.`}
        onClick={() => onSelect('battery')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect('battery');
          }
        }}
      >
        <title>UPS battery · {kwh(row.battery_end_kwh)} at interval end</title>
        <rect className="power-hit-area" x="799" y="55" width="223" height="159" rx="10" />
        <path
          d="M830 106 893 83 969 105 907 129Z"
          fill="#50456b"
          stroke="#ad9ad6"
          strokeWidth="1.3"
        />
        <path d="M830 106v61l77 25v-63Z" fill="#302b46" stroke="#8c7bb3" strokeWidth="1.3" />
        <path d="M907 129v63l62-22v-65Z" fill="#28253c" stroke="#766b9a" strokeWidth="1.3" />
        <path d="M840 111v49M856 117v49M872 122v49M888 127v49" stroke="#766c98" strokeWidth="2" />
        <path
          d="M911 136 959 119M911 148 959 131M911 160 959 143M911 172 959 155"
          stroke="#594f75"
          strokeWidth="1.5"
        />
        <path d="M842 167 902 186" stroke="#bda7e8" strokeWidth="3" opacity=".7" />
        <rect x="849" y="91" width="30" height="15" rx="4" fill="#261f38" stroke="#9a88bd" />
        <path d="m861 94-5 8h6l-2 5 8-9h-6l2-4Z" fill="#d7c0ff" />
        <rect x="846" y="202" width="148" height="31" rx="7" className="power-label-plate" />
        <text x="920" y="215" textAnchor="middle" className="power-label-main">
          UPS BATTERY
        </text>
        <text x="920" y="227" textAnchor="middle" className="power-label-sub">
          {kwh(row.battery_end_kwh)} · {assetState('battery')}
        </text>
      </g>

      {/* Standby generator container. */}
      <g
        className={`power-scene-object source-generator${selectedClass('generator')}`}
        role="button"
        tabIndex={0}
        aria-pressed={selected === 'generator'}
        aria-label={`Standby generator, ${kw(flows.generator)} output this interval, state ${assetState('generator')}. Select for details.`}
        onClick={() => onSelect('generator')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect('generator');
          }
        }}
      >
        <title>
          Standby generator · {kw(flows.generator)} · {assetState('generator')}
        </title>
        <rect className="power-hit-area" x="841" y="233" width="213" height="139" rx="10" />
        <path
          d="M861 267 926 244 1013 269 947 294Z"
          fill="#75552f"
          stroke="#e5b36b"
          strokeWidth="1.4"
        />
        <path d="M861 267v58l86 28v-59Z" fill="#493824" stroke="#b98448" strokeWidth="1.4" />
        <path d="M947 294v59l66-24v-60Z" fill="#382e22" stroke="#9b713f" strokeWidth="1.4" />
        <path
          d="M877 272v43M892 277v43M907 282v43M922 287v43"
          stroke="#e2a353"
          strokeWidth="3"
          opacity=".66"
        />
        <path
          d="M956 301v42M967 297v42M978 293v42M989 288v42M1000 283v42"
          stroke="#a87942"
          strokeWidth="1.5"
        />
        <path
          d="M936 251v-22h13v27M942 229h22v5h-22"
          fill="#423726"
          stroke="#c28e50"
          strokeWidth="2"
        />
        <circle
          cx="930"
          cy="323"
          r="6"
          fill={flows.generator > 0 ? '#ffd18a' : '#694e31'}
          className="generator-indicator"
        />
        <rect x="869" y="345" width="146" height="29" rx="7" className="power-label-plate" />
        <text x="942" y="357" textAnchor="middle" className="power-label-main">
          STANDBY GENERATOR
        </text>
        <text x="942" y="368" textAnchor="middle" className="power-label-sub">
          {assetState('generator')}
        </text>
      </g>

      <g aria-hidden="true" className="power-scene-site-mark">
        <path d="m281 309 25-10 30 10-25 10Z" fill="#2d6251" />
        <path d="M306 319v15" stroke="#8cd9b5" strokeWidth="2" />
        <circle cx="306" cy="338" r="4" fill="#8cd9b5" />
        <text x="273" y="357">
          LOCAL POWER CAMPUS
        </text>
      </g>
    </svg>
  );
}

function MobileCampus({
  row,
  selected,
  onSelect,
}: {
  row: Interval;
  selected: SourceKey;
  onSelect: (key: SourceKey) => void;
}) {
  const flows = {
    grid: numeric(row.grid_kw),
    generator: numeric(row.generator_kw),
    battery: numeric(row.battery_discharge_kw),
    charge: numeric(row.battery_charge_kw),
    unserved: numeric(row.unserved_it_kw),
  };
  const state = (id: string) => words(row.asset_states[id]);
  const picked = (key: SourceKey) => selected === key;
  const choose = (key: SourceKey) => ({
    role: 'button' as const,
    tabIndex: 0,
    'aria-pressed': picked(key),
    onClick: () => onSelect(key),
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(key);
      }
    },
  });
  return (
    <svg
      className="power-scene-svg power-scene-svg-mobile"
      viewBox="0 0 400 390"
      role="group"
      aria-label="Interactive compact isometric data center campus. Select a power source or server hall for interval details."
    >
      <defs>
        <linearGradient id="psm-ground" x2=".6" y2="1">
          <stop stopColor="#18342f" />
          <stop offset="1" stopColor="#102421" />
        </linearGradient>
        <pattern id="psm-racks" width="9" height="11" patternUnits="userSpaceOnUse">
          <rect x="2" y="2" width="2" height="5" rx=".7" fill="#50d0d0" />
          <rect x="5" y="2" width="2" height="5" rx=".7" fill="#75deb7" />
        </pattern>
      </defs>
      <rect width="400" height="390" fill="#10202c" />
      <path d="M4 211 193 88 400 202 194 359Z" fill="url(#psm-ground)" stroke="#31594f" />
      <g className="power-scene-ground-grid" aria-hidden="true">
        <path d="m48 306 293-164M20 258l292 127M105 340l208-151M16 209l372 4M74 168l295 128M133 125l238 126" />
      </g>
      <path
        d="m23 213 171-105 184 101-184 134Z"
        fill="none"
        stroke="#4b8e78"
        strokeDasharray="3 6"
      />

      <g aria-hidden="true" className="power-scene-cables">
        <path
          className={`power-cable cable-grid${flows.grid > 0 ? ' is-flowing' : ''}`}
          d="M74 111C98 126 89 198 121 212"
        />
        <path
          className={`power-cable cable-battery${flows.battery > 0 ? ' is-flowing' : ''}`}
          d="M317 113C303 143 288 158 277 177"
        />
        <path
          className={`power-cable cable-charge${flows.charge > 0 ? ' is-flowing' : ''}`}
          d="M278 170C290 140 305 124 325 112"
        />
        <path
          className={`power-cable cable-generator${flows.generator > 0 ? ' is-flowing' : ''}`}
          d="M317 295C300 274 299 249 283 225"
        />
        <path
          className={`power-cable cable-unserved${flows.unserved > 0 ? ' is-flowing' : ''}`}
          d="M312 222C326 231 330 239 331 250"
        />
        <g className="cable-tag cable-tag-grid">
          <rect x="65" y="153" width="64" height="18" rx="5" />
          <text x="97" y="166" textAnchor="middle">
            {kw(flows.grid)}
          </text>
        </g>
        <g className="cable-tag cable-tag-battery">
          <rect x="276" y="137" width="68" height="18" rx="5" />
          <text x="310" y="150" textAnchor="middle">
            {kw(flows.battery)}
          </text>
        </g>
        <g className="cable-tag cable-tag-generator">
          <rect x="283" y="255" width="68" height="18" rx="5" />
          <text x="317" y="268" textAnchor="middle">
            {kw(flows.generator)}
          </text>
        </g>
        {flows.charge > 0 && (
          <g className="cable-tag cable-tag-charge">
            <rect x="278" y="158" width="70" height="18" rx="5" />
            <text x="313" y="171" textAnchor="middle">
              +{kw(flows.charge)}
            </text>
          </g>
        )}
        {flows.unserved > 0 && (
          <g className="cable-tag cable-tag-unserved">
            <rect x="307" y="226" width="79" height="18" rx="5" />
            <text x="346" y="239" textAnchor="middle">
              {kw(flows.unserved)} gap
            </text>
          </g>
        )}
      </g>

      <g
        {...choose('grid')}
        className={`power-scene-object source-grid${picked('grid') ? ' is-selected' : ''}`}
        aria-label={`Utility feed, ${kw(flows.grid)} this interval, state ${state('utility')}. Select for details.`}
      >
        <title>
          Utility feed · {kw(flows.grid)} · {state('utility')}
        </title>
        <rect className="power-hit-area" x="7" y="8" width="114" height="137" rx="8" />
        <path
          d="m67 28-25 57m25-57 25 57M51 48h32M47 59h40M54 39h26M42 85h50m-27-57-7 15h14Zm-20 44 20 13 20-13"
          fill="none"
          stroke="#a9c3d1"
          strokeWidth="2"
        />
        <path d="M30 46h74M34 52h66" stroke="#68cad1" strokeWidth="3" />
        <path
          d="m18 100 29-11 37 12-30 12Zm16 4v18l37 12v-19Zm37 12v19l30-11v-19Z"
          fill="#243a45"
          stroke="#618276"
        />
        <rect x="18" y="127" width="104" height="27" rx="6" className="power-label-plate" />
        <text x="70" y="139" textAnchor="middle" className="power-label-main">
          UTILITY FEED
        </text>
        <text x="70" y="150" textAnchor="middle" className="power-label-sub">
          {state('utility')}
        </text>
      </g>

      <path d="m82 219 113-71 128 52-116 79Z" fill="#0a171e" opacity=".7" />
      <path d="m102 158 105-40 112 39-111 42Z" fill="#30485a" stroke="#69828e" />
      <path d="m102 158 106 41v79l-106-39Z" fill="#193143" stroke="#547080" />
      <path d="m208 199 111-42v79l-111 42Z" fill="#122735" stroke="#456171" />
      <g aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => {
          const x = 114 + i * 22;
          const y = 167 + i * 8.5;
          return (
            <g key={i}>
              <path d={`m${x} ${y} 16 6v45l-16-6Z`} fill="#0c1b26" stroke="#547182" />
              <path d={`m${x + 3} ${y + 8} 10 4v28l-10-4Z`} fill="url(#psm-racks)" />
            </g>
          );
        })}
        <path
          d="m102 158 106 41 111-42M102 238l106 40 111-42"
          fill="none"
          stroke="#70a1aa"
          strokeWidth="2"
        />
        <path d="m102 164 106 41" stroke="#67d4ca" strokeWidth="4" opacity=".55" />
        <path d="m218 188v65m22-73v65m22-73v65m22-73v65" stroke="#456272" strokeWidth="1.4" />
        <path d="m220 242 92-35m-92 17 92-35" stroke="#417f89" strokeWidth="4" opacity=".55" />
        <path
          d="m132 151 22-8 17 6-22 8Zm0 0v13l17 6v-13Zm17 6v13l22-8v-13Z"
          fill="#354f5e"
          stroke="#78939a"
        />
        <path
          d="m190 129 22-8 17 6-22 8Zm0 0v13l17 6v-13Zm17 6v13l22-8v-13Z"
          fill="#354f5e"
          stroke="#78939a"
        />
      </g>
      <g
        className={`power-scene-object source-site${picked('site') ? ' is-selected' : ''}`}
        {...choose('site')}
        aria-label={`Server hall and IT load, ${kw(row.served_it_kw)} served of ${kw(row.requested_it_kw)} requested, ${kw(row.unserved_it_kw)} unserved. Select for details.`}
      >
        <title>
          Server hall · {kw(row.served_it_kw)} served · {kw(row.unserved_it_kw)} unserved
        </title>
        <path
          className="power-hit-area"
          d="M102 158 208 199 319 157 319 236 208 278 102 238Z M113 284H298V314H113Z"
        />
        <rect x="113" y="284" width="185" height="30" rx="6" className="power-label-plate" />
        <text x="205" y="297" textAnchor="middle" className="power-label-main">
          SERVER HALL · IT LOAD
        </text>
        <text x="205" y="309" textAnchor="middle" className="power-label-sub">
          {kw(row.served_it_kw)} served
        </text>
      </g>

      <g
        className={`power-scene-object source-battery${picked('battery') ? ' is-selected' : ''}`}
        {...choose('battery')}
        aria-label={`UPS battery, ${kw(flows.battery)} discharging, ${kw(flows.charge)} charging, ${kwh(row.battery_end_kwh)} at interval end. Select for details.`}
      >
        <title>UPS battery · {kwh(row.battery_end_kwh)} at interval end</title>
        <rect className="power-hit-area" x="277" y="11" width="120" height="133" rx="8" />
        <path d="m295 42 43-16 48 15-43 17Z" fill="#50456b" stroke="#ad9ad6" />
        <path d="M295 42v47l48 16V58Z" fill="#302b46" stroke="#8c7bb3" />
        <path d="M343 58v47l43-16V41Z" fill="#28253c" stroke="#766b9a" />
        <path
          d="M302 46v38m11-34v38m11-34v38m24-25 31-11m-31 22 31-11m-31 22 31-11"
          stroke="#887da9"
          strokeWidth="1.7"
        />
        <path d="m316 91 22 8" stroke="#bda7e8" strokeWidth="3" />
        <rect x="300" y="103" width="98" height="27" rx="6" className="power-label-plate" />
        <text x="349" y="115" textAnchor="middle" className="power-label-main">
          UPS BATTERY
        </text>
        <text x="349" y="126" textAnchor="middle" className="power-label-sub">
          {kwh(row.battery_end_kwh)} · {state('battery')}
        </text>
      </g>

      <g
        className={`power-scene-object source-generator${picked('generator') ? ' is-selected' : ''}`}
        {...choose('generator')}
        aria-label={`Standby generator, ${kw(flows.generator)} output this interval, state ${state('generator')}. Select for details.`}
      >
        <title>
          Standby generator · {kw(flows.generator)} · {state('generator')}
        </title>
        <rect className="power-hit-area" x="274" y="276" width="124" height="108" rx="8" />
        <path d="m286 301 42-16 55 16-42 17Z" fill="#75552f" stroke="#e5b36b" />
        <path d="M286 301v39l55 18v-40Z" fill="#493824" stroke="#b98448" />
        <path d="M341 318v40l42-18v-39Z" fill="#382e22" stroke="#9b713f" />
        <path
          d="M295 305v29m9-25v29m9-26v29m9-26v29m27-16v26m8-29v26m8-29v26"
          stroke="#e2a353"
          strokeWidth="2"
          opacity=".7"
        />
        <path d="M328 286v-12h9v16" fill="none" stroke="#c28e50" strokeWidth="2" />
        <circle
          cx="335"
          cy="342"
          r="4"
          fill={flows.generator > 0 ? '#ffd18a' : '#694e31'}
          className="generator-indicator"
        />
        <rect x="278" y="358" width="119" height="27" rx="6" className="power-label-plate" />
        <text x="337" y="370" textAnchor="middle" className="power-label-main">
          GENERATOR
        </text>
        <text x="337" y="381" textAnchor="middle" className="power-label-sub">
          {state('generator')}
        </text>
      </g>
    </svg>
  );
}

export function PowerScene({ run, row, motion, onMotionChange }: PowerSceneProps) {
  const [selected, setSelected] = useState<SourceKey>('site');
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 640,
  );
  const [view, setView] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setCompact((current) => (width < 600 ? true : width > 640 ? false : current));
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || !stageRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5;
    const y = (event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5;
    stageRef.current.style.setProperty('--scene-pointer-x', `${-y * 2.6}deg`);
    stageRef.current.style.setProperty('--scene-pointer-y', `${x * 3.3}deg`);
  };

  const resetPointer = () => {
    if (!stageRef.current) return;
    stageRef.current.style.setProperty('--scene-pointer-x', '0deg');
    stageRef.current.style.setProperty('--scene-pointer-y', '0deg');
  };

  const motionAllowed = motion && !reducedMotion;
  const assetFor = (ids: string[]) =>
    run.scenario.assets.find(
      (asset) => ids.includes(asset.id) || ids.includes(asset.kind.toLowerCase()),
    );
  const gridAsset = assetFor(['utility', 'grid']);
  const generatorAsset = assetFor(['generator']);
  const batteryAsset = assetFor(['battery', 'ups']);
  const siteAsset = assetFor(['it-load', 'load', 'server-hall']);
  const chosen =
    selected === 'grid'
      ? { asset: gridAsset, title: gridAsset?.name ?? 'Utility feed', value: row.grid_kw }
      : selected === 'generator'
        ? {
            asset: generatorAsset,
            title: generatorAsset?.name ?? 'Standby generator',
            value: row.generator_kw,
          }
        : selected === 'battery'
          ? {
              asset: batteryAsset,
              title: batteryAsset?.name ?? 'UPS battery',
              value: row.battery_discharge_kw,
            }
          : {
              asset: siteAsset,
              title: siteAsset?.name ?? 'Server hall · IT load',
              value: row.served_it_kw,
            };
  const chosenState = chosen.asset ? words(row.asset_states[chosen.asset.id]) : 'not specified';
  const chosenCapacity = chosen.asset?.capacity_kw;
  const detailLabel =
    selected === 'site'
      ? 'IT served in interval'
      : selected === 'battery'
        ? 'Battery discharge in interval'
        : 'Supply delivered in interval';
  const detailExtras =
    selected === 'site' ? (
      <>
        <div className="power-scene-detail-metric">
          <span>Requested</span>
          <strong>
            <PowerValue value={row.requested_it_kw} />
          </strong>
        </div>
        <div
          className={`power-scene-detail-metric${numeric(row.unserved_it_kw) > 0 ? ' has-unserved' : ''}`}
        >
          <span>Unserved</span>
          <strong>
            <PowerValue value={row.unserved_it_kw} />
          </strong>
        </div>
      </>
    ) : selected === 'battery' ? (
      <>
        <div className="power-scene-detail-metric">
          <span>Charging</span>
          <strong>
            <PowerValue value={row.battery_charge_kw} />
          </strong>
        </div>
        <div className="power-scene-detail-metric">
          <span>Energy at interval end</span>
          <strong>
            {kwh(row.battery_end_kwh)} / {kwh(run.scenario.battery_capacity_kwh)}
          </strong>
        </div>
      </>
    ) : (
      <div className="power-scene-detail-metric">
        <span>Path rating</span>
        <strong>{chosenCapacity ? kw(chosenCapacity) : 'Not specified'}</strong>
      </div>
    );

  return (
    <section className="power-scene" aria-label="Power flow scene" data-compact={compact}>
      <div className="power-scene-topline">
        <div className="power-scene-caption">
          <span className="power-scene-live-dot" aria-hidden="true" />
          <span>
            Scenario replay <span className="power-scene-caption-separator">·</span> not live
            telemetry
          </span>
        </div>
        <div className="power-scene-controls" aria-label="Scene controls">
          <button
            type="button"
            className="power-scene-control power-scene-turn"
            aria-label="Turn scene left"
            title="Turn scene left"
            onClick={() => setView((current) => Math.max(-8, current - 3))}
          >
            ↶
          </button>
          <button
            type="button"
            className="power-scene-control power-scene-turn"
            aria-label="Turn scene right"
            title="Turn scene right"
            onClick={() => setView((current) => Math.min(8, current + 3))}
          >
            ↷
          </button>
          <button
            type="button"
            className="power-scene-control power-scene-reset"
            onClick={() => {
              setView(0);
              resetPointer();
            }}
          >
            Reset view
          </button>
          <button
            type="button"
            className="power-scene-control power-scene-motion"
            onClick={() => onMotionChange(!motion)}
          >
            {motion ? 'Pause animation' : 'Resume animation'}
          </button>
        </div>
      </div>

      <div
        className="power-scene-stage"
        ref={stageRef}
        data-motion={motionAllowed ? 'on' : 'off'}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetPointer}
        style={{ '--scene-turn': `${view}deg` } as CSSProperties}
      >
        <div className="power-scene-art" aria-describedby="power-scene-description">
          {compact ? (
            <MobileCampus row={row} selected={selected} onSelect={setSelected} />
          ) : (
            <DesktopCampus row={row} selected={selected} onSelect={setSelected} />
          )}
        </div>
      </div>

      <div className="power-scene-legend" aria-label="Power flow legend">
        <span>
          <i className="legend-utility" /> Utility
        </span>
        <span>
          <i className="legend-generator" /> Generator
        </span>
        <span>
          <i className="legend-battery" /> Battery
        </span>
        <span>
          <i className="legend-unserved" /> Unserved demand
        </span>
        <span className="power-scene-flow-note">
          Line width shows interval power · moving dashes show active flow
        </span>
      </div>

      <div className="power-scene-details" aria-live="polite" id="power-scene-description">
        <div className="power-scene-detail-heading">
          <span className="eyebrow">Selected asset</span>
          <h3>{chosen.title}</h3>
        </div>
        <div className="power-scene-detail-metric">
          <span>State</span>
          <strong>{chosenState}</strong>
        </div>
        <div className="power-scene-detail-metric">
          <span>{detailLabel}</span>
          <strong>
            <PowerValue value={chosen.value} />
          </strong>
        </div>
        {detailExtras}
      </div>

      <span className="power-scene-sr-only">
        Text summary: For replay interval {row.start_s} to {row.end_s} seconds, utility supplies{' '}
        {kw(row.grid_kw)}, generator supplies {kw(row.generator_kw)}, battery discharges{' '}
        {kw(row.battery_discharge_kw)} and charges {kw(row.battery_charge_kw)}. IT demand is{' '}
        {kw(row.requested_it_kw)}; {kw(row.served_it_kw)} is served and {kw(row.unserved_it_kw)} is
        unserved. Battery energy at interval end is {kwh(row.battery_end_kwh)} of{' '}
        {kwh(run.scenario.battery_capacity_kwh)}. Scenario replay, not live telemetry.
      </span>
    </section>
  );
}
