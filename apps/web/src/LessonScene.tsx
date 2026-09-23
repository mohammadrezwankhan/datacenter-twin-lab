import { useEffect, useId, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { Lesson } from './course-lessons';
import type { Run } from './types';
import './lesson-scene.css';

type LessonSceneProps = {
  lesson: Lesson;
  run: Run | null;
  planning: {
    it_energy_kwh: string;
    non_it_energy_kwh: string;
    facility_energy_kwh: string;
  } | null;
  intervalIndex: number;
  onIntervalChange: (index: number) => void;
  motion: boolean;
  onMotionChange: (value: boolean) => void;
};

type Metric = { label: string; value: string };
type Inspection = { id: string; title: string; description: string; metrics: Metric[] };
const numeric = (value: string | number | null | undefined) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};
const hasValue = (value: string | number | null | undefined) =>
  value !== null &&
  value !== undefined &&
  String(value).trim() !== '' &&
  Number.isFinite(Number(value));
const amount = (value: string | number | null | undefined, digits = 1) =>
  hasValue(value)
    ? new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(numeric(value))
    : 'Not reported';
const kw = (value: string | number | null | undefined) =>
  hasValue(value) ? `${amount(value)} kW` : 'Not reported';
const kwh = (value: string | number | null | undefined, digits = 2) =>
  hasValue(value) ? `${amount(value, digits)} kWh` : 'Not reported';
const seconds = (value: string | number | null | undefined) =>
  hasValue(value) ? `${amount(value, 4)} s` : 'Not reported';
const words = (value: string | undefined) => (value ? value.replaceAll('_', ' ') : 'not specified');
const ratio = (value: string | number | null | undefined) =>
  hasValue(value) ? amount(value, 3) : 'Not reported';
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

function Selectable({
  id,
  title,
  detail,
  selected,
  onSelect,
  children,
}: {
  id: string;
  title: string;
  detail: string;
  selected: string;
  onSelect: (id: string) => void;
  children: ReactNode;
}) {
  const keyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(id);
    }
  };
  return (
    <g
      className={`lesson-scene-object${selected === id ? ' is-selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${title}. ${detail}. Select for details.`}
      aria-pressed={selected === id}
      onClick={() => onSelect(id)}
      onKeyDown={keyDown}
    >
      <title>
        {title} · {detail}
      </title>
      {children}
    </g>
  );
}

function SceneBase({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <svg className="lesson-scene-svg" viewBox="0 0 600 330" role="group" aria-label={label}>
      <defs>
        <linearGradient id={`${id}-floor`} x2=".8" y2="1">
          <stop stopColor="#18313a" />
          <stop offset="1" stopColor="#101e29" />
        </linearGradient>
        <linearGradient id={`${id}-roof`} x2="0" y2="1">
          <stop stopColor="#435762" />
          <stop offset="1" stopColor="#263b48" />
        </linearGradient>
        <linearGradient id={`${id}-face`} x2="0" y2="1">
          <stop stopColor="#24404e" />
          <stop offset="1" stopColor="#172d39" />
        </linearGradient>
        <pattern id={`${id}-rack`} width="12" height="13" patternUnits="userSpaceOnUse">
          <rect x="2" y="2" width="3" height="7" rx="1" fill="#71ddd0" />
          <rect x="7" y="2" width="3" height="7" rx="1" fill="#76aee8" />
        </pattern>
      </defs>
      <path d="m14 236 282-165 290 159-286 91Z" fill={`url(#${id}-floor)`} stroke="#31525e" />
      <g className="lesson-scene-floor-grid" aria-hidden="true">
        <path d="m43 267 258-150m-225 176 258-151m-181 179 258-150M92 201l264 104m-207-161 266 103m-207-160 262 101" />
      </g>
      {children}
      <path
        d="m20 237 276-160 278 153"
        fill="none"
        stroke="#5c8c8b"
        strokeOpacity=".28"
        strokeDasharray="3 8"
      />
    </svg>
  );
}

function ServerHall({
  sceneId,
  x = 220,
  y = 94,
  scale = 1,
}: {
  sceneId: string;
  x?: number;
  y?: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden="true">
      <path d="m0 51 97-37 103 37-101 42Z" fill={`url(#${sceneId}-roof)`} stroke="#708a91" />
      <path d="m0 51 99 42v102L0 153Z" fill={`url(#${sceneId}-face)`} stroke="#53717d" />
      <path d="m99 93 101-42v102l-101 42Z" fill="#142936" stroke="#45616d" />
      {Array.from({ length: 5 }, (_, index) => {
        const xPos = 11 + index * 18;
        const yPos = 61 + index * 7.5;
        return (
          <g key={index}>
            <path d={`m${xPos} ${yPos} 12 5v69l-12-5Z`} fill="#0d1b24" stroke="#46616d" />
            <path d={`m${xPos + 2} ${yPos + 12} 8 3v46l-8-3Z`} fill={`url(#${sceneId}-rack)`} />
          </g>
        );
      })}
      <path
        d="m0 51 99 42 101-42m-200 81 99 42 101-42"
        fill="none"
        stroke="#89b9b3"
        strokeOpacity=".6"
      />
      <path d="m8 47 85-33" stroke="#67d7ca" strokeWidth="4" opacity=".68" />
    </g>
  );
}

function EquipmentLabel({
  x,
  y,
  width,
  title,
  value,
}: {
  x: number;
  y: number;
  width: number;
  title: string;
  value: string;
}) {
  return (
    <g aria-hidden="true">
      <rect x={x} y={y} width={width} height="36" rx="8" fill="#0d1b25" stroke="#47616b" />
      <text x={x + width / 2} y={y + 14} textAnchor="middle" className="lesson-scene-label">
        {title}
      </text>
      <text x={x + width / 2} y={y + 28} textAnchor="middle" className="lesson-scene-value">
        {value}
      </text>
    </g>
  );
}

