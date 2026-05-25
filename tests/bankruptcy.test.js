import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';

function twoPlayerDebt() {
  const s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
  s.properties[1].ownerId = 0;
  s.properties[3].ownerId = 0;
  s.players[0].money = -50;
  s.phase = 'manage';
  s.pending.debt = { debtorId: 0, creditorId: 1 };
  return s;
}

test('declaring bankruptcy to a player transfers all properties to that creditor', () => {
  let s = twoPlayerDebt();
  ({ state: s } = applyAction(s, { type: 'DECLARE_BANKRUPTCY' }));
  assert.equal(s.players[0].bankrupt, true);
  assert.equal(s.properties[1].ownerId, 1);
  assert.equal(s.properties[3].ownerId, 1);
});

test('last solvent player wins', () => {
  let s = twoPlayerDebt();
  ({ state: s } = applyAction(s, { type: 'DECLARE_BANKRUPTCY' }));
  assert.equal(s.phase, 'game-over');
  assert.equal(s.winnerId, 1);
});

test('bankruptcy to the bank releases properties and clears buildings', () => {
  let s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }, { name: 'C', token: 'z' }], { seed: 1 });
  s.properties[1].ownerId = 0; s.properties[1].houses = 2;
  s.players[0].money = -10;
  s.phase = 'manage';
  s.pending.debt = { debtorId: 0, creditorId: null };
  const bankHousesBefore = s.bank.houses;
  ({ state: s } = applyAction(s, { type: 'DECLARE_BANKRUPTCY' }));
  assert.equal(s.players[0].bankrupt, true);
  assert.equal(s.properties[1].ownerId, null);
  assert.equal(s.properties[1].houses, 0);
  assert.equal(s.bank.houses, bankHousesBefore + 2);
  assert.equal(s.phase, 'manage');
});
