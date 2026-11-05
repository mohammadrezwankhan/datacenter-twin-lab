import assert from 'node:assert/strict';
import type { Run } from '../src/types';
import {
  arrayValue,
  numberValue,
  objectList,
  objectValue,
  scenarioValue,
  stringValue,
} from './json-contracts';

/** Check the complete run shape while retaining the downloaded values unchanged. */
export function continuityResultValue(value: unknown): Run {
  const run = objectValue(value);
  assert.equal(run.schema_version, 2);
  for (const key of [
    'model',
    'engine_version',
    'run_id',
    'input_sha256',
    'mode',
    'quality',
    'boundary',
  ]) {
    stringValue(run[key]);
  }
  scenarioValue(run.scenario);
  arrayValue(run.limitations).forEach(stringValue);
  for (const value of Object.values(objectValue(run.summary))) {
    if (value !== null && typeof value !== 'string') numberValue(value);
  }
  for (const event of objectList(run.events)) {
    stringValue(event.at_s);
    stringValue(event.action);
    if (event.target !== undefined) stringValue(event.target);
    if (event.ready_at_s !== undefined) stringValue(event.ready_at_s);
  }
  for (const row of objectList(run.intervals)) {
    for (const key of [
      'start_s',
      'end_s',
      'duration_s',
      'requested_it_kw',
      'served_it_kw',
      'unserved_it_kw',
      'electrical_source_kw',
      'grid_kw',
      'generator_kw',
      'battery_discharge_kw',
      'battery_charge_kw',
      'battery_start_kwh',
      'battery_end_kwh',
      'it_capacity_margin_kw',
      'energy_balance_residual_kwh',
    ])
      stringValue(row[key]);
    if (row.grid_energy_charge_to_date !== null) stringValue(row.grid_energy_charge_to_date);
    Object.values(objectValue(row.asset_states)).forEach(stringValue);
    Object.values(objectValue(row.energy)).forEach(stringValue);
    arrayValue(row.warnings).forEach(stringValue);
    for (const flow of objectList(row.feed_flows_kw)) {
      for (const key of ['source', 'target', 'kw']) stringValue(flow[key]);
    }
  }
  return value as Run;
}
