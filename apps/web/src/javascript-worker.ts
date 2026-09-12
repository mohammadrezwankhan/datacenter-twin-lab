import {
  ENGINE_VERSION,
  normalizeQuote,
  renderHtml,
  renderMarkdown,
  simulateContinuitySync,
  simulatePlanning,
  sweepContinuity,
} from './js-engine/index';
import type { Catalog, DemoData } from './js-engine/index';
import { InputError } from './js-engine/index';

const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
export type Assets = { demoData?: DemoData; catalog?: Catalog };
let assetsPromise: Promise<Assets> | undefined;
let catalogPromise: Promise<Catalog> | undefined;

function pathParts(path: string): URL {
  const value = path.startsWith('/') ? path : `/${path}`;
  const normalized = value.replace(/^\/api\/v1\//, '/');
  return new URL(normalized, 'https://datacenter-twin.invalid');
}

async function fetchJson(url: URL): Promise<any> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Browser asset request failed (${response.status}) for ${url.pathname}`);
  return response.json();
}

async function loadDemoData(): Promise<DemoData> {
  const base = new URL(import.meta.env.BASE_URL, self.location.origin);
  const demoData = await fetchJson(new URL('demo-data.json', base));
  if (
    !demoData ||
    demoData.engine_version !== ENGINE_VERSION ||
    !Array.isArray(demoData.presets) ||
    !demoData.scenarios
  )
    throw new Error(`Demo data engine version mismatch; expected ${ENGINE_VERSION}`);
  return demoData;
}

async function loadCatalog(): Promise<Catalog> {
  const base = new URL(import.meta.env.BASE_URL, self.location.origin);
  return fetchJson(new URL('catalog.json', base));
}

async function resourcesFor(route: URL): Promise<Assets> {
  if (route.pathname === '/catalog' || route.pathname === '/quotes/normalize') {
    catalogPromise ??= loadCatalog().catch((error) => {
      catalogPromise = undefined;
      throw error;
    });
    return { catalog: await catalogPromise };
  }
  assetsPromise ??= loadDemoData()
    .then((demoData) => ({ demoData }))
    .catch((error) => {
      assetsPromise = undefined;
      throw error;
    });
  return assetsPromise;
}

function validateBodyKeys(payload: unknown, keys: string[], message: string): Record<string, any> {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload))
    throw new InputError(message);
  const data = payload as Record<string, any>;
  const expected = new Set(keys);
  if (
    Object.keys(data).some((key) => !expected.has(key)) ||
    keys.some((key) => !Object.prototype.hasOwnProperty.call(data, key))
  )
    throw new InputError(message);
  return data;
}

export function dispatchParsed(path: string, payload: unknown, assets: Assets): unknown {
  const route = pathParts(path);
  if (route.pathname === '/presets') {
    if (!assets.demoData) throw new Error('Demo data is not loaded');
    return assets.demoData.presets;
  }
  if (route.pathname === '/demo') {
    if (!assets.demoData) throw new Error('Demo data is not loaded');
    const preset = route.searchParams.get('preset') || 'utility_loss';
    const scenario = assets.demoData.scenarios[preset];
    if (!scenario) throw new InputError('Unknown demo preset');
    return scenario;
  }
  if (route.pathname === '/catalog') {
    if (!assets.catalog) throw new Error('Catalog is not loaded');
    return assets.catalog;
  }
  if (route.pathname === '/simulations') return simulateContinuitySync(payload);
  if (route.pathname === '/planning') return simulatePlanning(payload);
  if (route.pathname === '/quotes/normalize') {
    if (!assets.catalog) throw new Error('Catalog is not loaded');
    return normalizeQuote(payload, assets.catalog);
  }
  if (route.pathname === '/sweeps') {
    const data = validateBodyKeys(
      payload,
      ['scenario', 'parameter', 'values'],
      'Sweep requires scenario, parameter, and values',
    );
    return sweepContinuity(data.scenario, data.parameter, data.values);
  }
  if (route.pathname === '/reports') {
    const data = validateBodyKeys(
      payload,
      ['scenario', 'format'],
      'Report requires scenario and format',
    );
    if (data.format !== 'markdown' && data.format !== 'html')
      throw new InputError('Report format must be markdown or html');
    const run = simulateContinuitySync(data.scenario);
    return {
      format: data.format,
      text: data.format === 'html' ? renderHtml(run) : renderMarkdown(run),
      run_id: run.run_id,
    };
  }
  throw new InputError('Unsupported browser operation');
}

export async function dispatchJson(path: string, body = 'null', assets?: Assets): Promise<unknown> {
  if (typeof body !== 'string') throw new InputError('Request body must be JSON text');
  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES)
    throw new InputError('Request exceeds the 4 MiB input limit');
  const payload = JSON.parse(body);
  const resources = assets ?? (await resourcesFor(pathParts(path)));
  return dispatchParsed(path, payload, resources);
}

if (typeof self !== 'undefined') {
  let queue = Promise.resolve();
  self.addEventListener(
    'message',
    (event: MessageEvent<{ id: number; path: string; body: string }>) => {
      const { id, path, body } = event.data;
      queue = queue.then(async () => {
        try {
          const result = await dispatchJson(path, body);
          self.postMessage({ id, result });
        } catch (error) {
          self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  );
}
