import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERSONALITIES, makePersonality } from '../src/ai/personalities.js';
import { makeRng } from '../src/engine/rng.js';

test('the four fixed ids exist with required fields', () => {
  for (const id of ['dumb', 'conservative', 'moderate', 'aggressive']) {
    const p = PERSONALITIES[id];
    assert.ok(p && typeof p.cashBuffer === 'number' && 'buildTo' in p);
  }
});

test('dumb never accepts trades and never builds', () => {
  const p = makePersonality('dumb');
  assert.equal(p.buildTo, 0);
  assert.equal(p.tradeInitiative, 'none');
  assert.equal(p.tradeAcceptBias, Infinity);
});

test('wildcard is randomized within ranges and deterministic per seed', () => {
  const a = makePersonality('wildcard', makeRng(5));
  const b = makePersonality('wildcard', makeRng(5));
  assert.deepEqual(a, b);
  assert.ok(a.cashBuffer >= 50 && a.cashBuffer <= 450);
  assert.ok(a.buildTo >= 3 && a.buildTo <= 5);
});