function PowerEnergyArt({
  run,
  row,
  id,
  selected,
  onSelect,
}: {
  run: Run;
  row?: Run['intervals'][number];
  id: string;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const requested = numeric(row?.requested_it_kw);
  const intervalEnergy = numeric(row?.energy.requested_it_kwh);
  const serverDetail = `${kw(row?.served_it_kw)} served of ${kw(row?.requested_it_kw)} requested`;
  return (
    <SceneBase id={id} label="Power converted to energy over a selected simulation interval">
      <Selectable
        id="load"
        title="Server hall · IT demand"
        detail={serverDetail}
        selected={selected}
        onSelect={onSelect}
      >
        <rect className="lesson-scene-hit" x="211" y="86" width="211" height="204" rx="12" />
        <ServerHall sceneId={id} />
        <EquipmentLabel
          x={219}
          y={286}
          width={202}
          title="IT LOAD · SELECTED INTERVAL"
          value={kw(row?.requested_it_kw)}
        />
      </Selectable>
      <Selectable
        id="clock"
        title="Elapsed interval"
        detail={`${seconds(row?.duration_s)} elapsed`}
        selected={selected}
        onSelect={onSelect}
      >
        <circle cx="129" cy="156" r="47" fill="#152631" stroke="#e1b56e" strokeWidth="2" />
        <circle
          cx="129"
          cy="156"
          r="37"
          fill="none"
          stroke="#d9a85e"
          strokeOpacity=".4"
          strokeDasharray="2 7"
        />
        <path
          d="M129 129v29l20 12"
          fill="none"
          stroke="#ffe0a6"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="129" cy="156" r="4" fill="#ffe0a6" />
        <EquipmentLabel x={85} y={217} width={88} title="TIME" value={seconds(row?.duration_s)} />
      </Selectable>
      <Selectable
        id="energy"
        title="Requested IT energy"
        detail={kwh(intervalEnergy, 4)}
        selected={selected}
        onSelect={onSelect}
      >
        <path
          className={intervalEnergy > 0 ? 'lesson-scene-energy-flow' : undefined}
          d="M179 154h37"
          stroke="var(--lesson-accent, #6ce0d1)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="m209 145 12 9-12 9"
          fill="none"
          stroke="var(--lesson-accent, #6ce0d1)"
          strokeWidth="3"
        />
        <path d="m438 116 62-23 61 23-62 25Z" fill="#665338" stroke="#e4bd7f" />
        <path d="M438 116v74l61 23v-72Z" fill="#3d3326" stroke="#ad8a5a" />
        <path d="M499 141v72l62-23v-74Z" fill="#2c2922" stroke="#816845" />
        <path
          d="m456 128 43 16m-43 5 43 16m-43 5 43 16"
          stroke="#f1c678"
          strokeOpacity=".7"
          strokeWidth="3"
        />
        <EquipmentLabel
          x={441}
          y={221}
          width={119}
          title="IT ENERGY"
          value={kwh(intervalEnergy, 3)}
        />
      </Selectable>
      <text x="29" y="48" className="lesson-scene-overline">
        {kw(requested)} × {seconds(row?.duration_s)} → {kwh(intervalEnergy, 3)}
      </text>
      <text x="29" y="66" className="lesson-scene-subline">
        Energy is accumulated power across elapsed time · run {run.run_id.slice(0, 8)}
      </text>
    </SceneBase>
  );
}

function EfficiencyArt({
  run,
  row,
  id,
  selected,
  onSelect,
}: {
  run: Run;
  row?: Run['intervals'][number];
  id: string;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const efficiency = numeric(run.scenario.distribution_efficiency);
  const input = numeric(row?.electrical_source_kw);
  const delivered = numeric(row?.served_it_kw);
  return (
    <SceneBase
      id={id}
      label="Distribution efficiency and the difference between source and delivered power"
    >
      <Selectable
        id="source"
        title="Electrical source"
        detail={`${kw(input)} at the selected interval`}
        selected={selected}
        onSelect={onSelect}
      >
        <path d="m51 136 74-31 76 31-76 34Z" fill="#374d58" stroke="#96aeb1" />
        <path d="M51 136v76l74 32v-73Z" fill="#263b45" stroke="#718b92" />
        <path d="M125 170v74l76-32v-76Z" fill="#1a2e3a" stroke="#566f78" />
        <path
          d="m74 145 51 22m-51 6 51 22m-51 6 51 22m13-71 39-17m-39 38 39-17m-39 38 39-17"
          stroke="#80b2bb"
          strokeWidth="3"
        />
        <EquipmentLabel x={63} y={254} width={151} title="SOURCE" value={kw(input)} />
      </Selectable>
      <Selectable
        id="meter"
        title="Distribution efficiency"
        detail={`Assumed efficiency ${ratio(efficiency)}`}
        selected={selected}
        onSelect={onSelect}
      >
        <circle cx="306" cy="151" r="71" fill="#13232e" stroke="#47636f" strokeWidth="3" />
        <path
          d="M254 177a56 56 0 0 1 104 0"
          fill="none"
          stroke="#334955"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <path
          d="M254 177a56 56 0 0 1 104 0"
          fill="none"
          stroke="var(--lesson-accent, #6ce0d1)"
          strokeWidth="13"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${clamp(efficiency * 100, 0, 100)} 100`}
        />
        <path d="m306 169 27-37" stroke="#f3d49b" strokeWidth="4" strokeLinecap="round" />
        <circle cx="306" cy="169" r="7" fill="#f3d49b" />
        <text
          x="306"
          y="209"
          textAnchor="middle"
          className="lesson-scene-value lesson-scene-big-value"
        >
          {ratio(efficiency)}
        </text>
        <EquipmentLabel x={250} y={252} width={113} title="EFFICIENCY" value="assumption" />
      </Selectable>
      <Selectable
        id="load"
        title="Delivered IT power"
        detail={`${kw(delivered)} served; ${kw(row?.unserved_it_kw)} unserved`}
        selected={selected}
        onSelect={onSelect}
      >
        <path
          className={input > 0 ? 'lesson-scene-energy-flow' : undefined}
          d="M382 158h52"
          stroke="var(--lesson-accent, #6ce0d1)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="m426 149 12 9-12 9"
          fill="none"
          stroke="var(--lesson-accent, #6ce0d1)"
          strokeWidth="3"
        />
        <ServerHall sceneId={id} x={434} y={96} scale={0.64} />
        <EquipmentLabel x={432} y={252} width={146} title="IT DELIVERED" value={kw(delivered)} />
      </Selectable>
      <text x="29" y="48" className="lesson-scene-overline">
        {kw(input)} electrical source · {kw(delivered)} served · {kw(row?.unserved_it_kw)} unserved
      </text>
      <text x="29" y="67" className="lesson-scene-subline">
        Source and service come from the completed interval; efficiency is the scenario input.
      </text>
    </SceneBase>
  );
}

function BatteryArt({
  run,
  row,
  id,
  selected,
  onSelect,
  precharge = false,
}: {
  run: Run;
  row?: Run['intervals'][number];
  id: string;
  selected: string;
  onSelect: (id: string) => void;
  precharge?: boolean;
}) {
  const capacity = numeric(run.scenario.battery_capacity_kwh);
  const start = numeric(row?.battery_start_kwh);
  const end = numeric(row?.battery_end_kwh);
  const initial = numeric(run.scenario.battery_initial_kwh);
  const depletion = run.events.find((event) => event.action === 'battery_depleted');
  const level = capacity > 0 ? clamp((end / capacity) * 100, 0, 100) : 0;
  const samples =
    run.intervals.length > 46
      ? run.intervals.filter((_, index) => index % Math.ceil(run.intervals.length / 46) === 0)
      : run.intervals;
  return (
    <SceneBase
      id={id}
      label={
        precharge
          ? 'Battery energy before and during the supply event'
          : 'Finite battery reserve at the selected simulation interval'
      }
    >
      <Selectable
        id="battery"
        title="Battery energy store"
        detail={`${kwh(end)} at selected interval end of ${kwh(capacity)} capacity`}
        selected={selected}
        onSelect={onSelect}
      >
        <path d="m108 99 137-46 138 46-139 49Z" fill="#564d6d" stroke="#c0afe2" />
        <path d="M108 99v139l138 51V148Z" fill="#302b46" stroke="#9285b5" />
        <path d="M246 148v141l137-51V99Z" fill="#24253c" stroke="#70698f" />
        <path
          d="M128 116v103m21-96v101m21-94v101m21-94v101m21-94v101"
          stroke="#8981a8"
          strokeWidth="4"
          opacity=".75"
        />
        <path
          d="m264 163 97-34m-97 55 97-34m-97 55 97-34m-97 55 97-34"
          stroke="#81799d"
          strokeWidth="4"
          opacity=".6"
        />
        <path d="m154 129 92 35" stroke="#d3c2f0" strokeWidth="4" />
        <EquipmentLabel
          x={130}
          y={244}
          width={232}
          title={precharge ? 'BATTERY · SELECTED INTERVAL' : 'BATTERY · SELECTED INTERVAL'}
          value={`${kwh(end)} / ${kwh(capacity)}`}
        />
      </Selectable>
      <Selectable
        id="charge"
        title={precharge ? 'Charging before the outage' : 'Energy change in selected interval'}
        detail={
          precharge
            ? `${kw(run.scenario.battery_charge_kw)} charge limit; ${kwh(initial)} initial energy`
            : `${kw(row?.battery_discharge_kw)} discharge and ${kw(row?.battery_charge_kw)} charge`
        }
        selected={selected}
        onSelect={onSelect}
      >
        <rect
          x="420"
          y="97"
          width="80"
          height="165"
          rx="16"
          fill="#0c1c27"
          stroke="#718a91"
          strokeWidth="3"
        />
        <rect x="447" y="84" width="26" height="14" rx="4" fill="#718a91" />
        <rect
          x="429"
          y={252 - level * 1.35}
          width="62"
          height={Math.max(0, level * 1.35)}
          rx="8"
          fill="var(--lesson-accent, #6ce0d1)"
          opacity=".76"
        />
        <path d="M431 142h58m-58 48h58" stroke="#c5dfdc" strokeOpacity=".26" />
        <text x="460" y="282" textAnchor="middle" className="lesson-scene-value">
          {amount(level, 0)}%
        </text>
        <EquipmentLabel x={386} y={293} width={146} title="ENERGY LEVEL" value={kwh(end)} />
      </Selectable>
      {precharge ? (
        <Selectable
          id="timeline"
          title="Run battery history"
          detail={`${run.intervals.length} modeled intervals; outage and charging values reflect run`}
          selected={selected}
          onSelect={onSelect}
        >
          <g transform="translate(64 68)">
            <text x="0" y="0" className="lesson-scene-label">
              ENERGY BY INTERVAL
            </text>
            <path d="M0 29h478" stroke="#647881" strokeWidth="2" />
            {samples.map((sample, index) => {
              const x = samples.length > 1 ? (index * 478) / (samples.length - 1) : 0;
              const y =
                54 -
                (capacity > 0 ? clamp(numeric(sample.battery_end_kwh) / capacity, 0, 1) * 35 : 0);
              return (
                <circle
                  key={`${sample.start_s}-${index}`}
                  cx={x}
                  cy={y}
                  r={numeric(sample.battery_charge_kw) > 0 ? 4 : 2.5}
                  fill={numeric(sample.battery_charge_kw) > 0 ? '#e8bb76' : '#84b6c6'}
                />
              );
            })}
            <text x="0" y="73" className="lesson-scene-small">
              Interval samples · charge marks shown in amber
            </text>
          </g>
        </Selectable>
      ) : (
        <Selectable
          id="depletion"
          title="Battery depletion event"
          detail={
            depletion
              ? `Event at ${seconds(depletion.at_s)}`
              : initial === 0
                ? `Empty at start; ${kw(row?.unserved_it_kw)} unserved in the selected interval`
                : 'No depletion event recorded'
          }
          selected={selected}
          onSelect={onSelect}
        >
          <path d="m431 67 33-16 34 16v15l-34 17-33-17Z" fill="#384757" stroke="#e5ba79" />
          <path d="M464 50v33m-20-7 20 10 20-10" fill="none" stroke="#f4d89e" strokeWidth="2" />
          <EquipmentLabel
            x={413}
            y={107}
            width={113}
            title={depletion ? 'DEPLETION' : initial === 0 ? 'EMPTY AT START' : 'DEPLETION'}
            value={depletion ? seconds(depletion.at_s) : initial === 0 ? kwh(initial) : 'no event'}
          />
        </Selectable>
      )}
      <text x="29" y="36" className="lesson-scene-overline">
        Start {kwh(start)} · end {kwh(end)} · initial {kwh(initial)}
      </text>
      <text x="29" y="54" className="lesson-scene-subline">
        {precharge
          ? `Charging is limited by the modeled input and interval history · ${kw(row?.unserved_it_kw)} unserved here.`
          : `${kw(row?.unserved_it_kw)} unserved in this interval · stored energy is finite.`}
      </text>
    </SceneBase>
  );
}

function GeneratorArt({
  run,
  row,
  id,
  selected,
  onSelect,
  failedLesson = false,
}: {
  run: Run;
  row?: Run['intervals'][number];
  id: string;
  selected: string;
  onSelect: (id: string) => void;
  failedLesson?: boolean;
}) {
  const utilityId = run.scenario.assets.find((asset) => asset.kind === 'utility')?.id ?? 'utility';
  const generator = run.scenario.assets.find((asset) => asset.kind === 'generator');
  const utilityDown = run.events.find(
    (event) => event.action === 'asset_down' && event.target === utilityId,
  );
  const startRequest = run.events.find((event) => event.action === 'generator_start_requested');
  const genState = generator && row ? words(row.asset_states[generator.id]) : 'not specified';
  const everRunning =
    !!generator &&
    run.intervals.some((interval) => interval.asset_states[generator.id] === 'running');
  const outage = utilityDown ? seconds(utilityDown.at_s) : 'no utility outage event';
  const ready = startRequest?.ready_at_s;
  return (
    <SceneBase
      id={id}
      label={
        failedLesson
          ? 'Generator availability and simulated service during the outage'
          : 'Utility outage, battery bridge, and generator startup timeline'
      }
    >
      <Selectable
        id="utility"
        title="Utility supply"
        detail={`${words(row?.asset_states[utilityId])}; ${kw(row?.grid_kw)} in selected interval`}
        selected={selected}
        onSelect={onSelect}
      >
        <path d="m80 110 47-20 46 20-47 21Z" fill="#45545d" stroke="#a7bec0" />
        <path d="M80 110v78l46 22v-79Z" fill="#273c46" stroke="#79929a" />
        <path d="M126 131v79l47-22v-78Z" fill="#1d303a" stroke="#586f79" />
        <path d="m94 118 32 15m-32 8 32 15m-32 8 32 15" stroke="#91b7bf" strokeWidth="3" />
        <EquipmentLabel x={75} y={218} width={105} title="UTILITY" value={outage} />
      </Selectable>
      <Selectable
        id="battery"
        title="Battery bridge"
        detail={`${kw(row?.battery_discharge_kw)} discharge in selected interval`}
        selected={selected}
        onSelect={onSelect}
      >
        <path d="m246 91 64-22 65 22-65 24Z" fill="#554a68" stroke="#b5a2d5" />
        <path d="M246 91v72l64 25v-73Z" fill="#302b43" stroke="#9382b7" />
        <path d="M310 115v73l65-25V91Z" fill="#24243a" stroke="#776c97" />
        <path
          d="M260 100v52m15-47v53m15-47v52m32-32 38-13m-38 33 38-13"
          stroke="#a79ac2"
          strokeWidth="3"
        />
        <EquipmentLabel
          x={247}
          y={202}
          width={128}
          title="BATTERY"
          value={kw(row?.battery_discharge_kw)}
        />
      </Selectable>
      <Selectable
        id="generator"
        title="Standby generator"
        detail={`${genState}; ${kw(row?.generator_kw)} output in selected interval`}
        selected={selected}
        onSelect={onSelect}
      >
        <path d="m414 118 62-25 66 25-66 27Z" fill="#755936" stroke="#e7bb7a" />
        <path d="M414 118v72l62 26v-71Z" fill="#493a27" stroke="#c49452" />
        <path d="M476 145v71l66-26v-72Z" fill="#342e25" stroke="#99713e" />
        <path
          d="M427 125v55m13-50v56m13-50v56m13-51v55m21-31 40-16m-40 35 40-16"
          stroke="#dfaa61"
          strokeWidth="3"
          opacity=".75"
        />
        <circle
          cx="520"
          cy="111"
          r="6"
          fill={numeric(row?.generator_kw) > 0 ? '#ffd58c' : '#785933'}
        />
        <EquipmentLabel
          x={415}
          y={228}
          width={128}
          title={failedLesson ? 'GENERATOR' : 'GENERATOR'}
          value={words(generator && row ? row.asset_states[generator.id] : undefined)}
        />
      </Selectable>
      <path
        className={
          numeric(row?.grid_kw) + numeric(row?.battery_discharge_kw) + numeric(row?.generator_kw) >
          0
            ? 'lesson-scene-energy-flow'
            : undefined
        }
        d="M178 146c23 2 36 13 53 18m145-16 30-5"
        stroke="var(--lesson-accent, #6ce0d1)"
        strokeWidth="4"
        fill="none"
        strokeDasharray="6 5"
      />
      <Selectable
        id="sequence"
        title="Startup sequence"
        detail={
          startRequest
            ? `Start requested at ${seconds(startRequest.at_s)}; ready at ${ready ? seconds(ready) : 'not recorded'}`
            : 'No generator start request recorded'
        }
        selected={selected}
        onSelect={onSelect}
      >
        <path d="M64 283h476" stroke="#54707a" strokeWidth="2" />
        <circle cx="64" cy="283" r="6" fill="#e6a35d" />
        {utilityDown && (
          <path
            d={`M${64 + 476 * clamp(numeric(utilityDown.at_s) / Math.max(run.scenario.duration_s, 1), 0, 1)} 273v20`}
            stroke="#ee816e"
            strokeWidth="3"
          />
        )}
        {ready && (
          <path
            d={`M${64 + 476 * clamp(numeric(ready) / Math.max(run.scenario.duration_s, 1), 0, 1)} 273v20`}
            stroke="#72d9c5"
            strokeWidth="3"
          />
        )}
        <path d="M64 283h476" stroke="#98aeb3" strokeOpacity=".23" strokeWidth="8" />
        <text x="64" y="310" className="lesson-scene-small">
          OUTAGE {outage}
        </text>
        <text x="540" y="310" textAnchor="end" className="lesson-scene-small">
          START {startRequest ? seconds(startRequest.at_s) : 'not requested'} · SCHEDULED READY{' '}
          {ready ? seconds(ready) : 'not recorded'}
        </text>
      </Selectable>
      <text x="29" y="37" className="lesson-scene-overline">
        {failedLesson
          ? `Generator: ${genState}`
          : `${run.scenario.generator_start_delay_s} s configured start delay`}
      </text>
      <text x="29" y="56" className="lesson-scene-subline">
        {everRunning
          ? 'Generator running was recorded in at least one interval.'
          : 'No running interval was recorded; scheduled readiness does not mean generator output.'}
      </text>
    </SceneBase>
  );
}

function PathArt({
  run,
  row,
  id,
  selected,
  onSelect,
  shared = false,
  bus = false,
}: {
  run: Run;
  row?: Run['intervals'][number];
  id: string;
  selected: string;
  onSelect: (id: string) => void;
  shared?: boolean;
  bus?: boolean;
}) {
  const paths = run.scenario.assets.filter((asset) => asset.kind === 'distribution');
  const shownPaths = paths.slice(0, 4);
  const pathCenter = (index: number) =>
    shared
      ? 72 + ((index + 0.5) * 196) / Math.max(shownPaths.length, 1)
      : bus
        ? 168 + ((index + 0.5) * 112) / Math.max(shownPaths.length, 1)
        : 75 + ((index + 0.5) * 195) / Math.max(shownPaths.length, 1);
  const compactText = (value: string, max = 30) =>
    value.length > max ? `${value.slice(0, max - 1)}…` : value;
  const mainBus = run.scenario.assets.find(
    (asset) => asset.id === 'main-bus' || asset.kind.toLowerCase().includes('bus'),
  );
  const domains = [...new Set(paths.flatMap((asset) => asset.failure_domains))];
  const selectedBusState = mainBus && row ? words(row.asset_states[mainBus.id]) : 'not specified';
  const busColor =
    selectedBusState === 'available'
      ? '#75d9c4'
      : selectedBusState === 'unavailable'
        ? '#e88c77'
        : '#a4b9bf';
  const inspectMetric = (assetId: string) =>
    row?.feed_flows_kw.find((flow) => flow.source === assetId || flow.target === assetId)?.kw ??
    undefined;
  return (
    <SceneBase
      id={id}
      label={
        shared
          ? 'Distribution path failure domains'
          : bus
            ? 'Shared main bus and downstream power paths'
            : 'Distribution path capacity and modeled flows'
      }
    >
      {shared &&
        shownPaths.map((asset, index) => {
          if (!asset.failure_domains.includes('shared-controls')) return null;
          const centerY = pathCenter(index);
          return (
            <path
              key={`domain-link-${asset.id}`}
              d={`M418 ${centerY + 13}H438`}
              fill="none"
              stroke="#d6aa6d"
              strokeOpacity=".62"
              strokeWidth="2"
              strokeDasharray="4 5"
              aria-hidden="true"
            />
          );
        })}
      {!shared && !bus && (
        <Selectable
          id="load"
          title="Requested IT demand"
          detail={`${kw(row?.requested_it_kw)} requested; ${kw(row?.unserved_it_kw)} unserved`}
          selected={selected}
          onSelect={onSelect}
        >
          <ServerHall sceneId={id} x={451} y={100} scale={0.58} />
          <EquipmentLabel
            x={438}
            y={233}
            width={151}
            title="IT LOAD"
            value={kw(row?.served_it_kw)}
          />
        </Selectable>
      )}
      {shared ? (
        <Selectable
          id="domain"
          title="Failure domains"
          detail={`${domains.length ? domains.join(', ') : 'No failure domains specified'}; shared-domain dependence is scenario-defined`}
          selected={selected}
          onSelect={onSelect}
        >
          <path d="m451 94 52-24 53 24-53 25Z" fill="#665444" stroke="#d9b77e" />
          <path d="M451 94v48l52 25v-48Z" fill="#44382e" stroke="#af9164" />
          <path d="M503 119v48l53-25V94Z" fill="#302b27" stroke="#88724f" />
          <text x="503" y="99" textAnchor="middle" className="lesson-scene-label">
            SHARED DOMAIN
          </text>
          <EquipmentLabel
            x={444}
            y={177}
            width={126}
            title="CONTROL LINKS"
            value={`${paths.filter((asset) => asset.failure_domains.includes('shared-controls')).length} paths`}
          />
        </Selectable>
      ) : bus ? (
        <Selectable
          id="bus"
          title="Main bus"
          detail={`State: ${selectedBusState}; scenario asset ${mainBus?.id ?? 'not specified'}`}
          selected={selected}
          onSelect={onSelect}
        >
          <path d="m246 83 56-25 57 25-57 27Z" fill="#526674" stroke="#b9c5c0" strokeWidth="2" />
          <path d="M246 83v42l56 27v-42Z" fill="#303f4b" stroke="#738993" />
          <path d="M302 110v42l57-27V83Z" fill="#243640" stroke="#627985" />
          <path
            d="m258 87 44 21 47-22"
            fill="none"
            stroke={busColor}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <text x="302" y="164" textAnchor="middle" className="lesson-scene-label">
            COMMON MAIN BUS · {selectedBusState}
          </text>
        </Selectable>
      ) : (
        <Selectable
          id="source"
          title="Source and demand"
          detail={`${kw(row?.electrical_source_kw)} electrical source; ${kw(row?.requested_it_kw)} IT requested`}
          selected={selected}
          onSelect={onSelect}
        >
          <path d="m59 129 62-25 65 25-64 29Z" fill="#4b5e68" stroke="#96aeb2" />
          <path d="M59 129v60l63 29v-60Z" fill="#2c404a" stroke="#6d8790" />
          <path d="M122 158v60l64-29v-60Z" fill="#1c313d" stroke="#58717a" />
          <EquipmentLabel
            x={58}
            y={229}
            width={129}
            title="UPSTREAM"
            value={kw(row?.electrical_source_kw)}
          />
        </Selectable>
      )}
      {paths.length ? (
        shownPaths.map((asset, index) => {
          const centerY = pathCenter(index);
          const x = shared ? 81 : bus ? 65 : 196;
          const textX = shared ? 202 : bus ? 178 : 300;
          const state = row ? words(row.asset_states[asset.id]) : 'not specified';
          const stateColor =
            state === 'available'
              ? 'var(--lesson-accent, #6ce0d1)'
              : state === 'unavailable'
                ? '#e38373'
                : '#8ba1a9';
          const stateDash = state === 'unavailable' ? '7 7' : state === 'available' ? '0' : '4 5';
          const capacity = asset.capacity_kw ? kw(asset.capacity_kw) : 'not specified';
          const flow = inspectMetric(asset.id);
          const flowLabel = kw(flow);
          const members = asset.failure_domains.join(', ') || 'no domains specified';
          return (
            <Selectable
              key={asset.id}
              id={`path-${asset.id}`}
              title={asset.name}
              detail={`${capacity} gross capacity; ${flowLabel} modeled feed; ${state}`}
              selected={selected}
              onSelect={onSelect}
            >
              <path
                d={`m${x} ${centerY} 48-20 49 20-49 22Z`}
                fill={
                  state === 'available'
                    ? '#39535d'
                    : state === 'unavailable'
                      ? '#4b3c40'
                      : '#35434a'
                }
                stroke={stateColor}
              />
              <path d={`M${x} ${centerY}v34l48 24v-36Z`} fill="#263c47" stroke="#55717b" />
              <path
                d={`M${x + 48} ${centerY + 22}v36l49-24v-34Z`}
                fill="#1a2d38"
                stroke="#4d6873"
              />
              <path
                d={`M${x + 101} ${centerY + 12}h${shared ? 19 : bus ? 19 : 14}`}
                stroke={stateColor}
                strokeWidth="5"
                strokeDasharray={stateDash}
                className={numeric(flow) > 0 ? 'lesson-scene-energy-flow' : undefined}
              />
              <text x={textX} y={centerY + 2} className="lesson-scene-label">
                {shared || bus
                  ? `${compactText(asset.name, shared ? 25 : 38)} · ${capacity}`
                  : compactText(asset.name, 20)}
              </text>
              <text x={textX} y={centerY + 17} className="lesson-scene-small">
                {shared
                  ? `${state} · ${compactText(members, 34)}`
                  : bus
                    ? state
                    : `${state} · ${capacity}`}
              </text>
              <text x={textX} y={centerY + 32} className="lesson-scene-small">
                Flow {flowLabel}
              </text>
            </Selectable>
          );
        })
      ) : (
        <text x="84" y="192" className="lesson-scene-label">
          Distribution path assets not specified
        </text>
      )}
      {bus && !mainBus && (
        <text x="29" y="40" className="lesson-scene-overline">
          Main bus asset not specified in this run
        </text>
      )}
      {!shared && !bus && (
        <text x="29" y="40" className="lesson-scene-overline">
          {kw(run.summary.peak_unserved_kw)} peak unserved · path state and limits from run
        </text>
      )}
      {shared && (
        <text x="29" y="37" className="lesson-scene-overline">
          Paths list their explicit failure-domain memberships
        </text>
      )}
      {bus && (
        <text x="29" y="39" className="lesson-scene-overline">
          Common upstream asset · state {selectedBusState}
        </text>
      )}
    </SceneBase>
  );
}

function AiReserveArt({
  run,
  row,
  id,
  selected,
  onSelect,
}: {
  run: Run;
  row?: Run['intervals'][number];
  id: string;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const depletion = run.events.find((event) => event.action === 'battery_depleted');
  const capacity = numeric(run.scenario.battery_capacity_kwh);
  const level = capacity > 0 ? clamp((numeric(row?.battery_end_kwh) / capacity) * 100, 0, 100) : 0;
  return (
    <SceneBase id={id} label="Aggregate IT electrical demand and finite battery reserve">
      <Selectable
        id="cluster"
        title="Aggregate IT electrical demand"
        detail={`${kw(row?.requested_it_kw)} requested; GPU workloads and performance are not modeled`}
        selected={selected}
        onSelect={onSelect}
      >
        <path d="m67 121 75-34 81 34-79 37Z" fill="#355867" stroke="#7cb9c3" />
        <path d="M67 121v89l77 35v-87Z" fill="#243d4b" stroke="#56818b" />
        <path d="M144 158v87l79-35v-89Z" fill="#1a303f" stroke="#476c79" />
        <path
          d="m85 129 59 27m-59 14 59 27m-59 14 59 27m-26-125v86m24-75v85m24-75v86m24-94v85"
          stroke="#77c8cc"
          strokeWidth="3"
          opacity=".7"
        />
        <EquipmentLabel
          x={69}
          y={254}
          width={156}
          title="AGGREGATE IT LOAD"
          value={kw(row?.requested_it_kw)}
        />
      </Selectable>
      <Selectable
        id="reserve"
        title="Battery reserve"
        detail={`${kwh(row?.battery_end_kwh)} at selected interval end; ${kwh(capacity)} capacity`}
        selected={selected}
        onSelect={onSelect}
      >
        <path d="m340 94 76-27 77 27-77 29Z" fill="#5b4c6d" stroke="#b9a3db" />
        <path d="M340 94v110l76 31V123Z" fill="#322d49" stroke="#8e7db0" />
        <path d="M416 123v112l77-31V94Z" fill="#25263d" stroke="#766b96" />
        <path
          d="M354 106v84m16-78v84m16-78v84m42-69 48-17m-48 40 48-17m-48 40 48-17"
          stroke="#a395c1"
          strokeWidth="3"
        />
        <rect
          x="512"
          y="97"
          width="36"
          height="152"
          rx="10"
          fill="#101f2a"
          stroke="#728a91"
          strokeWidth="2"
        />
        <rect
          x="520"
          y={241 - level * 1.28}
          width="20"
          height={level * 1.28}
          rx="6"
          fill="var(--lesson-accent, #6ce0d1)"
          opacity=".8"
        />
        <EquipmentLabel
          x={340}
          y={254}
          width={208}
          title="STORED ENERGY"
          value={`${kwh(row?.battery_end_kwh)} · ${amount(level, 0)}%`}
        />
      </Selectable>
      <Selectable
        id="bridge"
        title="Recorded reserve depletion"
        detail={depletion ? seconds(depletion.at_s) : 'No depletion event recorded'}
        selected={selected}
        onSelect={onSelect}
      >
        <path
          d="M311 169H221"
          stroke="#e7b777"
          strokeWidth="5"
          strokeDasharray="6 6"
          className={
            numeric(row?.battery_discharge_kw) > 0 ? 'lesson-scene-energy-flow' : undefined
          }
        />
        <path d="m233 159-12 10 12 10" fill="none" stroke="#e7b777" strokeWidth="3" />
        <EquipmentLabel
          x={211}
          y={190}
          width={104}
          title="DEPLETION"
          value={depletion ? seconds(depletion.at_s) : 'no event'}
        />
      </Selectable>
      <text x="29" y="38" className="lesson-scene-overline">
        {kw(row?.requested_it_kw)} aggregate electrical demand ·{' '}
        {kwh(run.scenario.battery_initial_kwh)} initial reserve
      </text>
      <text x="29" y="57" className="lesson-scene-subline">
        Scale describes the scenario's aggregate electrical boundary, not GPU count, job throughput,
        or performance.
      </text>
    </SceneBase>
  );
}

function RecoveryArt({
  run,
  row,
  id,
  selected,
  onSelect,
}: {
  run: Run;
  row?: Run['intervals'][number];
  id: string;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const utilityId = run.scenario.assets.find((asset) => asset.kind === 'utility')?.id ?? 'utility';
  const down = run.events.find(
    (event) => event.action === 'asset_down' && event.target === utilityId,
  );
  const up = run.events.find((event) => event.action === 'asset_up' && event.target === utilityId);
  const depleted = run.events.find((event) => event.action === 'battery_depleted');
  const unserved = numeric(run.summary.unserved_duration_s);
  const duration = Math.max(numeric(run.scenario.duration_s), 1);
  const pos = (time: string | number | undefined) =>
    38 + 514 * clamp(numeric(time) / duration, 0, 1);
  const labelPos = (time: string | number | undefined, low = 78, high = 522) =>
    clamp(pos(time), low, high);
  const depletionRecoveryGap =
    depleted && up && numeric(depleted.at_s) < numeric(up.at_s)
      ? pos(up.at_s) - pos(depleted.at_s)
      : 0;
  const enlargedGap = depletionRecoveryGap > 0 && depletionRecoveryGap < 2;
  return (
    <SceneBase id={id} label="Exact outage, battery depletion, and utility recovery event timing">
      <Selectable
        id="timeline"
        title="Recovery timing"
        detail={`${kw(row?.unserved_it_kw)} unserved during the selected interval; run total ${seconds(unserved)} unserved`}
        selected={selected}
        onSelect={onSelect}
      >
        <rect x="38" y="126" width="514" height="26" rx="13" fill="#253b47" />
        {down && up && (
          <rect
            x={pos(down.at_s)}
            y="126"
            width={Math.max(0, pos(up.at_s) - pos(down.at_s))}
            height="26"
            rx="6"
            fill="#4f7480"
            opacity=".75"
          />
        )}
        {depletionRecoveryGap > 0 && (
          <rect
            x={pos(depleted?.at_s)}
            y="122"
            width={Math.max(2, depletionRecoveryGap)}
            height="34"
            rx="4"
            fill="#e98774"
            opacity=".92"
          />
        )}
        {down && <path d={`M${pos(down.at_s)} 104v65`} stroke="#e8b16c" strokeWidth="3" />}
        {depleted && <path d={`M${pos(depleted.at_s)} 103v68`} stroke="#f18472" strokeWidth="3" />}
        {up && <path d={`M${pos(up.at_s)} 104v65`} stroke="#70d5c1" strokeWidth="3" />}
        <circle cx="38" cy="139" r="6" fill="#d4e0df" />
        <text
          x={down ? labelPos(down.at_s) : 78}
          y="91"
          textAnchor="middle"
          className="lesson-scene-small"
        >
          {down ? `OUTAGE ${seconds(down.at_s)}` : 'NO OUTAGE EVENT'}
        </text>
        <text
          x={depleted ? labelPos(depleted.at_s, 100, 500) : 295}
          y="190"
          textAnchor="middle"
          className="lesson-scene-small"
        >
          {depleted ? `BATTERY DEPLETED ${seconds(depleted.at_s)}` : 'NO DEPLETION EVENT'}
        </text>
        <text
          x={up ? labelPos(up.at_s) : 522}
          y="91"
          textAnchor="middle"
          className="lesson-scene-small"
        >
          {up ? `RECOVERY ${seconds(up.at_s)}` : 'NO RECOVERY EVENT'}
        </text>
        <EquipmentLabel
          x={206}
          y={224}
          width={176}
          title="RUN TOTAL UNSERVED"
          value={seconds(unserved)}
        />
      </Selectable>
      <Selectable
        id="reserve"
        title="Battery at selected interval"
        detail={`${kwh(row?.battery_start_kwh)} start to ${kwh(row?.battery_end_kwh)} end`}
        selected={selected}
        onSelect={onSelect}
      >
        <path d="m130 214 35-14 37 14-37 16Z" fill="#584f70" stroke="#b9a8d6" />
        <path d="M130 214v52l35 14v-50Z" fill="#332f49" stroke="#897ca7" />
        <path d="M165 230v50l37-14v-52Z" fill="#27273c" stroke="#706989" />
        <EquipmentLabel
          x={111}
          y={283}
          width={110}
          title="RESERVE END"
          value={kwh(row?.battery_end_kwh)}
        />
      </Selectable>
      <text x="29" y="40" className="lesson-scene-overline">
        {kw(row?.unserved_it_kw)} unserved at selected replay interval
      </text>
      <text x="29" y="59" className="lesson-scene-subline">
        Event marks use the run's recorded times; red spans only where depletion precedes recovery.
      </text>
      {enlargedGap && (
        <text x="29" y="73" className="lesson-scene-small">
          Sub-pixel gap enlarged for visibility.
        </text>
      )}
      {enlargedGap && (
        <text x="29" y="73" className="lesson-scene-small">
          Sub-pixel gap enlarged for visibility.
        </text>
      )}
      {enlargedGap && (
        <text x="29" y="73" className="lesson-scene-small">
          Sub-pixel gap enlarged for visibility.
        </text>
      )}
    </SceneBase>
  );
}

function PueArt({
  planning,
  id,
  selected,
  onSelect,
}: {
  planning: LessonSceneProps['planning'];
  id: string;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const it = numeric(planning?.it_energy_kwh);
  const nonIt = numeric(planning?.non_it_energy_kwh);
  const facility = numeric(planning?.facility_energy_kwh);
  const itWidth = facility > 0 ? (it / facility) * 438 : 0;
  const nonItWidth = facility > 0 ? (nonIt / facility) * 438 : 0;
  return (
    <SceneBase id={id} label="PUE annual energy partition into IT energy and non-IT energy">
      <Selectable
        id="annual-energy"
        title="Annual facility energy"
        detail={kwh(facility, 0)}
        selected={selected}
        onSelect={onSelect}
      >
        <rect
          x="70"
          y="107"
          width="460"
          height="74"
          rx="16"
          fill="#0d1b25"
          stroke="#5c7380"
          strokeWidth="2"
        />
        {itWidth > 0 && <rect x="77" y="114" width={itWidth} height="60" rx="10" fill="#287c80" />}
        {nonItWidth > 0 && (
          <rect x={77 + itWidth} y="114" width={nonItWidth} height="60" rx="10" fill="#b77c42" />
        )}
        {itWidth > 30 && (
          <text x={77 + itWidth / 2} y="149" textAnchor="middle" className="lesson-scene-label">
            IT
          </text>
        )}
        {nonItWidth > 38 && (
          <text
            x={77 + itWidth + nonItWidth / 2}
            y="149"
            textAnchor="middle"
            className="lesson-scene-label"
          >
            NON-IT
          </text>
        )}
        <EquipmentLabel
          x={204}
          y={202}
          width={192}
          title="FACILITY TOTAL"
          value={kwh(facility, 0)}
        />
      </Selectable>
      <Selectable
        id="it"
        title="Annual IT energy"
        detail={kwh(it, 0)}
        selected={selected}
        onSelect={onSelect}
      >
        <path d="m97 239 67-28 69 28-69 31Z" fill="#3a6f73" stroke="#80d1c8" />
        <path d="M97 239v40l67 31v-40Z" fill="#28595e" stroke="#69a9a6" />
        <path d="M164 270v40l69-31v-40Z" fill="#21454e" stroke="#558f91" />
        <EquipmentLabel x={94} y={285} width={145} title="IT ENERGY" value={kwh(it, 0)} />
      </Selectable>
      <Selectable
        id="non-it"
        title="Annual non-IT energy"
        detail={kwh(nonIt, 0)}
        selected={selected}
        onSelect={onSelect}
      >
        <path d="m354 239 67-28 69 28-69 31Z" fill="#795d3f" stroke="#e4b673" />
        <path d="M354 239v40l67 31v-40Z" fill="#55432f" stroke="#ba925a" />
        <path d="M421 270v40l69-31v-40Z" fill="#3d352b" stroke="#98774d" />
        <EquipmentLabel x={348} y={285} width={151} title="NON-IT ENERGY" value={kwh(nonIt, 0)} />
      </Selectable>
      <text x="29" y="45" className="lesson-scene-overline">
        Annual energy planning · {ratio(facility && it ? facility / it : 0)} PUE assumption result
      </text>
      <text x="29" y="66" className="lesson-scene-subline">
        The partition is IT plus non-IT energy from the planning result; it describes energy, not
        continuity.
      </text>
    </SceneBase>
  );
}

function inspectorsFor(
  lesson: Lesson,
  run: Run | null,
  planning: LessonSceneProps['planning'],
  row: Run['intervals'][number] | undefined,
): Inspection[] {
  const add = (id: string, title: string, description: string, metrics: Metric[]): Inspection => ({
    id,
    title,
    description,
    metrics,
  });
  if (lesson.id === 'pue')
    return [
      add(
        'annual-energy',
        'Annual facility energy',
        'Planning result for the assumed PUE and constant annual IT load.',
        [
          { label: 'Facility energy', value: kwh(planning?.facility_energy_kwh, 0) },
          {
            label: 'PUE ratio',
            value: ratio(
              numeric(planning?.facility_energy_kwh) /
                Math.max(numeric(planning?.it_energy_kwh), 1),
            ),
          },
        ],
      ),
      add('it', 'Annual IT energy', 'IT energy from the PUE planning result.', [
        { label: 'IT energy', value: kwh(planning?.it_energy_kwh, 0) },
      ]),
      add('non-it', 'Annual non-IT energy', 'Non-IT energy from the PUE planning result.', [
        { label: 'Non-IT energy', value: kwh(planning?.non_it_energy_kwh, 0) },
      ]),
    ];
  if (!run) return [];
  switch (lesson.id) {
    case 'power-energy':
      return [
        add(
          'load',
          'Server hall · IT demand',
          'The requested and served IT power for the selected interval.',
          [
            { label: 'Requested power', value: kw(row?.requested_it_kw) },
            { label: 'Served power', value: kw(row?.served_it_kw) },
            { label: 'Requested energy', value: kwh(row?.energy.requested_it_kwh, 4) },
          ],
        ),
        add('clock', 'Elapsed interval', 'Interval duration taken from the completed run.', [
          { label: 'Start', value: seconds(row?.start_s) },
          { label: 'End', value: seconds(row?.end_s) },
          { label: 'Duration', value: seconds(row?.duration_s) },
        ]),
        add(
          'energy',
          'Requested IT energy',
          'Energy over this one selected interval, from the run energy ledger.',
          [
            { label: 'Interval energy', value: kwh(row?.energy.requested_it_kwh, 4) },
            { label: 'Run total', value: kwh(run.summary.requested_it_kwh, 4) },
          ],
        ),
      ];
    case 'distribution-loss':
      return [
        add(
          'source',
          'Electrical source',
          'Source power delivered to the modeled electrical boundary.',
          [
            { label: 'Electrical source', value: kw(row?.electrical_source_kw) },
            { label: 'Grid', value: kw(row?.grid_kw) },
          ],
        ),
        add(
          'meter',
          'Distribution efficiency',
          'Assumed distribution efficiency from this scenario.',
          [
            { label: 'Efficiency', value: ratio(run.scenario.distribution_efficiency) },
            { label: 'IT request', value: kw(row?.requested_it_kw) },
          ],
        ),
        add('load', 'Delivered IT power', 'IT service and unserved load in this interval.', [
          { label: 'Served', value: kw(row?.served_it_kw) },
          { label: 'Unserved', value: kw(row?.unserved_it_kw) },
        ]),
      ];
    case 'ride-through':
      return [
        add(
          'battery',
          'Battery energy store',
          'Finite stored energy recorded at the interval boundary.',
          [
            { label: 'Start', value: kwh(row?.battery_start_kwh) },
            { label: 'End', value: kwh(row?.battery_end_kwh) },
            { label: 'Capacity', value: kwh(run.scenario.battery_capacity_kwh) },
          ],
        ),
        add(
          'charge',
          'Energy change',
          'Charge and discharge power from the selected run interval.',
          [
            { label: 'Discharging', value: kw(row?.battery_discharge_kw) },
            { label: 'Charging', value: kw(row?.battery_charge_kw) },
          ],
        ),
        add(
          'depletion',
          'Battery depletion event',
          'An initially empty battery has no positive-to-zero crossing event; service state is shown separately.',
          [
            {
              label: 'Depleted at',
              value: run.events.find((event) => event.action === 'battery_depleted')
                ? seconds(run.events.find((event) => event.action === 'battery_depleted')!.at_s)
                : numeric(run.scenario.battery_initial_kwh) === 0
                  ? 'Empty at start'
                  : 'No event',
            },
            { label: 'Unserved in interval', value: kw(row?.unserved_it_kw) },
          ],
        ),
      ];
    case 'generator-delay':
    case 'generator-failure':
      return [
        add('utility', 'Utility supply', 'Utility state and power from the selected interval.', [
          {
            label: 'State',
            value: words(
              row?.asset_states[
                run.scenario.assets.find((asset) => asset.kind === 'utility')?.id ?? 'utility'
              ],
            ),
          },
          { label: 'Grid power', value: kw(row?.grid_kw) },
        ]),
        add('battery', 'Battery bridge', 'Battery discharge shown for this selected interval.', [
          { label: 'Discharge', value: kw(row?.battery_discharge_kw) },
          { label: 'Energy at end', value: kwh(row?.battery_end_kwh) },
        ]),
        add('generator', 'Standby generator', 'The modeled generator state and interval output.', [
          {
            label: 'State',
            value: words(
              row?.asset_states[
                run.scenario.assets.find((asset) => asset.kind === 'generator')?.id ?? 'generator'
              ],
            ),
          },
          { label: 'Output', value: kw(row?.generator_kw) },
        ]),
        add(
          'sequence',
          'Startup sequence',
          'Scheduled readiness is an event time; generator output and running state are reported independently by intervals.',
          [
            {
              label: 'Start requested',
              value: (() => {
                const event = run.events.find(
                  (item) => item.action === 'generator_start_requested',
                );
                return event ? seconds(event.at_s) : 'Not requested';
              })(),
            },
            {
              label: 'Scheduled ready',
              value: run.events.find((item) => item.action === 'generator_start_requested')
                ?.ready_at_s
                ? seconds(
                    run.events.find((item) => item.action === 'generator_start_requested')!
                      .ready_at_s,
                  )
                : 'Not recorded',
            },
            {
              label: 'Running observed',
              value: (() => {
                const asset = run.scenario.assets.find((item) => item.kind === 'generator');
                return asset &&
                  run.intervals.some((interval) => interval.asset_states[asset.id] === 'running')
                  ? 'Yes'
                  : 'No interval recorded';
              })(),
            },
          ],
        ),
      ];
    case 'n-plus-one':
    case 'shared-controls':
    case 'single-point': {
      const paths = run.scenario.assets.filter((asset) => asset.kind === 'distribution');
      const mainBus = run.scenario.assets.find(
        (asset) => asset.id === 'main-bus' || asset.kind.toLowerCase().includes('bus'),
      );
      const entries: Inspection[] = paths.slice(0, 4).map((asset) =>
        add(
          `path-${asset.id}`,
          asset.name,
          'Modeled distribution asset; capacity, state and feed are scenario/run values.',
          [
            {
              label: 'Gross capacity',
              value: asset.capacity_kw ? kw(asset.capacity_kw) : 'Not specified',
            },
            { label: 'State', value: words(row?.asset_states[asset.id]) },
            {
              label: 'Failure domains',
              value: asset.failure_domains.join(', ') || 'None specified',
            },
            {
              label: 'Feed flow',
              value: row?.feed_flows_kw.find(
                (flow) => flow.source === asset.id || flow.target === asset.id,
              )
                ? kw(
                    row.feed_flows_kw.find(
                      (flow) => flow.source === asset.id || flow.target === asset.id,
                    )!.kw,
                  )
                : 'Not reported',
            },
          ],
        ),
      );
      if (lesson.id === 'shared-controls')
        entries.unshift(
          add(
            'domain',
            'Failure domains',
            'The explicit domain memberships are attached to modeled assets.',
            [
              {
                label: 'Domains',
                value:
                  [...new Set(paths.flatMap((asset) => asset.failure_domains))].join(', ') ||
                  'None specified',
              },
            ],
          ),
        );
      if (lesson.id === 'single-point')
        entries.unshift(
          add('bus', 'Main bus', 'Common bus state comes from the selected interval.', [
            { label: 'Asset', value: mainBus?.id ?? 'Not specified' },
            {
              label: 'State',
              value: words(mainBus && row ? row.asset_states[mainBus.id] : undefined),
            },
          ]),
        );
      if (lesson.id === 'n-plus-one')
        entries.unshift(
          add(
            'source',
            'Source and demand',
            'Electrical source and demand from the selected interval.',
            [
              { label: 'Source', value: kw(row?.electrical_source_kw) },
              { label: 'Requested', value: kw(row?.requested_it_kw) },
              { label: 'Peak unserved', value: kw(run.summary.peak_unserved_kw) },
            ],
          ),
        );
      return entries.length
        ? entries
        : [
            add(
              'source',
              'Modeled network',
              'No distribution path assets are specified in this run.',
              [{ label: 'Peak unserved', value: kw(run.summary.peak_unserved_kw) }],
            ),
          ];
    }
    case 'precharge':
      return [
        add(
          'battery',
          'Battery energy store',
          'Opening and closing stored energy from this interval.',
          [
            { label: 'Start', value: kwh(row?.battery_start_kwh) },
            { label: 'End', value: kwh(row?.battery_end_kwh) },
            { label: 'Initial reserve', value: kwh(run.scenario.battery_initial_kwh) },
          ],
        ),
        add('charge', 'Charging before the outage', 'Scenario charging limit and interval input.', [
          { label: 'Charge limit', value: kw(run.scenario.battery_charge_kw) },
          { label: 'Charging in interval', value: kw(row?.battery_charge_kw) },
          { label: 'Discharge in interval', value: kw(row?.battery_discharge_kw) },
        ]),
        add(
          'timeline',
          'Run battery history',
          'Sampled values are actual run intervals; amber marks intervals with charging power.',
          [
            { label: 'Intervals', value: String(run.intervals.length) },
            { label: 'Final energy', value: kwh(run.summary.battery_final_kwh) },
          ],
        ),
      ];
    case 'ai-outage':
      return [
        add(
          'cluster',
          'Aggregate IT electrical demand',
          'Scenario is aggregate electrical demand and does not model GPU performance.',
          [
            { label: 'Requested IT power', value: kw(row?.requested_it_kw) },
            { label: 'Unserved', value: kw(row?.unserved_it_kw) },
          ],
        ),
        add(
          'reserve',
          'Battery reserve',
          'Stored energy is taken from this interval and run scenario.',
          [
            { label: 'Initial reserve', value: kwh(run.scenario.battery_initial_kwh) },
            { label: 'At interval end', value: kwh(row?.battery_end_kwh) },
            { label: 'Capacity', value: kwh(run.scenario.battery_capacity_kwh) },
          ],
        ),
        add(
          'bridge',
          'Recorded reserve depletion',
          'Depletion is displayed only when present in run events.',
          [
            {
              label: 'Event',
              value: run.events.find((event) => event.action === 'battery_depleted')
                ? seconds(run.events.find((event) => event.action === 'battery_depleted')!.at_s)
                : 'No event',
            },
          ],
        ),
      ];
    case 'recovery-deadline':
      return [
        add(
          'timeline',
          'Recovery timing',
          'Recorded outage, depletion and restoration events, on the simulation time axis.',
          [
            { label: 'Run unserved duration', value: seconds(run.summary.unserved_duration_s) },
            { label: 'Run unserved energy', value: kwh(run.summary.unserved_it_kwh, 4) },
          ],
        ),
        add(
          'reserve',
          'Battery at selected interval',
          'Stored energy recorded at interval start and end.',
          [
            { label: 'Start', value: kwh(row?.battery_start_kwh) },
            { label: 'End', value: kwh(row?.battery_end_kwh) },
          ],
        ),
      ];
    default:
      return [
        add('load', 'Selected interval', 'Values are from the completed simulation run.', [
          { label: 'Requested', value: kw(row?.requested_it_kw) },
          { label: 'Served', value: kw(row?.served_it_kw) },
        ]),
      ];
  }
}

function eventTitle(action: string, target?: string) {
  const name = action.replaceAll('_', ' ');
  return target ? `${name} · ${target.replaceAll('_', ' ')}` : name;
}

export function LessonScene({
  lesson,
  run,
  planning,
  intervalIndex,
  onIntervalChange,
  motion,
  onMotionChange,
}: LessonSceneProps) {
  const reactId = useId();
  const svgId = `lesson-${reactId.replaceAll(':', '')}`;
  const [selected, setSelected] = useState('');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const intervals = run?.intervals ?? [];
  const safeIndex = intervals.length
    ? clamp(Number.isFinite(intervalIndex) ? Math.floor(intervalIndex) : 0, 0, intervals.length - 1)
    : 0;
  const row = intervals[safeIndex];
  const inspectors = inspectorsFor(lesson, run, planning, row);
  const activeSelection = inspectors.some((item) => item.id === selected)
    ? selected
    : (inspectors[0]?.id ?? '');
  const inspected = inspectors.find((item) => item.id === activeSelection);
  const motionActive = motion && !prefersReducedMotion;
  const handleEventJump = (at: string) => {
    if (!intervals.length) return;
    const time = numeric(at);
    // Intervals are half-open [start_s, end_s): boundary events belong to the interval starting there.
    // The final endpoint has no next row, so clamp that one to the last interval.
    const lastIndex = intervals.length - 1;
    if (time >= numeric(intervals[lastIndex].end_s)) {
      onIntervalChange(lastIndex);
      return;
    }
    const containing = intervals.findIndex(
      (interval) => numeric(interval.start_s) <= time && time < numeric(interval.end_s),
    );
    if (containing >= 0) {
      onIntervalChange(containing);
      return;
    }
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    intervals.forEach((interval, index) => {
      const gap = Math.abs(time - numeric(interval.start_s));
      if (gap < distance) {
        distance = gap;
        nearest = index;
      }
    });
    onIntervalChange(nearest);
  };
  const changeInterval = (value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && intervals.length)
      onIntervalChange(clamp(Math.floor(parsed), 0, intervals.length - 1));
  };

  let art: ReactNode;
  if (lesson.id === 'pue') {
    art = planning ? (
      <PueArt planning={planning} id={svgId} selected={activeSelection} onSelect={setSelected} />
    ) : null;
  } else if (run && row) {
    switch (lesson.id) {
      case 'power-energy':
        art = (
          <PowerEnergyArt
            run={run}
            row={row}
            id={svgId}
            selected={activeSelection}
            onSelect={setSelected}
          />
        );
        break;
      case 'distribution-loss':
        art = (
          <EfficiencyArt
            run={run}
            row={row}
            id={svgId}
            selected={activeSelection}
            onSelect={setSelected}
          />
        );
        break;
      case 'ride-through':
        art = (
          <BatteryArt
            run={run}
            row={row}
            id={svgId}
            selected={activeSelection}
            onSelect={setSelected}
          />
        );
        break;
      case 'generator-delay':
        art = (
          <GeneratorArt
            run={run}
            row={row}
            id={svgId}
            selected={activeSelection}
            onSelect={setSelected}
          />
        );
        break;
      case 'generator-failure':
        art = (
          <GeneratorArt
            run={run}
            row={row}
            id={svgId}
            selected={activeSelection}
            onSelect={setSelected}
            failedLesson
          />
        );
        break;
      case 'n-plus-one':
        art = (
          <PathArt
            run={run}
            row={row}
            id={svgId}
            selected={activeSelection}
            onSelect={setSelected}
          />
        );
        break;
      case 'shared-controls':
        art = (
          <PathArt
            run={run}
            row={row}
            id={svgId}
            selected={activeSelection}
            onSelect={setSelected}
            shared
          />
        );
        break;
      case 'single-point':
        art = (
          <PathArt
            run={run}
            row={row}
            id={svgId}
            selected={activeSelection}
            onSelect={setSelected}
            bus
          />
        );
        break;
      case 'precharge':
        art = (
          <BatteryArt
            run={run}
            row={row}
            id={svgId}
            selected={activeSelection}
            onSelect={setSelected}
            precharge
          />
        );
        break;
      case 'ai-outage':
        art = (
          <AiReserveArt
            run={run}
            row={row}
            id={svgId}
            selected={activeSelection}
            onSelect={setSelected}
          />
        );
        break;
      case 'recovery-deadline':
        art = (
          <RecoveryArt
            run={run}
            row={row}
            id={svgId}
            selected={activeSelection}
            onSelect={setSelected}
          />
        );
        break;
      default:
        art = (
          <PowerEnergyArt
            run={run}
            row={row}
            id={svgId}
            selected={activeSelection}
            onSelect={setSelected}
          />
        );
    }
  } else {
    art = null;
  }

  const relevantEvents = run?.events.slice(0, 6) ?? [];
  const intervalLabel = row
    ? `Interval ${safeIndex + 1} of ${intervals.length} · ${seconds(row.start_s)}–${seconds(row.end_s)}`
    : 'No simulation intervals';

  return (
    <section
      className="lesson-scene"
      aria-label="Lesson visualisation"
      data-motion={motionActive ? 'on' : 'off'}
    >
      <div className="lesson-scene-topline">
        <div className="lesson-scene-caption">
          <span className="lesson-scene-caption-mark" aria-hidden="true" />
          <span>
            {planning
              ? 'Annual planning result'
              : run
                ? 'Completed scenario replay'
                : 'Lesson result visualisation'}{' '}
            <span className="lesson-scene-caption-separator">·</span> select an object to inspect
          </span>
        </div>
        <button
          type="button"
          className="lesson-scene-motion-control"
          onClick={() => onMotionChange(!motion)}
          disabled={prefersReducedMotion}
          aria-pressed={!motionActive}
          aria-label={
            prefersReducedMotion
              ? 'Animation disabled by reduced motion preference'
              : motionActive
                ? 'Pause animation'
                : 'Resume animation'
          }
        >
          {prefersReducedMotion
            ? 'Reduced motion'
            : motionActive
              ? 'Pause motion'
              : 'Resume motion'}
        </button>
      </div>

      <div className="lesson-scene-stage" data-motion={motionActive ? 'on' : 'off'}>
        {art ?? (
          <div className="lesson-scene-empty" role="status">
            <span className="lesson-scene-empty-glyph" aria-hidden="true">
              ◈
            </span>
            <strong>
              {run && !intervals.length
                ? 'No intervals are recorded in this run'
                : lesson.id === 'pue'
                  ? 'Planning result is not available yet'
                  : 'Completed run is not available yet'}
            </strong>
            <span>
              {run && !intervals.length
                ? 'There are no simulation time slices to replay.'
                : 'This scene will use the returned lesson calculation.'}
            </span>
          </div>
        )}
      </div>

      {run && (
        <div className="lesson-scene-replay">
          <div className="lesson-scene-replay-heading">
            <label htmlFor={`${svgId}-replay`}>Lesson replay interval</label>
            <output htmlFor={`${svgId}-replay`}>{intervalLabel}</output>
          </div>
          <input
            id={`${svgId}-replay`}
            className="lesson-scene-range"
            type="range"
            min={0}
            max={Math.max(0, intervals.length - 1)}
            step={1}
            value={safeIndex}
            disabled={intervals.length < 2}
            onChange={(event) => changeInterval(event.currentTarget.value)}
            aria-label="Lesson replay interval"
            aria-valuetext={intervalLabel}
          />
          <div className="lesson-scene-replay-endpoints" aria-hidden="true">
            <span>{intervals.length ? seconds(intervals[0].start_s) : '—'}</span>
            <span>{intervals.length ? seconds(intervals[intervals.length - 1].end_s) : '—'}</span>
          </div>
          {!!relevantEvents.length && intervals.length > 0 && (
            <div className="lesson-scene-event-jumps" aria-label="Jump to run event">
              {relevantEvents.map((event, index) => (
                <button
                  key={`${event.action}-${event.at_s}-${index}`}
                  type="button"
                  onClick={() => handleEventJump(event.at_s)}
                  title={`Jump to ${eventTitle(event.action, event.target)} at ${seconds(event.at_s)}`}
                >
                  <span aria-hidden="true">{index + 1}</span>
                  {eventTitle(event.action, event.target)}
                </button>
              ))}
            </div>
          )}
          {!intervals.length && (
            <p className="lesson-scene-no-intervals">No intervals are available in this run.</p>
          )}
        </div>
      )}

      {inspected && (
        <div className="lesson-scene-inspect-control">
          <label htmlFor={`${svgId}-inspect`}>Inspect lesson component</label>
          <select
            id={`${svgId}-inspect`}
            value={activeSelection}
            onChange={(event) => setSelected(event.currentTarget.value)}
          >
            {inspectors.map((inspector) => (
              <option key={inspector.id} value={inspector.id}>
                {inspector.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {inspected && (
        <div className="lesson-scene-inspector" aria-live="polite">
          <div className="lesson-scene-inspector-heading">
            <span className="lesson-scene-inspector-kicker">Selected component</span>
            <h3>{inspected.title}</h3>
            <p>{inspected.description}</p>
          </div>
          <div className="lesson-scene-metrics">
            {inspected.metrics.map((metric) => (
              <div className="lesson-scene-metric" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="lesson-scene-footnote">
        Calculated scenario values and assumptions only · no facility telemetry, equipment rating
        inference, or controller action.
      </p>
    </section>
  );
}
