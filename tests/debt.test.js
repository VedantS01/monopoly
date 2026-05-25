import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';

function game() {
  return createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
}

test('unaffordable rent flags debt to the owner and enters debt phase', () => {
  let s = game();
  s.players[0].money = 10;
  s.properties[39].ownerId = 1; // B owns New York
  s.players[0].position = 37;
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [1, 1] })); // -> 39, rent 50
  assert.equal(s.phase, 'debt');
  assert.equal(s.pending.debt.debtorId, 0);
  assert.equal(s.pending.debt.creditorId, 1);
  assert.ok(s.players[0].money < 0);
});

test('END_TURN is blocked while in debt', () => {
  let s = game();
  s.players[0].money = -5;
  s.phase = 'debt';
  s.pending.debt = { debtorId: 0, creditorId: 1 };
  ({ state: s } = applyAction(s, { type: 'END_TURN' }));
  assert.equal(s.currentPlayerIndex, 0);
  assert.equal(s.phase, 'debt');
});

test('mortgaging back to solvency clears the debt and returns to manage', () => {
  let s = game();
  s.players[0].money = -50;
  s.properties[39].ownerId = 0; // A owns New York (mortgage value 200)
  s.phase = 'debt';
  s.pending.debt = { debtorId: 0, creditorId: 1 };
  ({ state: s } = applyAction(s, { type: 'MORTGAGE', pos: 39 }));
  assert.ok(s.players[0].money >= 0);
  assert.equal(s.phase, 'manage');
  assert.equal(s.pending.debt, undefined);
});

test('unaffordable tax flags debt to the bank (creditor null)', () => {
  let s = game();
  s.players[0].money = 50;
  s.players[0].position = 0;
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [2, 2] })); // -> 4 Visa Fee 200
  assert.equal(s.phase, 'debt');
  assert.equal(s.pending.debt.creditorId, null);
});
