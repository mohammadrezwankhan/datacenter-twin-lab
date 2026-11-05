import { workerRequest } from './worker-envelope';
import {
  ENGINE_VERSION,
  validateScenario,
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

async function fetchJson(url: URL): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(
      `Browser asset request failed (${String(response.status)}) for ${url.pathname}`,
    );
  return response.json();
}

async function loadDemoData(): Promise<DemoData> {
  // Resolve from the deployed worker, preserving a repository subpath if present.
  const base = new URL('../', self.location.href);
  const demoData = objectValue(
    await fetchJson(new URL('demo-data.json', base)),
    'Demo data must be an object',
  );
  if (
    demoData.engine_version !== ENGINE_VERSION ||
    !Array.isArray(demoData.presets) ||
    !demoData.scenarios
  )
    throw new Error(`Demo data engine version mismatch; expected ${ENGINE_VERSION}`);
  for (const preset of demoData.presets) {
    const item = objectValue(preset, 'Preset must be an object');
    if (typeof item.id !== 'string' || typeof item.name !== 'string')
      throw new Error('Invalid preset metadata');
  }
  const scenarios = objectValue(demoData.scenarios, 'Scenarios must be an object');
  for (const scenario of Object.values(scenarios)) validateScenario(scenario);
  return demoData as unknown as DemoData;
}

async function loadCatalog(): Promise<Catalog> {
  const base = new URL('../', self.location.href);
  const catalog = objectValue(
    await fetchJson(new URL('catalog.json', base)),
    'Catalog must be an object',
  );
  if (catalog.cloud_offers !== undefined) {
    if (!Array.isArray(catalog.cloud_offers)) throw new Error('Catalog offers must be an array');
    for (const offer of catalog.cloud_offers) {
      const item = objectValue(offer, 'Catalog offer must be an object');
      if (
        typeof item.id !== 'string' ||
        typeof item.gpu_count !== 'number' ||
        !Number.isSafeInteger(item.gpu_count) ||
        item.gpu_count < 1 ||
        typeof item.billing_unit !== 'string' ||
        typeof item.currency !== 'string' ||
        !Array.isArray(item.source_ids) ||
        item.source_ids.some((id: unknown) => typeof id !== 'string')
      ) {
        throw new Error('Invalid catalog offer metadata');
      }
    }
  }
  return catalog as Catalog;
}

async function resourcesFor(route: URL): Promise<Assets> {
  if (route.pathname === '/catalog' || route.pathname === '/quotes/normalize') {
    catalogPromise ??= loadCatalog().catch((error: unknown) => {
      catalogPromise = undefined;
      throw error;
    });
    return { catalog: await catalogPromise };
  }
  assetsPromise ??= loadDemoData()
    .then((demoData) => ({ demoData }))
    .catch((error: unknown) => {
      assetsPromise = undefined;
      throw error;
    });
  return assetsPromise;
}

function objectValue(value: unknown, message: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new InputError(message);
  return value as Record<string, unknown>;
}

function validateBodyKeys(
  payload: unknown,
  keys: string[],
  message: string,
): Record<string, unknown> {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload))
    throw new InputError(message);
  const data = payload as Record<string, unknown>;
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
    if (typeof data.parameter !== 'string' || !Array.isArray(data.values))
      throw new InputError('Sweep requires a text parameter and a values array');
    return sweepContinuity(data.scenario, data.parameter, data.values as unknown[]);
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
  const payload: unknown = JSON.parse(body);
  const resources = assets ?? (await resourcesFor(pathParts(path)));
  return dispatchParsed(path, payload, resources);
}

if (typeof self !== 'undefined') {
  let queue = Promise.resolve();
  self.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (event.origin !== '' && event.origin !== self.location.origin) return;
    if (event.source !== null) return;
    const request = workerRequest(event.data);
    if (!request) return;
    const { id, path, body } = request;
    queue = queue.then(async () => {
      try {
        const result = await dispatchJson(path, body);
        self.postMessage({ id, result });
      } catch (error) {
        self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
      }
    });
  });
}
