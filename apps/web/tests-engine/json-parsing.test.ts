import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLosslessNumber } from 'lossless-json';
import { Rational } from '../src/js-engine/decimal';
import { parseLosslessJson } from '../src/js-engine/json';

void test('lossless JSON retains exact decimals and strict integer token types', () => {
  const parsed = parseLosslessJson(
    '{"exact":999999999999.000000001,"fractionalInteger":2.0,"exponent":1.25e-7,"integer":2,"unsafeInteger":9007199254740993}',
  ) as Record<string, unknown>;

  assert.equal(Rational.fromDecimal(parsed.exact).toDecimal(), '999999999999.000000001');
  assert.ok(isLosslessNumber(parsed.fractionalInteger));
  assert.ok(isLosslessNumber(parsed.exponent));
  assert.equal(parsed.integer, 2);
  assert.ok(isLosslessNumber(parsed.unsafeInteger));
  assert.equal(Rational.fromDecimal(parsed.fractionalInteger).toDecimal(), '2');
  assert.equal(Rational.fromDecimal(parsed.exponent).toDecimal(), '0.000000125');
});

void test('lossless JSON rejects repeated decoded keys, including equal values', () => {
  assert.throws(() => parseLosslessJson('{"nested":{"amount":1,"am\\u006funt":1}}'), /duplicate/i);
});

void test('lossless JSON rejects malformed documents before duplicate-key scanning', () => {
  assert.throws(
    () => parseLosslessJson('{"key":1,"key":1'),
    (error: unknown) => error instanceof SyntaxError && !/duplicate/i.test(error.message),
  );
});

void test('lossless JSON keeps __proto__ as an ordinary own property', () => {
  const parsed = parseLosslessJson('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
  assert.equal(Object.getPrototypeOf(parsed), Object.prototype);
  assert.equal(Object.hasOwn(parsed, '__proto__'), true);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});
