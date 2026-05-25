import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, currentPlayer } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';

function game() {
  return createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
}

test('ROLL with explicit dice moves the current player', () => {
  let s = game();
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [2, 3] }));
  assert.equal(s.players[0].position, 5);
  assert.deepEqual(s.dice, [2, 3]);
});

test('landing on an unowned property opens a buy decision', () => {
  let s = game();
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [2, 3] }));
  assert.equal(s.phase, 'resolving');
  assert.equal(s.pending.decision.kind, 'buy');
  assert.equal(s.pending.decision.pos, 5);
});

test('BUY_PROPERTY transfers cash and ownership', () => {
  let s = game();
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [2, 3] }));
  ({ state: s } = applyAction(s, { type: 'BUY_PROPERTY' }));
  assert.equal(s.players[0].money, 1300);
  assert.equal(s.properties[5].ownerId, 0);
  assert.equal(s.phase, 'manage');
});

test('passing GO pays $200', () => {
  let s = game();
  s.players[0].position = 39;
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [1, 2] }));
  assert.equal(s.players[0].position, 2);
  assert.equal(s.players[0].money, 1700);
});

test('landing on an owned property pays rent to the owner', () => {
  let s = game();
  s.properties[5].ownerId = 1;
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [2, 3] }));
  assert.equal(s.players[0].money, 1475);
  assert.equal(s.players[1].money, 1525);
  assert.equal(s.phase, 'manage');
});

test('END_TURN advances to the next non-bankrupt player and resets to pre-roll', () => {
  let s = game();
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [2, 3] }));
  ({ state: s } = applyAction(s, { type: 'BUY_PROPERTY' }));
  ({ state: s } = applyAction(s, { type: 'END_TURN' }));
  assert.equal(s.currentPlayerIndex, 1);
  assert.equal(s.phase, 'pre-roll');
  assert.equal(currentPlayer(s).name, 'B');
});

test('rolling doubles increments doublesCount', () => {
  let s = game();
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [3, 3] }));
  assert.equal(s.doublesCount, 1);
});

test('three consecutive doubles sends the player to jail immediately', () => {
  let s = game();
  s.doublesCount = 2;
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [4, 4] }));
  assert.equal(s.players[0].inJail, true);
  assert.equal(s.players[0].position, 10);
  assert.equal(s.phase, 'manage');
});

test('landing on a tax space charges the fixed amount', () => {
  let s = game();
  s.players[0].position = 0;
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [2, 2] }));
  assert.equal(s.players[0].money, 1300);
  assert.equal(s.phase, 'manage');
});
