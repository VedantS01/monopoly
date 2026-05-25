import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';
import { autoStep } from '../src/ui/autoplay.js';
import { makeRng } from '../src/engine/rng.js';

function game(seed = 1) {
  return createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed });
}

test('autoStep rolls when it is pre-roll and not jailed', () => {
  const a = autoStep(game(), makeRng(1));
  assert.equal(a.type, 'ROLL');
  assert.equal(a.dice.length, 2);
});

test('autoStep buys an affordable property and declines an unaffordable one', () => {
  let s = game();
  s.phase = 'resolving';
  s.pending.decision = { kind: 'buy', pos: 39, playerId: 0 }; // NY $400
  assert.equal(autoStep(s).type, 'BUY_PROPERTY');
  s.players[0].money = 100;
  assert.equal(autoStep(s).type, 'DECLINE_PROPERTY');
});

test('autoStep ends the turn during manage', () => {
  const s = game(); s.phase = 'manage';
  assert.equal(autoStep(s).type, 'END_TURN');
});

test('autoStep in jail pays, uses a card, or rolls depending on resources', () => {
  let s = game(); s.phase = 'pre-roll'; s.players[0].inJail = true;
  assert.equal(autoStep(s, makeRng(1)).type, 'PAY_JAIL');
  s.players[0].money = 10;
  assert.equal(autoStep(s, makeRng(1)).type, 'ROLL_FOR_JAIL');
  s.players[0].getOutCards = 1;
  assert.equal(autoStep(s, makeRng(1)).type, 'USE_JAIL_CARD');
});

test('autoStep resolves an auction toward termination', () => {
  let s = game(); s.phase = 'auction';
  s.pending.auction = { pos: 5, bidders: [0, 1], currentBidderIndex: 0, highBid: 0, highBidderId: null };
  const a = autoStep(s);
  assert.ok(a.type === 'AUCTION_BID' || a.type === 'AUCTION_PASS');
});

test('autoStep returns null at game over', () => {
  const s = game(); s.phase = 'game-over'; s.winnerId = 0;
  assert.equal(autoStep(s), null);
});

test('a forced debt with no assets autoplays to bankruptcy', () => {
  let s = game();
  s.players[0].money = -50;
  s.phase = 'debt';
  s.pending.debt = { debtorId: 0, creditorId: 1 };
  const a = autoStep(s);
  assert.equal(a.type, 'DECLARE_BANKRUPTCY');
});

test('a full autoplayed game runs without throwing and stays valid for many steps', () => {
  let s = game(7);
  const rng = makeRng(7);
  let moved = false;
  for (let i = 0; i < 3000 && s.phase !== 'game-over'; i++) {
    const action = autoStep(s, rng);
    if (!action) break;
    const before = s.players[0].position;
    ({ state: s } = applyAction(s, action));
    if (s.players[0].position !== before) moved = true;
    // state stays serializable and money are finite numbers
    JSON.parse(JSON.stringify(s));
    for (const p of s.players) assert.ok(Number.isFinite(p.money));
    assert.ok(['pre-roll', 'resolving', 'manage', 'auction', 'trade', 'debt', 'game-over'].includes(s.phase));
  }
  assert.ok(moved, 'players should have moved during autoplay');
});
