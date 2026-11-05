import { requiredValue } from '../../required-value';
import { useContext, useEffect, useId, useRef, useState } from 'react';
import type { SceneProps } from './types';
import { numberOutput } from './types';
import { Device, SceneDiagram, SceneMotionContext } from './primitives';

export default function ThermalScene({ result, step }: SceneProps) {
  const [cursorSeconds, setCursorSeconds] = useState(0);
  const [restoreSeconds, setRestoreSeconds] = useState(25);
  const [playing, setPlaying] = useState(false);
  const thermalControlId = useId();
  const motion = useContext(SceneMotionContext);
  const playbackRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef(cursorSeconds);
  cursorRef.current = cursorSeconds;
  const rawThermalLimit = result?.outputs.thermalLimitS;
  const thermalLimit =
    typeof rawThermalLimit === 'number' && Number.isFinite(rawThermalLimit)
      ? rawThermalLimit
      : null;
  const riseRate =
    result &&
    typeof result.outputs.temperatureRiseKS === 'number' &&
    Number.isFinite(result.outputs.temperatureRiseKS)
      ? result.outputs.temperatureRiseKS
      : null;
  const rackKW = result && typeof result.inputs.rackKW === 'number' ? result.inputs.rackKW : null;
  const temperatureRise =
    riseRate === null
      ? 'Not reported by this screen'
      : `${(riseRate * Math.min(cursorSeconds, restoreSeconds)).toFixed(3)} K`;
  const timeX = (seconds: number) => 110 + (Math.max(0, Math.min(600, seconds)) / 600) * 790;
  useEffect(() => {
    setCursorSeconds(0);
    setPlaying(false);
  }, [result?.resultHash]);
  useEffect(() => {
    if (!playing || !motion || !result) return;
    const timer = window.setInterval(() => {
      if (cursorRef.current >= 599.5) {
        setCursorSeconds(600);
        setPlaying(false);
      } else setCursorSeconds(cursorRef.current + 0.5);
    }, 100);
    return () => {
      window.clearInterval(timer);
    };
  }, [motion, playing, result]);
  useEffect(() => {
    if (!motion) setPlaying(false);
  }, [motion]);
  useEffect(() => {
    const element = playbackRef.current;
    const stopIfHidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', stopIfHidden);
    const observer =
      element && typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            ([entry]) => {
              if (entry && !entry.isIntersecting) setPlaying(false);
            },
            { threshold: 0.08 },
          )
        : null;
    if (element) observer?.observe(element);
    return () => {
      document.removeEventListener('visibilitychange', stopIfHidden);
      observer?.disconnect();
    };
  }, []);
  const rows = [
    { label: 'Liquid-captured rack heat', value: numberOutput(result, 'liquidKW', 'kW', 1) },
    { label: 'Residual air-path rack heat', value: numberOutput(result, 'residualAirKW', 'kW', 1) },
    { label: 'Liquid mass flow', value: numberOutput(result, 'waterKgS', 'kg/s', 3) },
    { label: 'Residual air volume flow', value: numberOutput(result, 'residualAirM3S', 'm³/s', 3) },
    {
      label: 'Lumped thermal limit',
      value:
        result && thermalLimit === null
          ? 'No finite positive-net-rise limit'
          : numberOutput(result, 'thermalLimitS', 's', 2),
    },
    { label: 'Physical cursor', value: result ? `${cursorSeconds.toFixed(1)} s` : 'Not run' },
    {
      label: 'Rise at cursor · after selected restoration',
      value: result ? temperatureRise : 'Not run',
    },
    {
      label: 'Restoration time · local preview assumption',
      value: `${restoreSeconds.toFixed(1)} s · not applied to model inputs`,
    },
  ];
  const story = [
    'Cold plates, residual rack air and the CDU occupy different heat paths.',
    'The model splits rack heat into liquid and air values from the completed result.',
    'The room-scale lumped thermal model begins at a separate boundary.',
    'Thermal limit and the stated 600 s electrical comparison use separate clocks.',
  ][step];
  return (
    <div className="infra-scene-composition">
      <div className="infra-thermal-controls" ref={playbackRef}>
        <label htmlFor={`${thermalControlId}-restore`}>
          Preview instant-restoration time · physical seconds: {restoreSeconds.toFixed(1)} s
        </label>
        <input
          id={`${thermalControlId}-restore`}
          type="range"
          min="0"
          max="60"
          step="0.5"
          value={restoreSeconds}
          onChange={(event) => {
            setRestoreSeconds(Number(event.currentTarget.value));
          }}
        />
        <p className="infra-scene-local-note">
          This is a separate teaching assumption. At the selected second, the preview restores full
          heat removal instantly and holds the resulting rise; it does not change the completed
          model inputs.
        </p>
        <label htmlFor={`${thermalControlId}-cursor`}>
          Physical-time cursor · seconds after cooling loss:{' '}
          {result ? `${cursorSeconds.toFixed(1)} s` : 'Run to enable'}
        </label>
        <input
          id={`${thermalControlId}-cursor`}
          type="range"
          min="0"
          max="600"
          step="0.5"
          value={cursorSeconds}
          disabled={!result}
          onChange={(event) => {
            setPlaying(false);
            setCursorSeconds(Number(event.currentTarget.value));
          }}
        />
        <button
          type="button"
          disabled={!result || !motion}
          aria-pressed={playing}
          onClick={() => {
            if (cursorSeconds >= 600) setCursorSeconds(0);
            setPlaying((value) => !value);
          }}
        >
          {playing ? 'Pause' : 'Play at 5×'}
        </button>
        <button
          type="button"
          disabled={!result}
          onClick={() => {
            setPlaying(false);
            setCursorSeconds(0);
          }}
        >
          Reset physical cursor
        </button>
        <span className="infra-thermal-readout" aria-live="polite">
          Lumped temperature rise at cursor: {result ? temperatureRise : 'Not run'}
        </span>
      </div>
      <SceneDiagram
        id="thermal"
        title="Two heat paths, two continuity clocks"
        description={`${String(story)} Physical seconds use a labelled cursor. Restoration is an explicit preview assumption; model outputs remain from the completed result.`}
        rows={rows}
        flat={false}
      >
        <Device
          x={80}
          y={340}
          w={130}
          h={132}
          label="Mixed-cooling rack"
          sublabel={
            rackKW === null
              ? 'rack heat boundary · pending'
              : `${rackKW.toFixed(0)} kW · completed input`
          }
          variant="rack"
          accent="teal"
        />
        <Device
          x={432}
          y={300}
          w={128}
          h={80}
          label="CDU"
          sublabel="secondary loop"
          variant="pump"
          accent="mint"
        />
        <Device
          x={782}
          y={300}
          w={130}
          h={86}
          label="Heat rejection"
          sublabel="shared boundary"
          variant="cabinet"
          accent="amber"
        />
        <path d="M236 262H432M586 262H782" fill="none" stroke="#63e6bc" strokeWidth="6" />
        <path
          d="M236 300C315 355 678 355 782 300"
          fill="none"
          stroke="#83bcff"
          strokeWidth="4"
          strokeDasharray="9 7"
        />
        <text x="323" y="225" textAnchor="middle" fill="#8df0cd" fontSize="15">
          Liquid heat · {requiredValue(rows[0], 'rows[0]').value}
        </text>
        <text x="365" y="380" textAnchor="middle" fill="#acd1ff" fontSize="15">
          Residual air heat · {requiredValue(rows[1], 'rows[1]').value}
        </text>
        <path d="M210 309 307 309" stroke="#c0a5ff" strokeWidth="3" strokeDasharray="3 7" />
        <text x="505" y="34" textAnchor="middle" fill="#edf4fa" fontSize="16" fontWeight="700">
          Physical seconds after cooling loss
        </text>
        <text x="505" y="54" textAnchor="middle" fill="#a0b1c3" fontSize="13">
          Separate room-scale model · common 0–600 s scale
        </text>
        <path d="M110 82H900" stroke="#8297a8" strokeWidth="2" />
        {thermalLimit !== null && thermalLimit <= 600 && (
          <g>
            <path
              d={`M${String(timeX(thermalLimit))} 67V97`}
              stroke="#ff9e8b"
              strokeWidth="3"
              strokeDasharray="5 4"
            />
          </g>
        )}
        <text x="505" y="119" textAnchor="middle" fill="#edf4fa" fontSize="12">
          Cursor {result ? `${cursorSeconds.toFixed(1)} s` : 'not run'} · thermal limit{' '}
          {thermalLimit === null
            ? result
              ? 'no finite positive-net-rise limit'
              : 'not run'
            : `${thermalLimit.toFixed(1)} s`}{' '}
          · restore assumption {restoreSeconds.toFixed(1)} s · 5× playback
        </text>
        <text x="112" y="143" fill="#acd1ff" fontSize="13">
          Electrical interval · 600 s stated comparison
        </text>
        <path d="M110 155H900" stroke="#83bcff" strokeWidth="8" />
        <path
          d={`M${String(timeX(restoreSeconds))} 67V97`}
          stroke="#ffd17e"
          strokeWidth="3"
          strokeDasharray="6 4"
        />
        {result && (
          <path d={`M${String(timeX(cursorSeconds))} 61V103`} stroke="#edf4fa" strokeWidth="2" />
        )}
        {[0, 100, 200, 300, 400, 500, 600].map((time) => (
          <g key={time}>
            <path d={`M${String(timeX(time))} 78v8`} stroke="#a0b1c3" />
            <text x={timeX(time)} y="102" textAnchor="middle" fill="#a0b1c3" fontSize="11">
              {time}
            </text>
          </g>
        ))}
        <text x="505" y="406" textAnchor="middle" fill="#a0b1c3" fontSize="12">
          Separate lumped model, not coupled to rack paths · electrical duration is a stated
          comparison
        </text>
        <text x="505" y="424" textAnchor="middle" fill="#a0b1c3" fontSize="12">
          Instantaneous restoration is illustrative · no cooldown or local rack temperature is
          modeled
        </text>
        {step === 2 && (
          <text x="628" y="198" fill="#a0b1c3" fontSize="12">
            heat removal interrupted in the teaching model
          </text>
        )}
      </SceneDiagram>
    </div>
  );
}
