import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHANCE, CHEST, ALL_CARDS, getCard } from '../src/engine/cards.js';

test('both decks exist and are non-trivial', () => {
  assert.ok(CHANCE.length >= 10);
  assert.ok(CHEST.length >= 10);
});

test('every card has id, deck, text, and a known effect kind', () => {
  const kinds = new Set(['money', 'eachPlayer', 'moveTo', 'moveToNearest', 'back3', 'gotojail', 'repairs', 'getOutOfJail']);
  for (const c of ALL_CARDS) {
    assert.ok(c.id && c.deck && c.text, `card missing fields: ${JSON.stringify(c)}`);
    assert.ok(kinds.has(c.effect.kind), `bad kind: ${c.effect.kind}`);
  }
});

test('card ids are unique', () => {
  const ids = ALL_CARDS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('each deck has exactly one Get Out of Jail Free card', () => {
  assert.equal(CHANCE.filter((c) => c.effect.kind === 'getOutOfJail').length, 1);
  assert.equal(CHEST.filter((c) => c.effect.kind === 'getOutOfJail').length, 1);
});

test('getCard looks up by id', () => {
  assert.equal(getCard(CHANCE[0].id).text, CHANCE[0].text);
});
