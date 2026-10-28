import { createElement, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './engineering-hero.css';

const assetRoot = `${import.meta.env.BASE_URL}assets/engineering-hero/v1/`;
const adapterPath = `${assetRoot}integration/vanilla/khan-grid-hero.js`;
const stylesheetPath = `${assetRoot}integration/vanilla/host.css`;

let adapterRegistration: Promise<void> | undefined;

function ensureHostStylesheet() {
  const href = new URL(stylesheetPath, document.baseURI).href;
  if (
    Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).some(
      (link) => link.href === href,
    )
  )
    return;

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = href;
  stylesheet.dataset.engineeringHeroHostStyle = 'true';
  document.head.append(stylesheet);
}

function loadAdapter(): Promise<void> {
  if (customElements.get('khan-grid-hero')) return Promise.resolve();
  if (adapterRegistration) return adapterRegistration;

  const script = document.createElement('script');
  script.type = 'module';
  script.src = new URL(adapterPath, document.baseURI).href;
  script.dataset.engineeringHeroAdapter = 'true';

  adapterRegistration = new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
    const onLoad = () => {
      cleanup();
      if (customElements.get('khan-grid-hero')) {
        resolve();
        return;
      }
      customElements.whenDefined('khan-grid-hero').then(() => resolve(), reject);
    };
    const onError = () => {
      cleanup();
      reject(new Error('The engineering film adapter could not be loaded'));
    };
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    document.head.append(script);
  }).catch((error: unknown) => {
    adapterRegistration = undefined;
    script.remove();
    throw error;
  });

  return adapterRegistration;
}

export function EngineeringHero() {
  const [adapterReady, setAdapterReady] = useState(false);
  const [adapterStylesReady, setAdapterStylesReady] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    ensureHostStylesheet();
    void loadAdapter().then(
      () => {
        if (mounted) setAdapterReady(true);
      },
      () => {
        // Keep the lightweight poster and summary available if the adapter cannot load.
      },
    );
    return () => {
      mounted = false;
    };
  }, []);

  // Keep the poster fallback visible until the custom element's own visual rules are ready.
  useEffect(() => {
    if (!adapterReady) return;
    const stylesheet = stageRef.current
      ?.querySelector<HTMLElement>('khan-grid-hero')
      ?.shadowRoot?.querySelector<HTMLLinkElement>('link[rel="stylesheet"]');
    if (!stylesheet) return;

    const isLoaded = () => {
      try {
        return Boolean(stylesheet.sheet?.cssRules.length);
      } catch {
        return false;
      }
    };
    if (isLoaded()) {
      setAdapterStylesReady(true);
      return;
    }

    const onLoad = () => setAdapterStylesReady(true);
    stylesheet.addEventListener('load', onLoad, { once: true });
    return () => stylesheet.removeEventListener('load', onLoad);
  }, [adapterReady]);

  const enhancedReady = adapterReady && adapterStylesReady;
  const adapterPosition: CSSProperties = enhancedReady
    ? { display: 'block', width: '100%' }
    : {
        display: 'block',
        width: '100%',
        position: 'absolute',
        inset: 0,
        visibility: 'hidden',
      };

  return (
    <section
      className="engineering-hero"
      data-testid="engineering-hero"
      aria-label="Engineering film"
    >
      <div className="engineering-hero-stage" ref={stageRef}>
        {adapterReady &&
          createElement('khan-grid-hero', {
            site: 'khanlab',
            mode: 'video',
            'video-src': `${assetRoot}hero-1080p60.mp4`,
            'poster-src': `${assetRoot}poster.png`,
            'hide-cta': '',
            style: adapterPosition,
          })}
        {!enhancedReady && (
          <div className="engineering-hero-fallback-content">
            <div className="engineering-hero-frame">
              <img
                className="engineering-hero-fallback"
                src={`${assetRoot}poster.png`}
                alt="A frame from an illustrative electro-thermal, evidence, workspace, and hybrid-energy engineering animation."
                width={1920}
                height={1080}
              />
            </div>
            <div className="engineering-hero-copy">
              <p>
                Physics → executable models → evidence → energy systems. Illustrative telemetry; not
                live data, certified acceptance, plant control, or investment advice.
              </p>
            </div>
          </div>
        )}
      </div>
      <p className="engineering-hero-summary">
        A 15-second conceptual engineering animation. It is illustrative only; it is not live
        telemetry, a validated facility simulation, or a certified design result.
      </p>
    </section>
  );
}
