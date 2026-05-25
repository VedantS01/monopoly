import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';
import { groupPositions } from '../src/engine/board.js';

function ownsBrown() {
  const s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
  for (const p of groupPositions('brown')) s.properties[p].ownerId = 0; // pos 1 & 3
  s.phase = 'manage';
  return s;
}

test('can build a house on a full unmortgaged group, charges house cost', () => {
  let s = ownsBrown();
  ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: 1 }));
  assert.equal(s.properties[1].houses, 1);
  assert.equal(s.players[0].money, 1450);
  assert.equal(s.bank.houses, 31);
});

test('even-build rule blocks a second house before the group is even', () => {
  let s = ownsBrown();
  ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: 1 }));
  const before = s.players[0].money;
  ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: 1 }));
  assert.equal(s.properties[1].houses, 1);
  assert.equal(s.players[0].money, before);
});

test('cannot build if you do not own the full group', () => {
  let s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
  s.properties[1].ownerId = 0;
  s.phase = 'manage';
  ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: 1 }));
  assert.equal(s.properties[1].houses, 0);
});

test('hotel is the 5th house and returns 4 houses to the bank', () => {
  let s = ownsBrown();
  for (const p of [1, 3, 1, 3, 1, 3, 1, 3]) {
    ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: p }));
  }
  assert.equal(s.properties[1].houses, 4);
  const housesBefore = s.bank.houses;
  ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: 1 }));
  assert.equal(s.properties[1].houses, 5);
  assert.equal(s.bank.hotels, 11);
  assert.equal(s.bank.houses, housesBefore + 4);
});

test('building is blocked when the bank has no houses left', () => {
  let s = ownsBrown();
  s.bank.houses = 0;
  ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: 1 }));
  assert.equal(s.properties[1].houses, 0);
});

test('SELL_HOUSE refunds half the house cost and returns the house to the bank', () => {
  let s = ownsBrown();
  ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: 3 }));
  ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: 1 }));
  const money = s.players[0].money;
  ({ state: s } = applyAction(s, { type: 'SELL_HOUSE', pos: 1 }));
  assert.equal(s.properties[1].houses, 0);
  assert.equal(s.players[0].money, money + 25);
});
