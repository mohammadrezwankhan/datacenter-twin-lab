import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { SceneDiagramProps } from './types';

export const SceneViewContext = createContext<boolean | null>(null);
export const SceneMotionContext = createContext(true);

const accents: Record<string, string> = {
  mint: '#63e6bc',
  blue: '#83bcff',
  amber: '#ffd17e',
  violet: '#c0a5ff',
  coral: '#ff9e8b',
  teal: '#69d8d3',
  muted: '#8297a8',
};

export function Cable({
  d,
  kind = 'power',
  label,
  x,
  y,
}: {
  d: string;
  kind?:
    | 'power'
    | 'path-b'
    | 'liquid'
    | 'air'
    | 'network'
    | 'logical'
    | 'fuel'
    | 'shared'
    | 'ground';
  label?: string;
  x?: number;
  y?: number;
}) {
  const color =
    kind === 'path-b'
      ? accents.blue
      : kind === 'liquid' || kind === 'network'
        ? accents.mint
        : kind === 'air' || kind === 'logical'
          ? accents.violet
          : kind === 'fuel' || kind === 'shared'
            ? accents.amber
            : kind === 'ground'
              ? accents.coral
              : accents.teal;
  const dash = ['path-b', 'air', 'logical', 'shared', 'ground'].includes(kind) ? '9 7' : undefined;
  return (
    <g className={`infra-route infra-route-${kind}`} aria-label={label}>
      <path d={d} fill="none" stroke="#07131d" strokeWidth="12" strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={dash}
        strokeLinecap="round"
      />
      {label && x !== undefined && y !== undefined && (
        <g className="infra-route-label">
          <rect x={x - 42} y={y - 13} width="84" height="22" rx="6" />
          <text x={x} y={y + 3} textAnchor="middle">
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

export function Device({
  x,
  y,
  w,
  h,
  d = 26,
  label,
  sublabel,
  accent = 'mint',
  variant = 'cabinet',
  muted = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  d?: number;
  label: string;
  sublabel?: string;
  accent?: keyof typeof accents;
  variant?: 'cabinet' | 'transformer' | 'rack' | 'pump' | 'bus';
  muted?: boolean;
}) {
  const color = accents[accent];
  const opacity = muted ? 0.38 : 1;
  const top = `${String(x)},${String(y - h)} ${String(x + d)},${String(y - h - d * 0.44)} ${String(x + w + d)},${String(y - h - d * 0.44)} ${String(x + w)},${String(y - h)}`;
  const side = `${String(x + w)},${String(y - h)} ${String(x + w + d)},${String(y - h - d * 0.44)} ${String(x + w + d)},${String(y - d * 0.44)} ${String(x + w)},${String(y)}`;
  const face = `${String(x)},${String(y - h)} ${String(x + w)},${String(y - h)} ${String(x + w)},${String(y)} ${String(x)},${String(y)}`;
  return (
    <g className="infra-device" opacity={opacity}>
      <polygon points={top} fill="#263f50" stroke="#678092" />
      <polygon points={side} fill="#102431" stroke="#496273" />
      <polygon points={face} fill="#1a3140" stroke="#587384" />
      {variant === 'rack' &&
        Array.from({ length: 5 }, (_, index) => (
          <g key={index}>
            <rect
              x={x + 7}
              y={y - h + 10 + index * ((h - 18) / 5)}
              width={w - 15}
              height={Math.max(5, (h - 24) / 7)}
              rx="2"
              fill="#0b1c28"
              stroke="#476478"
            />
            <circle cx={x + 13} cy={y - h + 13 + index * ((h - 18) / 5)} r="1.8" fill={color} />
          </g>
        ))}
      {variant === 'transformer' && (
        <g fill="none" stroke={color} strokeWidth="2.4" opacity=".82">
          <path
            d={`M${String(x + 12)} ${String(y - h + 18)}v${String(h - 36)}M${String(x + 20)} ${String(y - h + 18)}v${String(h - 36)}M${String(x + 28)} ${String(y - h + 18)}v${String(h - 36)}`}
          />
        </g>
      )}
      {variant === 'pump' && (
        <circle
          cx={x + w / 2}
          cy={y - h / 2}
          r={Math.min(w, h) * 0.22}
          fill="#122430"
          stroke={color}
          strokeWidth="3"
        />
      )}
      {variant === 'bus' && (
        <path
          d={`M${String(x + 8)} ${String(y - h / 2)}H${String(x + w - 8)}`}
          stroke={color}
          strokeWidth="6"
        />
      )}
      <text className="infra-device-label" x={x + w / 2 + d / 2} y={y + 20} textAnchor="middle">
        {label}
      </text>
      {sublabel && (
        <text className="infra-device-sub" x={x + w / 2 + d / 2} y={y + 37} textAnchor="middle">
          {sublabel}
        </text>
      )}
    </g>
  );
}

export function SceneDiagram({ id, title, description, rows, flat, children }: SceneDiagramProps) {
  const contextFlat = useContext(SceneViewContext);
  const showFlat = contextFlat ?? flat;
  const titleId = `${id}-svg-title`;
  const descriptionId = `${id}-svg-description`;
  return (
    <div className={`infra-diagram${flat ? ' is-flat' : ''}`}>
      {!showFlat && (
        <div
          className="infra-svg-scroll"
          tabIndex={0}
          aria-label="Diagram area; scroll horizontally on small screens"
        >
          <svg viewBox="0 0 1000 450" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
            <title id={titleId}>{title}</title>
            <desc id={descriptionId}>{description}</desc>
            <defs>
              <linearGradient id={`${id}-ground`} x2=".8" y2="1">
                <stop stopColor="#1a303a" />
                <stop offset="1" stopColor="#0d1b26" />
              </linearGradient>
              <pattern
                id={`${id}-floor-grid`}
                width="32"
                height="22"
                patternUnits="userSpaceOnUse"
                patternTransform="matrix(1 .35 -1 .35 500 0)"
              >
                <path d="M32 0H0V22" fill="none" stroke="#395461" strokeWidth="1" opacity=".5" />
              </pattern>
            </defs>
            <rect width="1000" height="430" rx="12" fill="#0c1822" />
            <path
              d="M38 290 419 82 963 284 570 420Z"
              fill={`url(#${id}-ground)`}
              stroke="#375563"
            />
            <path d="M38 290 419 82 963 284 570 420Z" fill={`url(#${id}-floor-grid)`} />
            {children}
          </svg>
        </div>
      )}
      <table className="infra-ledger">
        <caption>
          {showFlat
            ? 'Static diagram equivalent'
            : 'Result ledger · values use the last completed run'}
        </caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Label({
  x,
  y,
  children,
  tone = 'muted',
}: {
  x: number;
  y: number;
  children: ReactNode;
  tone?: keyof typeof accents;
}) {
  return (
    <text className={`infra-label infra-label-${tone}`} x={x} y={y}>
      {children}
    </text>
  );
}
