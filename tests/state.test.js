import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, clone, currentPlayer, serialize, deserialize } from '../src/engine/state.js';

const players = [
  { name: 'Ada', token: '🚗', color: '#c0392b' },
  { name: 'Ben', token: '✈️', color: '#2980b9' },
];

test('createGame sets up players with starting cash at GO', () => {
  const s = createGame(players);
  assert.equal(s.players.length, 2);
  assert.equal(s.players[0].money, 1500);
  assert.equal(s.players[0].position, 0);
  assert.equal(s.players[0].id, 0);
  assert.equal(s.players[1].id, 1);
  assert.equal(s.currentPlayerIndex, 0);
  assert.equal(s.phase, 'pre-roll');
});

test('createGame initializes bank, properties, and shuffled decks', () => {
  const s = createGame(players, { seed: 1 });
  assert.equal(s.bank.houses, 32);
  assert.equal(s.bank.hotels, 12);
  assert.equal(s.properties[1].ownerId, null);
  assert.equal(s.properties[1].houses, 0);
  assert.equal(s.properties[1].mortgaged, false);
  assert.equal(s.decks.chance.length, 14);
  assert.equal(s.decks.chest.length, 14);
});

test('clone is a deep copy', () => {
  const s = createGame(players);
  const c = clone(s);
  c.players[0].money = 1;
  assert.equal(s.players[0].money, 1500);
});

test('currentPlayer returns the active player', () => {
  const s = createGame(players);
  assert.equal(currentPlayer(s).name, 'Ada');
});

test('createGame stores isBot and personality from defs (defaults dumb/human)', () => {
  const s = createGame([
    { name: 'A', token: 'x' },
    { name: 'B', token: 'y', isBot: true, personality: 'aggressive' },
  ]);
  assert.equal(s.players[0].isBot, false);
  assert.equal(s.players[0].personality, 'dumb');
  assert.equal(s.players[1].isBot, true);
  assert.equal(s.players[1].personality, 'aggressive');
});

test('serialize/deserialize round-trips', () => {
  const s = createGame(players, { seed: 7 });
  const back = deserialize(serialize(s));
  assert.deepEqual(back, s);
});
