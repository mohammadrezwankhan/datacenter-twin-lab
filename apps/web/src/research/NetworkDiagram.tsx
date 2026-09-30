import { useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { ResearchStudy } from './types';

type NodeId = 'grid' | 'converter' | 'link' | 'load' | 'sm' | 'gfm' | 'gfl' | 'dc';
type NodeInfo = { title: string; note: string; color: string };

function NodeButton({
  id,
  info,
  active,
  onPick,
  children,
}: {
  id: NodeId;
  info: NodeInfo;
  active: boolean;
  onPick: (id: NodeId) => void;
  children: ReactNode;
}) {
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPick(id);
    }
  };
  return (
    <g
      className={'research-node research-node-' + id + (active ? ' is-active' : '')}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      aria-label={info.title + '. ' + info.note}
      onClick={() => onPick(id)}
      onKeyDown={onKeyDown}
      style={{ '--node-color': info.color } as React.CSSProperties}
    >
      <title>
        {info.title} · {info.note}
      </title>
      {children}
    </g>
  );
}

const casePortInfo: Record<'sm' | 'gfm' | 'gfl' | 'dc', NodeInfo> = {
  sm: {
    title: 'Synchronous machine port',
    note: 'Rotating-machine states participate in the linearized network.',
    color: '#e7b15b',
  },
  gfm: {
    title: 'Grid-forming converter port',
    note: 'Grid-forming averaged converter and control states.',
    color: '#b59aff',
  },
  gfl: {
    title: 'Grid-following converter port',
    note: 'Grid-following averaged converter and control states.',
    color: '#66d3d7',
  },
  dc: {
    title: 'DC-link port',
    note: 'DC-link voltage and energy states in the network model.',
    color: '#ed8fa0',
  },
};

function IsoBlock({
  x,
  y,
  width,
  height,
  depth,
  color,
  label,
  sublabel,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  color: string;
  label: string;
  sublabel: string;
}) {
  const shift = depth * 0.55;
  return (
    <>
      <path
        d={
          'M' +
          x +
          ' ' +
          (y + shift) +
          'L' +
          (x + depth) +
          ' ' +
          y +
          'L' +
          (x + width + depth) +
          ' ' +
          (y + shift) +
          'L' +
          (x + width) +
          ' ' +
          (y + shift * 2) +
          'Z'
        }
        fill={color}
        fillOpacity=".34"
        stroke={color}
      />
      <path
        d={
          'M' +
          x +
          ' ' +
          (y + shift) +
          'L' +
          (x + width) +
          ' ' +
          (y + shift * 2) +
          'V' +
          (y + shift * 2 + height) +
          'L' +
          x +
          ' ' +
          (y + shift + height) +
          'Z'
        }
        fill="#102330"
        stroke={color}
        strokeOpacity=".65"
      />
      <path
        d={
          'M' +
          (x + width) +
          ' ' +
          (y + shift * 2) +
          'L' +
          (x + width + depth) +
          ' ' +
          (y + shift) +
          'V' +
          (y + shift + height) +
          'L' +
          (x + width) +
          ' ' +
          (y + shift * 2 + height) +
          'Z'
        }
        fill="#0b1b25"
        stroke={color}
        strokeOpacity=".65"
      />
      <text
        x={x + width / 2}
        y={y + shift * 2 + height / 2 - 1}
        textAnchor="middle"
        className="research-block-label"
      >
        {label}
      </text>
      <text
        x={x + width / 2}
        y={y + shift * 2 + height / 2 + 14}
        textAnchor="middle"
        className="research-block-sub"
      >
        {sublabel}
      </text>
    </>
  );
}

