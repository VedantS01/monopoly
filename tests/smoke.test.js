import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PING } from '../src/engine/state.js';

test('test harness runs and ESM imports work', () => {
  assert.equal(PING, 'pong');
});
