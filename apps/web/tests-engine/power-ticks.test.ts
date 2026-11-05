import assert from 'node:assert/strict';
import test from 'node:test';
import { powerTickLabel } from '../src/client.ts';

for (const demand of [0, 0.1, 1, 10, 1000]) {
  void test(`power-chart ticks stay distinct for ${String(demand)} kW`, () => {
    const maximum = Math.max(1, demand) * 1.12;
    const labels = [0, 0.5, 1].map((fraction) => powerTickLabel(fraction * maximum, maximum));
    assert.equal(new Set(labels).size, 3);
    if (demand <= 1) assert.deepEqual(labels, ['0', '0.56', '1.12']);
    if (demand === 1000) assert.deepEqual(labels, ['0', '560', '1,120']);
  });
}
