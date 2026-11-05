import assert from 'node:assert/strict';
import test from 'node:test';
import { MathUtils } from '../../assets/engineering-hero/v1/vendor/three/build/three.core.js';

test('graphics UUIDs use secure entropy even when Math.random is unavailable', (context) => {
  context.mock.method(Math, 'random', () => {
    throw new Error('Non-cryptographic randomness must not generate UUIDs');
  });
  const identifiers = new Set();
  for (let index = 0; index < 64; index += 1) {
    const identifier = MathUtils.generateUUID();
    assert.match(identifier, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    identifiers.add(identifier);
  }
  assert.equal(identifiers.size, 64);
});

test('secure UUID entropy preserves the version, variant and byte ordering', (context) => {
  context.mock.method(globalThis.crypto, 'getRandomValues', (array) => {
    array.set([0x03020100, 0x07060504, 0x0b0a0908, 0x0f0e0d0c]);
    return array;
  });
  assert.equal(MathUtils.generateUUID(), '00010203-0405-4607-8809-0a0b0c0d0e0f');
});

test('UUID generation propagates secure entropy failures without a weak fallback', (context) => {
  const failure = new Error('Secure entropy unavailable');
  context.mock.method(globalThis.crypto, 'getRandomValues', () => { throw failure; });
  assert.throws(() => MathUtils.generateUUID(), (error) => error === failure);
});

test('UUID generation fails closed when Web Crypto is unavailable', (context) => {
  context.mock.getter(globalThis, 'crypto', () => undefined);
  assert.throws(() => MathUtils.generateUUID(), TypeError);
});
