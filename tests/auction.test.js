import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';

function atBuyDecision() {
  let s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [2, 3] })); // JFK pos 5, buy decision
  return s;
}

test('declining a purchase starts an auction among all players', () => {
  let s = atBuyDecision();
  ({ state: s } = applyAction(s, { type: 'DECLINE_PROPERTY' }));
  assert.equal(s.phase, 'auction');
  assert.equal(s.pending.auction.pos, 5);
  assert.deepEqual(s.pending.auction.bidders, [0, 1]);
});

test('a higher bid records the high bidder; the other passing ends the auction', () => {
  let s = atBuyDecision();
  ({ state: s } = applyAction(s, { type: 'DECLINE_PROPERTY' }));
  ({ state: s } = applyAction(s, { type: 'AUCTION_BID', amount: 50 }));
  ({ state: s } = applyAction(s, { type: 'AUCTION_PASS' }));
  assert.equal(s.properties[5].ownerId, 0);
  assert.equal(s.players[0].money, 1450);
  assert.equal(s.phase, 'manage');
});

test('if everyone passes with no bid, the property stays unowned', () => {
  let s = atBuyDecision();
  ({ state: s } = applyAction(s, { type: 'DECLINE_PROPERTY' }));
  ({ state: s } = applyAction(s, { type: 'AUCTION_PASS' }));
  ({ state: s } = applyAction(s, { type: 'AUCTION_PASS' }));
  assert.equal(s.properties[5].ownerId, null);
  assert.equal(s.phase, 'manage');
});
