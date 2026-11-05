import assert from 'node:assert/strict';
import { validateScenario } from '../src/js-engine/index';
import type { SiteScenario } from '../src/types';
import type { ScreenInputs, ScreenOutputs } from '../src/infrastructure/screens';

/** Validate the observed shape while preserving every supplied field and value. */
export function objectValue(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

export function arrayValue(value: unknown): unknown[] {
  assert.ok(Array.isArray(value));
  return value;
}

export function objectList(value: unknown): Record<string, unknown>[] {
  return arrayValue(value).map(objectValue);
}

export function stringValue(value: unknown): string {
  assert.ok(typeof value === 'string');
  return value;
}

export function numberValue(value: unknown): number {
  assert.ok(typeof value === 'number' && Number.isFinite(value));
  return value;
}

export function nullableString(value: unknown): string | null {
  assert.ok(value === null || typeof value === 'string');
  return value;
}

export function jsonObject(serialized: string): Record<string, unknown> {
  const value: unknown = JSON.parse(serialized);
  return objectValue(value);
}

export function jsonObjects(serialized: string): Record<string, unknown>[] {
  const value: unknown = JSON.parse(serialized);
  return objectList(value);
}

export function scenarioValue(value: unknown): SiteScenario {
  const validated = validateScenario(value);
  // A fixture must already be canonical. Do not repair or fill missing fields.
  assert.deepEqual(validated, value);
  return validated;
}

export type ContinuityFixture = Record<string, unknown> & {
  schema_version: 2;
  scenario: SiteScenario;
  summary: Record<string, unknown>;
  events: Record<string, unknown>[];
};

export function continuityValue(value: unknown): ContinuityFixture {
  const run = objectValue(value);
  assert.equal(run.schema_version, 2);
  return {
    ...run,
    schema_version: 2,
    scenario: scenarioValue(run.scenario),
    summary: objectValue(run.summary),
    events: objectList(run.events),
  };
}

function screenInputs(value: unknown): ScreenInputs {
  const checked: Record<string, number | number[] | null> = {};
  for (const [key, item] of Object.entries(objectValue(value))) {
    checked[key] =
      item === null ? null : Array.isArray(item) ? item.map(numberValue) : numberValue(item);
  }
  return checked;
}

function screenOutputs(value: unknown): ScreenOutputs {
  const checked: Record<string, number | string | boolean | null | string[]> = {};
  for (const [key, item] of Object.entries(objectValue(value))) {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') checked[key] = item;
    else checked[key] = Array.isArray(item) ? item.map(stringValue) : numberValue(item);
  }
  return checked;
}

export type ScreenFixture = Record<string, unknown> & {
  inputs: ScreenInputs;
  outputs: ScreenOutputs;
  sourceRevision: string | null;
};

export function screenValue(value: unknown): ScreenFixture {
  const result = objectValue(value);
  return {
    ...result,
    inputs: screenInputs(result.inputs),
    outputs: screenOutputs(result.outputs),
    sourceRevision: nullableString(result.sourceRevision),
  };
}

export type ScreenExportFixture = Record<string, unknown> & {
  result: ScreenFixture;
  fuel: ScreenFixture | null;
};

export function screenExport(value: unknown): ScreenExportFixture {
  const payload = objectValue(value);
  return {
    ...payload,
    result: screenValue(payload.result),
    fuel: payload.fuel === null ? null : screenValue(payload.fuel),
  };
}
