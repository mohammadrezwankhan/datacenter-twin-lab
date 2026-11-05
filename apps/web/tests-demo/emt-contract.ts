import assert from 'node:assert/strict';
import { validateEmt, type EmtResult } from '../src/emt/engine';
import { arrayValue, numberValue, objectList, objectValue, stringValue } from './json-contracts';

/** Check downloaded numerical data without normalizing or replacing any field. */
export function emtResultValue(value: unknown): EmtResult {
  const result = objectValue(value);
  assert.equal(result.model, 'dc-link-rlc-v1');
  assert.equal(result.sample_step_us, 100);
  assert.deepEqual(validateEmt(result.config), result.config);
  arrayValue(result.assumptions).forEach(stringValue);
  for (const row of objectList(result.rows)) {
    for (const key of [
      'time_ms',
      'source_v',
      'bus_v',
      'source_a',
      'load_a',
      'stored_j',
      'balance_error_j',
    ])
      numberValue(row[key]);
  }
  const summary = objectValue(result.summary);
  for (const key of [
    'initial_bus_v',
    'minimum_bus_v',
    'peak_source_a',
    'recovery_peak_v',
    'source_energy_j',
    'resistor_loss_j',
    'load_energy_j',
    'initial_stored_j',
    'final_stored_j',
    'balance_error_j',
  ])
    numberValue(summary[key]);
  return value as EmtResult;
}
