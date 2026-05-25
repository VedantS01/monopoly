import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD, getSpace, groupPositions, COLOR_GROUPS } from '../src/engine/board.js';

test('board has 40 spaces in clockwise order', () => {
  assert.equal(BOARD.length, 40);
  assert.equal(BOARD[0].type, 'corner');
  assert.equal(BOARD[0].name, 'GO');
});

test('key spaces are correctly placed', () => {
  assert.equal(getSpace(10).name, 'Jail / Just Visiting');
  assert.equal(getSpace(20).name, 'Free Parking');
  assert.equal(getSpace(30).type, 'gotojail');
  assert.equal(getSpace(4).type, 'tax');
  assert.equal(getSpace(4).amount, 200);
  assert.equal(getSpace(38).amount, 100);
  assert.equal(getSpace(39).name, 'New York');
  assert.equal(getSpace(39).price, 400);
});

test('airports and utilities are typed and priced', () => {
  for (const p of [5, 15, 25, 35]) assert.equal(getSpace(p).type, 'airport');
  for (const p of [12, 28]) assert.equal(getSpace(p).type, 'utility');
  assert.equal(getSpace(5).price, 200);
  assert.equal(getSpace(12).price, 150);
});

test('city rent arrays have 6 tiers and a house cost', () => {
  const ny = getSpace(39);
  assert.equal(ny.rent.length, 6);
  assert.equal(ny.rent[0], 50);
  assert.equal(ny.rent[5], 2000);
  assert.equal(ny.houseCost, 200);
});

test('groupPositions returns all positions in a color group', () => {
  assert.deepEqual(groupPositions('brown'), [1, 3]);
  assert.deepEqual(groupPositions('darkblue'), [37, 39]);
  assert.deepEqual(groupPositions('airports'), [5, 15, 25, 35]);
});

test('COLOR_GROUPS lists the 8 buildable color groups', () => {
  assert.equal(COLOR_GROUPS.length, 8);
  assert.ok(COLOR_GROUPS.includes('brown'));
  assert.ok(!COLOR_GROUPS.includes('airports'));
});
