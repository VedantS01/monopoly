import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';

function setup() {
  const s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
  s.properties[1].ownerId = 0;  // A owns Marrakesh
  s.properties[3].ownerId = 1;  // B owns Cairo
  s.phase = 'manage';
  return s;
}

const offer = {
  fromId: 0, toId: 1,
  give: { money: 100, props: [1], jailCards: 0 },
  want: { money: 0, props: [3], jailCards: 0 },
};

test('PROPOSE_TRADE stores a pending offer', () => {
  let s = setup();
  ({ state: s } = applyAction(s, { type: 'PROPOSE_TRADE', offer }));
  assert.equal(s.pending.trade.toId, 1);
  assert.equal(s.phase, 'trade');
});

test('ACCEPT_TRADE swaps money and properties', () => {
  let s = setup();
  ({ state: s } = applyAction(s, { type: 'PROPOSE_TRADE', offer }));
  ({ state: s } = applyAction(s, { type: 'ACCEPT_TRADE' }));
  assert.equal(s.properties[1].ownerId, 1);
  assert.equal(s.properties[3].ownerId, 0);
  assert.equal(s.players[0].money, 1400);
  assert.equal(s.players[1].money, 1600);
  assert.equal(s.phase, 'manage');
});

test('REJECT_TRADE clears the offer with no changes', () => {
  let s = setup();
  ({ state: s } = applyAction(s, { type: 'PROPOSE_TRADE', offer }));
  ({ state: s } = applyAction(s, { type: 'REJECT_TRADE' }));
  assert.equal(s.properties[1].ownerId, 0);
  assert.equal(s.phase, 'manage');
  assert.equal(s.pending.trade, undefined);
});

test('invalid trade (proposer lacks the property) is rejected', () => {
  let s = setup();
  ({ state: s } = applyAction(s, {
    type: 'PROPOSE_TRADE',
    offer: { fromId: 0, toId: 1, give: { money: 0, props: [3], jailCards: 0 }, want: { money: 0, props: [], jailCards: 0 } },
  }));
  assert.equal(s.pending.trade, undefined);
});