export function ResearchDiagram({ study }: { study: ResearchStudy }) {
  const [selected, setSelected] = useState<NodeId>(
    study.id === 'grid-network' ? 'gfm' : 'converter',
  );
  const network = study.id === 'grid-network';
  const infos: Record<NodeId, NodeInfo> = network
    ? {
        grid: {
          title: 'Modified nine-bus network',
          note: 'Example network boundary and interconnection.',
          color: '#d8e5ed',
        },
        converter: {
          title: 'Network operating point',
          note: 'Power-flow and linearized operating point.',
          color: study.color,
        },
        link: {
          title: 'Network coupling',
          note: 'The ports share the network state and operating point.',
          color: '#66d3d7',
        },
        load: {
          title: 'Scaled network loads',
          note: 'The selected per-unit load scale changes the example case.',
          color: '#ed8fa0',
        },
        ...casePortInfo,
      }
    : {
        grid: {
          title: 'Grid equivalent',
          note: 'Boundary used by this averaged teaching model.',
          color: '#58d8e8',
        },
        converter: {
          title: 'Voltage-source converter',
          note: 'Averaged converter and control dynamics.',
          color: study.color,
        },
        link: { title: 'DC link', note: 'Bus voltage and stored energy states.', color: '#b59aff' },
        load: {
          title: 'Server-load equivalent',
          note: 'Balanced electrical demand used by this study.',
          color: '#e7b15b',
        },
        ...casePortInfo,
      };
  const active = infos[selected];
  const labels =
    study.id === 'model-comparison'
      ? { converter: 'FULL + REDUCED', subtitle: '41 / 21 STATE' }
      : study.id === 'modal'
        ? { converter: 'LINEARIZED VSI', subtitle: 'EIGENVALUES' }
        : study.id === 'forced-response'
          ? { converter: 'AVERAGED VSI', subtitle: 'SYNTHETIC INPUT' }
          : { converter: 'AVERAGED VSI', subtitle: 'CONTROL DYNAMICS' };

  return (
    <div className="research-diagram-panel">
      <svg
        className="research-diagram"
        viewBox="0 0 1000 390"
        role="group"
        aria-label={
          network
            ? 'Interactive conceptual modified nine-bus diagram with synchronous-machine, grid-forming, grid-following and DC-link ports.'
            : 'Interactive conceptual isometric grid, averaged converter, DC-link and server-load study diagram.'
        }
      >
        <defs>
          <linearGradient id="research-room" x2="0" y2="1">
            <stop stopColor="#132a38" />
            <stop offset="1" stopColor="#0b1822" />
          </linearGradient>
          <linearGradient id="research-floor" x2=".85" y2="1">
            <stop stopColor="#1d3941" />
            <stop offset="1" stopColor="#10232d" />
          </linearGradient>
          <pattern
            id="research-floor-grid"
            width="40"
            height="30"
            patternUnits="userSpaceOnUse"
            patternTransform="skewY(-22)"
          >
            <path d="M40 0H0V30" fill="none" stroke="#40616a" strokeOpacity=".36" />
          </pattern>
        </defs>
        <rect width="1000" height="390" rx="10" fill="url(#research-room)" />
        <circle cx="831" cy="57" r="75" fill={study.color} opacity=".065" />
        <path d="M0 278 392 151 1000 267V390H0Z" fill="#0b1822" opacity=".7" />
        <path d="M44 293 394 151 952 299 594 380Z" fill="url(#research-floor)" stroke="#3c6169" />
        <path d="M44 293 394 151 952 299 594 380Z" fill="url(#research-floor-grid)" opacity=".8" />

        {!network ? (
          <>
            <path d="M224 205 315 205M482 215 560 215M697 215 782 215" className="research-cable" />
            <path
              d="M225 205 315 205M482 215 560 215M697 215 782 215"
              className="research-cable-highlight"
            />
            <NodeButton
              id="grid"
              info={infos.grid}
              active={selected === 'grid'}
              onPick={setSelected}
            >
              <rect x="69" y="133" width="172" height="154" rx="10" className="research-hit" />
              <IsoBlock
                x={90}
                y={160}
                width={105}
                height={74}
                depth={27}
                color="#58d8e8"
                label="GRID"
                sublabel="SOURCE BOUNDARY"
              />
            </NodeButton>
            <NodeButton
              id="converter"
              info={infos.converter}
              active={selected === 'converter'}
              onPick={setSelected}
            >
              <rect x="277" y="112" width="229" height="173" rx="12" className="research-hit" />
              <IsoBlock
                x={321}
                y={153}
                width={135}
                height={94}
                depth={31}
                color={study.color}
                label={labels.converter}
                sublabel={labels.subtitle}
              />
              <path
                d="M348 187H425M348 200H425M348 213H425"
                stroke={study.color}
                strokeOpacity=".45"
                strokeWidth="2"
              />
            </NodeButton>
            <NodeButton
              id="link"
              info={infos.link}
              active={selected === 'link'}
              onPick={setSelected}
            >
              <rect x="524" y="124" width="179" height="173" rx="11" className="research-hit" />
              <IsoBlock
                x={560}
                y={168}
                width={91}
                height={72}
                depth={27}
                color="#b59aff"
                label="DC LINK"
                sublabel="BUS + ENERGY"
              />
              <path d="M580 247V273M603 240V266M626 247V273" stroke="#c6b2ff" strokeWidth="3" />
            </NodeButton>
            <NodeButton
              id="load"
              info={infos.load}
              active={selected === 'load'}
              onPick={setSelected}
            >
              <rect x="747" y="119" width="194" height="181" rx="12" className="research-hit" />
              <IsoBlock
                x={790}
                y={159}
                width={100}
                height={91}
                depth={29}
                color="#e7b15b"
                label="LOAD"
                sublabel="BALANCED PU"
              />
              <path
                d="M804 186V228M820 181V232M836 176V237"
                stroke="#f0bd67"
                strokeOpacity=".55"
                strokeWidth="4"
              />
            </NodeButton>
          </>
        ) : (
          <>
            <path
              d="M200 219 268 219M500 151 620 218M500 213 620 220M500 275 620 222M680 218 797 218"
              className="research-cable"
            />
            <path
              d="M200 219 268 219M500 151 620 218M500 213 620 220M500 275 620 222M680 218 797 218"
              className="research-cable-highlight"
            />
            <NodeButton
              id="grid"
              info={infos.grid}
              active={selected === 'grid'}
              onPick={setSelected}
            >
              <rect x="44" y="130" width="189" height="177" rx="11" className="research-hit" />
              <IsoBlock
                x={79}
                y={168}
                width={103}
                height={85}
                depth={28}
                color="#d8e5ed"
                label="NINE-BUS"
                sublabel="NETWORK"
              />
            </NodeButton>
            <path d="M620 108V319" stroke="#71a7af" strokeWidth="5" strokeLinecap="round" />
            <path d="M620 108V319" stroke="#b4e1e0" strokeWidth="1.2" strokeOpacity=".6" />
            {(['sm', 'gfm', 'gfl', 'dc'] as const).map((id, index) => {
              const y = [70, 135, 200, 265][index];
              const color = casePortInfo[id].color;
              const labelsById = {
                sm: ['SM', 'SYNCHRONOUS'],
                gfm: ['GFM', 'GRID-FORMING'],
                gfl: ['GFL', 'GRID-FOLLOWING'],
                dc: ['DC', 'DC-LINK'],
              } as const;
              return (
                <g key={id}>
                  <path
                    d={'M500 ' + (y + 29) + 'H620'}
                    stroke={color}
                    strokeOpacity=".62"
                    strokeWidth="2"
                  />
                  <NodeButton
                    id={id}
                    info={infos[id]}
                    active={selected === id}
                    onPick={setSelected}
                  >
                    <rect
                      x="269"
                      y={y - 2}
                      width="241"
                      height="66"
                      rx="8"
                      className="research-hit"
                    />
                    <IsoBlock
                      x={300}
                      y={y + 5}
                      width={159}
                      height={37}
                      depth={18}
                      color={color}
                      label={labelsById[id][0]}
                      sublabel={labelsById[id][1]}
                    />
                  </NodeButton>
                </g>
              );
            })}
            <NodeButton
              id="load"
              info={infos.load}
              active={selected === 'load'}
              onPick={setSelected}
            >
              <rect x="774" y="124" width="183" height="172" rx="11" className="research-hit" />
              <IsoBlock
                x={809}
                y={165}
                width={104}
                height={84}
                depth={27}
                color="#e7b15b"
                label="LOADS"
                sublabel="SCALED PU"
              />
            </NodeButton>
          </>
        )}
        <text x="33" y="365" className="research-scene-note">
          CONCEPTUAL TOPOLOGY · NOT TO SCALE · MODEL BOUNDARY IS STUDY-SPECIFIC
        </text>
      </svg>
      <div className="research-diagram-inspector" aria-live="polite">
        <i style={{ background: active.color }} />
        <div>
          <strong>{active.title}</strong>
          <span>{active.note}</span>
        </div>
        <b>Inspect node</b>
      </div>
      <p className="research-diagram-foot">
        Topology explains the model boundary. No power flow or simulated result is encoded by this
        illustration.
      </p>
    </div>
  );
}
