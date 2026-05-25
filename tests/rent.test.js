import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { rentFor } from '../src/engine/rent.js';
import { groupPositions } from '../src/engine/board.js';

function game() {
  return createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
}

test('base city rent when owner does not hold the full group', () => {
  const s = game();
  s.properties[1].ownerId = 1;
  assert.equal(rentFor(s, 1, 0), 2);
});

test('owning the full unmortgaged group doubles base rent', () => {
  const s = game();
  for (const p of groupPositions('brown')) s.properties[p].ownerId = 1;
  assert.equal(rentFor(s, 1, 0), 4);
});

test('houses use the rent tier, not the doubling', () => {
  const s = game();
  for (const p of groupPositions('brown')) s.properties[p].ownerId = 1;
  s.properties[1].houses = 1;
  assert.equal(rentFor(s, 1, 0), 10);
});

test('mortgaged property earns no rent', () => {
  const s = game();
  s.properties[1].ownerId = 1;
  s.properties[1].mortgaged = true;
  assert.equal(rentFor(s, 1, 0), 0);
});

test('airport rent scales with number owned by that owner', () => {
  const s = game();
  s.properties[5].ownerId = 1;
  assert.equal(rentFor(s, 5, 0), 25);
  s.properties[15].ownerId = 1;
  assert.equal(rentFor(s, 5, 0), 50);
  s.properties[25].ownerId = 1;
  s.properties[35].ownerId = 1;
  assert.equal(rentFor(s, 5, 0), 200);
});

test('utility rent is 4x dice with one owned, 10x with both', () => {
  const s = game();
  s.properties[12].ownerId = 1;
  assert.equal(rentFor(s, 12, 9), 36);
  s.properties[28].ownerId = 1;
  assert.equal(rentFor(s, 12, 9), 90);
});

test('unowned property has zero rent', () => {
  const s = game();
  assert.equal(rentFor(s, 1, 0), 0);
});
