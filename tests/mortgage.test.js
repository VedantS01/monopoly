import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';

function owns(pos) {
  const s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
  s.properties[pos].ownerId = 0;
  s.phase = 'manage';
  return s;
}

test('MORTGAGE pays half the price and marks the property mortgaged', () => {
  let s = owns(39); // New York, price 400
  ({ state: s } = applyAction(s, { type: 'MORTGAGE', pos: 39 }));
  assert.equal(s.properties[39].mortgaged, true);
  assert.equal(s.players[0].money, 1700);
});

test('UNMORTGAGE costs mortgage value + 10% interest', () => {
  let s = owns(39);
  ({ state: s } = applyAction(s, { type: 'MORTGAGE', pos: 39 }));
  ({ state: s } = applyAction(s, { type: 'UNMORTGAGE', pos: 39 }));
  assert.equal(s.properties[39].mortgaged, false);
  assert.equal(s.players[0].money, 1480);
});

test('cannot mortgage a property that has buildings in its group', () => {
  let s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
  s.properties[1].ownerId = 0; s.properties[3].ownerId = 0;
  s.properties[1].houses = 1;
  s.phase = 'manage';
  ({ state: s } = applyAction(s, { type: 'MORTGAGE', pos: 3 }));
  assert.equal(s.properties[3].mortgaged, false);
});
