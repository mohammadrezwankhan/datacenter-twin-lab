import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requiredValue, requiredPresent } from '../src/required-value';

void test('required values preserve object identity and all defined scalar values', () => {
  const object = { result: 7 };
  assert.equal(requiredValue(object, 'record'), object);
  for (const value of [0, false, '', null, NaN, Infinity])
    assert.ok(Object.is(requiredValue(value, 'scalar'), value));
});

void test('sparse, missing and out-of-range collection entries fail before consumption', () => {
  const sparse: number[] = [];
  sparse.length = 2;
  assert.throws(() => requiredValue(sparse[0], 'sample 0'), /Missing required value: sample 0/);
  assert.throws(() => requiredValue([1][3], 'sample 3'), /Missing required value: sample 3/);
  assert.throws(
    () => requiredValue(new Map<string, number>().get('missing'), 'map key'),
    /map key/,
  );
});

void test('required present entries reject null DOM/model lookups and keep present values', () => {
  assert.throws(() => {
    requiredPresent(null, 'DOM node');
  }, /DOM node/);
  assert.throws(() => {
    requiredPresent(undefined, 'DOM node');
  }, /DOM node/);
  assert.equal(requiredPresent(0, 'zero'), 0);
  assert.equal(requiredPresent(false, 'boolean'), false);
});
