import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { InfrastructureScreenResult, SceneProps } from './types';
import { SceneMotionContext, SceneViewContext } from './primitives';
import './scene.css';

export type { InfrastructureScreenResult } from './types';

type InfrastructureSceneProps = {
  lessonId: string;
  title: string;
  storyboard: readonly string[];
  staticAlternative: string;
  result: InfrastructureScreenResult | null;
  fuelResult?: InfrastructureScreenResult | null;
};

const scenes: Record<string, LazyExoticComponent<ComponentType<SceneProps>>> = {
  'evidence-load-ledger': lazy(() => import('./01-ledger')),
  'resilience-state-matrix': lazy(() => import('./02-resilience')),
  'transformer-fault-boundaries': lazy(() => import('./03-transformer')),
  'generator-bank-fuel': lazy(() => import('./04-generator')),
  'ups-battery-station-dc': lazy(() => import('./05-ups')),
  'protection-trip-chain': lazy(() => import('./06-protection')),
  'grounding-power-quality': lazy(() => import('./07-grounding')),
  'thermal-liquid-continuity': lazy(() => import('./08-thermal')),
  'network-optical-budget': lazy(() => import('./09-network')),
  'facilities-phased-development': lazy(() => import('./10-facilities')),
  'commissioning-evidence-loop': lazy(() => import('./11-commissioning')),
  'integrated-design-release': lazy(() => import('./12-release')),
  'dcie-01': lazy(() => import('./01-ledger')),
  'dcie-02': lazy(() => import('./02-resilience')),
  'dcie-03': lazy(() => import('./03-transformer')),
  'dcie-04': lazy(() => import('./04-generator')),
  'dcie-05': lazy(() => import('./05-ups')),
  'dcie-06': lazy(() => import('./06-protection')),
  'dcie-07': lazy(() => import('./07-grounding')),
  'dcie-08': lazy(() => import('./08-thermal')),
  'dcie-09': lazy(() => import('./09-network')),
  'dcie-10': lazy(() => import('./10-facilities')),
  'dcie-11': lazy(() => import('./11-commissioning')),
  'dcie-12': lazy(() => import('./12-release')),
};

function mediaPreference() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function InfrastructureScene({
  lessonId,
  title,
  storyboard,
  staticAlternative,
  result,
  fuelResult,
}: InfrastructureSceneProps) {
  const Composition = scenes[lessonId];
  const scrubId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const stepRef = useRef(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [flat, setFlat] = useState(false);
  const [motion, setMotion] = useState(() => !mediaPreference());
  stepRef.current = step;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      const enabled = !preference.matches;
      setMotion(enabled);
      if (!enabled) setPlaying(false);
    };
    preference.addEventListener('change', updateMotion);
    return () => {
      preference.removeEventListener('change', updateMotion);
    };
  }, []);

  useEffect(() => {
    const stopWhenHidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', stopWhenHidden);
    const element = rootRef.current;
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
      document.removeEventListener('visibilitychange', stopWhenHidden);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!playing || !motion) return;
    const timer = window.setInterval(() => {
      if (stepRef.current >= storyboard.length - 1) {
        setPlaying(false);
        return;
      }
      setStep((current) => current + 1);
    }, 2200);
    return () => {
      window.clearInterval(timer);
    };
  }, [motion, playing, storyboard.length]);

  if (!Composition) {
    return <p className="infra-scene-unavailable">This lesson has no infrastructure scene.</p>;
  }

  const activeText = storyboard[step] ?? 'Review the completed engineering screen.';
  const hasCompletedResult = Boolean(result || fuelResult);
  const move = (delta: number) => {
    setPlaying(false);
    setStep((current) => Math.max(0, Math.min(storyboard.length - 1, current + delta)));
  };

  return (
    <section
      ref={rootRef}
      className={`infra-scene${motion ? ' has-motion' : ' motion-off'}${flat ? ' is-flat' : ''}`}
      aria-label={`${title} scene`}
    >
      <div className="infra-scene-heading">
        <div>
          <p className="infra-eyebrow">Infrastructure engineering · explanatory preview</p>
          <h2>{title}</h2>
        </div>
        <span className="infra-scene-tag">SVG · 2.5D</span>
      </div>
      <div className="infra-scene-controls" aria-label="Scene controls">
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setStep(0);
          }}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => {
            if (step >= storyboard.length - 1) setStep(0);
            setPlaying((value) => !value);
          }}
          aria-pressed={playing}
          disabled={!motion}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          onClick={() => {
            move(-1);
          }}
          disabled={step === 0}
        >
          Previous step
        </button>
        <button
          type="button"
          onClick={() => {
            move(1);
          }}
          disabled={step >= storyboard.length - 1}
        >
          Next step
        </button>
        <label className="infra-scrub-label" htmlFor={scrubId}>
          Narrative step · not physical time
        </label>
        <input
          id={scrubId}
          type="range"
          min="0"
          max={Math.max(0, storyboard.length - 1)}
          step="1"
          value={step}
          onChange={(event) => {
            setPlaying(false);
            setStep(Number(event.currentTarget.value));
          }}
          aria-valuetext={`Step ${String(step + 1)} of ${String(storyboard.length)}`}
        />
        <button
          type="button"
          onClick={() => {
            setFlat((value) => !value);
          }}
          aria-pressed={flat}
        >
          {flat ? 'Show 2.5D diagram' : 'Show 2D table'}
        </button>
        <button
          type="button"
          onClick={() => {
            setMotion((value) => !value);
            setPlaying(false);
          }}
          aria-pressed={motion}
        >
          Motion: {motion ? 'on' : 'off'}
        </button>
      </div>
      <p className="infra-step-copy" aria-live="polite">
        <strong>
          Step {step + 1} of {storyboard.length}:
        </strong>{' '}
        {activeText}
      </p>
      <p className="infra-scene-note">
        {hasCompletedResult
          ? fuelResult
            ? 'Capacity and fuel ledgers show their own last completed results.'
            : 'The ledger shows the last completed result.'
          : 'Preview only. Run the model to populate values; no result is implied.'}{' '}
        {staticAlternative}
      </p>
      <Suspense
        fallback={
          <div className="infra-scene-loading" role="status">
            Loading the lesson diagram…
          </div>
        }
      >
        <SceneMotionContext.Provider value={motion}>
          <SceneViewContext.Provider value={flat}>
            <Composition result={result} fuelResult={fuelResult ?? null} step={step} flat={flat} />
          </SceneViewContext.Provider>
        </SceneMotionContext.Provider>
      </Suspense>
    </section>
  );
}
