import assert from 'node:assert/strict';
import type { ResearchResult } from '../src/research/types';
import { arrayValue, numberValue, objectList, objectValue, stringValue } from './json-contracts';

/** Validate downloaded results without converting, dropping, or replacing values. */
export function researchResultValue(value: unknown): ResearchResult {
  const result = objectValue(value);
  stringValue(result.study_id);
  stringValue(result.model);
  Object.values(objectValue(result.config)).forEach(numberValue);
  objectValue(result.solver);
  objectValue(result.diagnostics);
  arrayValue(result.assumptions).forEach(stringValue);
  for (const metric of objectList(result.metrics)) {
    stringValue(metric.label);
    stringValue(metric.unit);
    if (metric.value !== null) numberValue(metric.value);
  }
  for (const chart of objectList(result.charts)) {
    for (const key of ['id', 'title', 'x_label', 'y_label']) stringValue(chart[key]);
    const x = arrayValue(chart.x);
    x.forEach(numberValue);
    for (const line of objectList(chart.lines)) {
      stringValue(line.label);
      if (line.color !== undefined) stringValue(line.color);
      const values = arrayValue(line.values);
      values.forEach(numberValue);
      assert.equal(values.length, x.length, 'Chart coordinates and values must align');
    }
  }
  if (result.modes !== undefined) {
    for (const mode of objectList(result.modes)) {
      for (const key of ['real', 'imag', 'frequency_hz']) numberValue(mode[key]);
      if (mode.damping !== null) numberValue(mode.damping);
      stringValue(mode.dominant_state);
    }
  }
  return value as ResearchResult;
}
