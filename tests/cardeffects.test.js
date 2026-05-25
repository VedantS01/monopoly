import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyCardEffect } from '../src/engine/cardeffects.js';
import { getCard } from '../src/engine/cards.js';

function game() {
  return createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
}
const A = (s) => s.players[0];

test('money card adjusts current player balance', () => {
  const s = game();
  applyCardEffect(s, A(s), getCard('cc2')); // +200
  assert.equal(A(s).money, 1700);
});

test('eachPlayer collect takes from every other player', () => {
  const s = game();
  applyCardEffect(s, A(s), getCard('cc7')); // birthday +10 each
  assert.equal(A(s).money, 1510);
  assert.equal(s.players[1].money, 1490);
});

test('moveTo GO collects salary', () => {
  const s = game();
  A(s).position = 30;
  applyCardEffect(s, A(s), getCard('cc1'));
  assert.equal(A(s).position, 0);
  assert.equal(A(s).money, 1700);
});

test('gotojail card jails the player without passing GO', () => {
  const s = game();
  A(s).position = 36;
  applyCardEffect(s, A(s), getCard('ch10'));
  assert.equal(A(s).inJail, true);
  assert.equal(A(s).position, 10);
  assert.equal(A(s).money, 1500);
});

test('getOutOfJail card is added to the player hand', () => {
  const s = game();
  applyCardEffect(s, A(s), getCard('ch8'));
  assert.equal(A(s).getOutCards, 1);
});

test('repairs charges per house and per hotel owned', () => {
  const s = game();
  s.properties[1].ownerId = 0; s.properties[1].houses = 3;
  s.properties[3].ownerId = 0; s.properties[3].houses = 5; // hotel
  applyCardEffect(s, A(s), getCard('ch11')); // $25/house, $100/hotel
  assert.equal(A(s).money, 1500 - 175);
});

test('back3 moves the player backward without GO', () => {
  const s = game();
  A(s).position = 7;
  applyCardEffect(s, A(s), getCard('ch9'));
  assert.equal(A(s).position, 4);
});
