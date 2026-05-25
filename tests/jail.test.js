import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';

function jailedGame() {
  const s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
  s.players[0].inJail = true;
  s.players[0].position = 10;
  return s;
}

test('PAY_JAIL costs $50 and frees the player, then they move', () => {
  let s = jailedGame();
  ({ state: s } = applyAction(s, { type: 'PAY_JAIL', dice: [3, 2] }));
  assert.equal(s.players[0].inJail, false);
  assert.equal(s.players[0].money, 1450);
  assert.equal(s.players[0].position, 15);
});

test('USE_JAIL_CARD consumes a card, frees the player, then they move', () => {
  let s = jailedGame();
  s.players[0].getOutCards = 1;
  ({ state: s } = applyAction(s, { type: 'USE_JAIL_CARD', dice: [3, 2] }));
  assert.equal(s.players[0].inJail, false);
  assert.equal(s.players[0].getOutCards, 0);
  assert.equal(s.players[0].position, 15);
});

test('ROLL_FOR_JAIL with doubles frees and moves the player', () => {
  let s = jailedGame();
  ({ state: s } = applyAction(s, { type: 'ROLL_FOR_JAIL', dice: [4, 4] }));
  assert.equal(s.players[0].inJail, false);
  assert.equal(s.players[0].position, 18);
  assert.equal(s.doublesCount, 0);
});

test('ROLL_FOR_JAIL without doubles increments jailRolls and stays', () => {
  let s = jailedGame();
  ({ state: s } = applyAction(s, { type: 'ROLL_FOR_JAIL', dice: [1, 2] }));
  assert.equal(s.players[0].inJail, true);
  assert.equal(s.players[0].jailRolls, 1);
  assert.equal(s.phase, 'manage');
});

test('third failed ROLL_FOR_JAIL forces $50 payment and moves the player', () => {
  let s = jailedGame();
  s.players[0].jailRolls = 2;
  ({ state: s } = applyAction(s, { type: 'ROLL_FOR_JAIL', dice: [1, 2] }));
  assert.equal(s.players[0].inJail, false);
  assert.equal(s.players[0].money, 1450);
  assert.equal(s.players[0].position, 13);
});
