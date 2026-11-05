import assert from 'node:assert/strict';
import test from 'node:test';
import { csvFor, csvResult } from '../src/result-csv.ts';
import { DEFAULT_EMT, simulateEmt } from '../src/emt/engine.ts';
import type { ResearchResult } from '../src/research/types.ts';
import { requiredPresent } from '../src/required-value';

// Independent RFC 4180 reader: test separators, doubled quotes and embedded newlines.
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = '',
    quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv.charAt(i);
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if (char === '\r' && csv[i + 1] === '\n' && !quoted) {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      i++;
    } else value += char;
  }
  assert.equal(quoted, false);
  return rows;
}

function cell(row: string[], column: number): string {
  return requiredPresent(row[column], `CSV column ${String(column)}`);
}

void test('EMT CSV preserves every sample and the completed configuration', () => {
  const result = simulateEmt(DEFAULT_EMT);
  const rows = parseCsv(csvFor(result));
  assert.deepEqual(requiredPresent(rows[0], 'EMT CSV header').slice(0, 7), [
    'time_ms',
    'source_v',
    'bus_v',
    'source_a',
    'load_a',
    'stored_j',
    'balance_error_j',
  ]);
  assert.equal(rows.length, result.rows.length + 1);
  for (const [index, sample] of result.rows.entries()) {
    const row = requiredPresent(rows[index + 1], `EMT CSV sample ${String(index)}`);
    assert.deepEqual(row.slice(0, 7).map(Number), [
      sample.time_ms,
      sample.source_v,
      sample.bus_v,
      sample.source_a,
      sample.load_a,
      sample.stored_j,
      sample.balance_error_j,
    ]);
    assert.equal(row[7], result.model);
    assert.deepEqual(JSON.parse(cell(row, 8)), result.config);
    assert.deepEqual(JSON.parse(cell(row, 9)), result.assumptions);
    assert.match(cell(row, 10), /Educational/);
  }
});

void test('exports change only when a new result is applied', () => {
  const applied = simulateEmt(DEFAULT_EMT);
  const before = csvFor(applied);
  const draft = { ...applied.config, capacitance_mf: 24 };
  assert.equal(csvFor(applied), before);
  const next = simulateEmt(draft);
  const rows = parseCsv(csvFor(next));
  assert.deepEqual(JSON.parse(cell(requiredPresent(rows[1], 'new EMT CSV sample'), 8)), draft);
  assert.notEqual(csvFor(next), before);
});

void test('research CSV round-trips commas, quotes and newlines alongside solver context', () => {
  const result: ResearchResult = {
    study_id: 'forced-response',
    model: 'Model, "A"\nB',
    config: { amplitude: 0.1 },
    solver: { method: 'solver, "test"', note: 'line one\nline two' },
    assumptions: ['Educational, "synthetic"\nnot measured'],
    metrics: [],
    diagnostics: {},
    charts: [
      {
        id: 'wave',
        title: 'Title, "quoted"\r\nsecond line',
        x_label: 'time, s',
        y_label: 'V',
        x: [0, 1],
        lines: [{ label: 'V, "bus"', values: [3, 4] }],
      },
    ],
  };
  const rows = parseCsv(csvResult(result));
  assert.equal(rows.length, 3);
  assert.deepEqual(requiredPresent(rows[0], 'research CSV header').slice(0, 7), [
    'chart_id',
    'chart_title',
    'x_label',
    'x',
    'line_label',
    'y_label',
    'y',
  ]);
  const firstRow = requiredPresent(rows[1], 'first research CSV sample');
  assert.deepEqual(firstRow.slice(0, 7), [
    'wave',
    requiredPresent(result.charts[0], 'research chart').title,
    'time, s',
    '0',
    'V, "bus"',
    'V',
    '3',
  ]);
  assert.equal(firstRow[7], result.study_id);
  assert.equal(firstRow[8], result.model);
  assert.deepEqual(JSON.parse(cell(firstRow, 9)), result.config);
  assert.deepEqual(JSON.parse(cell(firstRow, 10)), result.solver);
  assert.deepEqual(JSON.parse(cell(firstRow, 11)), result.assumptions);
  assert.match(cell(firstRow, 12), /Educational/);
});
