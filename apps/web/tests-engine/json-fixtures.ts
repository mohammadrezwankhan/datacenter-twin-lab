import assert from 'node:assert/strict';
import { validateScenario } from '../src/js-engine/index';
import type { Catalog, DemoData } from '../src/js-engine/index';

export function jsonObject(serialized: string): Record<string, unknown> {
  const value: unknown = JSON.parse(serialized);
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function objectValue(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

export function demoFixture(serialized: string): DemoData {
  const value = jsonObject(serialized);
  assert.ok(typeof value.engine_version === 'string');
  assert.ok(Array.isArray(value.presets));
  for (const preset of value.presets) {
    const item = objectValue(preset);
    assert.ok(typeof item.id === 'string' && typeof item.name === 'string');
  }
  const scenarios = objectValue(value.scenarios);
  for (const [id, scenario] of Object.entries(scenarios)) {
    // Fixtures must already have the canonical schema; retain their exact values.
    assert.deepEqual(validateScenario(scenario), scenario, `noncanonical preset ${id}`);
  }
  return value as unknown as DemoData;
}

export function catalogFixture(serialized: string): Catalog {
  const value = jsonObject(serialized);
  if (value.cloud_offers !== undefined) {
    assert.ok(Array.isArray(value.cloud_offers));
    for (const offer of value.cloud_offers) {
      const item = objectValue(offer);
      assert.ok(typeof item.id === 'string');
      assert.ok(typeof item.gpu_count === 'number' && Number.isSafeInteger(item.gpu_count));
      assert.ok(item.gpu_count > 0);
      assert.ok(typeof item.billing_unit === 'string' && typeof item.currency === 'string');
      assert.ok(Array.isArray(item.source_ids));
      assert.ok(item.source_ids.every((id: unknown) => typeof id === 'string'));
    }
  }
  return value;
}
