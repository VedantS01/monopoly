import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { propWorth, netWorth, completesMonopoly, valueTo } from '../src/ai/valuation.js';

function g() { return createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 }); }

test('propWorth is price plus building cost', () => {
  const s = g();
  s.properties[39].ownerId = 0; s.properties[39].houses = 2; // NY price 400, houseCost 200
  assert.equal(propWorth(s, 39), 400 + 400);
});

test('netWorth sums cash, property value, and buildings', () => {
  const s = g();
  s.properties[1].ownerId = 0; // brown 60
  assert.equal(netWorth(s, 0), 1500 + 60);
  s.properties[1].mortgaged = true;
  assert.equal(netWorth(s, 0), 1500 + 30);
});

test('completesMonopoly detects the last missing property', () => {
  const s = g();
  s.properties[1].ownerId = 0; // own one brown
  assert.equal(completesMonopoly(s, 0, 3), true);  // acquiring 3 completes brown
  assert.equal(completesMonopoly(s, 0, 1), false); // 3 still unowned
});

test('valueTo adds a synergy bonus for completing a set', () => {
  const s = g();
  s.properties[1].ownerId = 0;
  const plain = valueTo(s, 1, 3);   // player 1 owns no brown -> no synergy
  const synergy = valueTo(s, 0, 3); // player 0 completes brown
  assert.ok(synergy > plain);
});
