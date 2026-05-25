import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';
import { actorId, threatLevel, effectiveBuffer, findTrade, botAction } from '../src/ai/bot.js';
import { PERSONALITIES, makePersonality } from '../src/ai/personalities.js';
import { makeRng } from '../src/engine/rng.js';

function g(n = 2) {
  return createGame(Array.from({ length: n }, (_, i) => ({ name: `P${i}`, token: 'hat' })), { seed: 1 });
}

test('actorId resolves turn / auction / trade actors', () => {
  let s = g();
  assert.equal(actorId(s), 0);
  s.phase = 'auction'; s.pending.auction = { pos: 5, bidders: [1, 0], currentBidderIndex: 0, highBid: 0, highBidderId: null };
  assert.equal(actorId(s), 1);
  s = g(); s.phase = 'trade'; s.pending.trade = { toId: 1, fromId: 0, give: {}, want: {} };
  assert.equal(actorId(s), 1);
  s = g(); s.phase = 'game-over';
  assert.equal(actorId(s), null);
});

test('effectiveBuffer rises for conservative and falls for aggressive when behind', () => {
  const s = g();
  s.players[1].money = 5000; // opponent dominant
  assert.equal(threatLevel(s, 0), 'behind');
  assert.equal(effectiveBuffer(s, 0, PERSONALITIES.conservative), 600);
  assert.equal(effectiveBuffer(s, 0, PERSONALITIES.aggressive), 37.5);
});

test('findTrade offers to complete a monopoly the bot is one short of', () => {
  const s = g();
  s.properties[1].ownerId = 0; // bot owns one brown
  s.properties[3].ownerId = 1; // opponent owns the other
  const offer = findTrade(s, 0, makePersonality('aggressive'));
  assert.ok(offer);
  assert.equal(offer.fromId, 0);
  assert.equal(offer.toId, 1);
  assert.deepEqual(offer.want.props, [3]);
  assert.ok(offer.give.money > 0 || offer.give.props.length > 0);
});

test('findTrade returns null for a none-initiative personality', () => {
  const s = g();
  s.properties[1].ownerId = 0; s.properties[3].ownerId = 1;
  assert.equal(findTrade(s, 0, makePersonality('dumb')), null);
});

test('botAction rolls on pre-roll', () => {
  assert.equal(botAction(g(), makePersonality('moderate'), makeRng(1), {}).type, 'ROLL');
});

test('aggressive builds when it owns a full group and is flush', () => {
  const s = g();
  s.properties[1].ownerId = 0; s.properties[3].ownerId = 0;
  s.phase = 'manage';
  assert.equal(botAction(s, makePersonality('aggressive'), makeRng(1), {}).type, 'BUILD_HOUSE');
});

test('conservative keeps its buffer instead of building dry', () => {
  const s = g();
  s.properties[37].ownerId = 0; s.properties[39].ownerId = 0; // darkblue, houseCost 200
  s.players[0].money = 250;
  s.phase = 'manage';
  assert.equal(botAction(s, makePersonality('conservative'), makeRng(1), {}).type, 'END_TURN');
});

test('botAction proposes a trade once, then ends the turn', () => {
  const s = g();
  s.properties[1].ownerId = 0; s.properties[3].ownerId = 1;
  s.phase = 'manage';
  const ctx = {};
  assert.equal(botAction(s, makePersonality('aggressive'), makeRng(1), ctx).type, 'PROPOSE_TRADE');
  ctx.proposedTrade = true;
  assert.equal(botAction(s, makePersonality('aggressive'), makeRng(1), ctx).type, 'END_TURN');
});

test('botAction accepts a clearly profitable trade', () => {
  const s = g();
  s.phase = 'trade';
  s.pending.trade = { fromId: 0, toId: 1, give: { money: 300, props: [], jailCards: 0 }, want: { money: 0, props: [], jailCards: 0 } };
  assert.equal(botAction(s, makePersonality('conservative'), makeRng(1), {}).type, 'ACCEPT_TRADE');
});

test('botAction in debt with no assets declares bankruptcy', () => {
  const s = g();
  s.players[0].money = -50; s.phase = 'debt'; s.pending.debt = { debtorId: 0, creditorId: 1 };
  assert.equal(botAction(s, makePersonality('moderate'), makeRng(1), {}).type, 'DECLARE_BANKRUPTCY');
});

test('a rejected trade is not re-proposed within the same turn', () => {
  // Driver rule: per-turn ctx resets only at pre-roll, NOT on every actor change.
  let s = createGame([{ name: 'A', token: 'hat' }, { name: 'B', token: 'car' }], { seed: 1 });
  s.properties[1].ownerId = 0; // A is one short of brown
  s.properties[3].ownerId = 1; // B owns the missing brown (B will reject)
  s.phase = 'manage';
  const persons = [makePersonality('aggressive'), makePersonality('conservative')];
  const rng = makeRng(1);
  let ctx = {};
  let proposalsByA = 0;
  for (let i = 0; i < 60 && s.currentPlayerIndex === 0; i++) {
    const id = actorId(s);
    if (s.phase === 'pre-roll') ctx = {}; // turn boundary only
    const a = botAction(s, persons[id], rng, ctx);
    if (!a) break;
    if (a.type === 'PROPOSE_TRADE' && id === 0) proposalsByA++;
    ({ state: s } = applyAction(s, a));
  }
  assert.ok(proposalsByA <= 1, `A re-proposed ${proposalsByA} times in one turn`);
});

test('aggressive does not oscillate mortgage/unmortgage when funding a build', () => {
  let s = g();
  s.properties[1].ownerId = 0; s.properties[3].ownerId = 0; // full brown group
  s.properties[6].ownerId = 0;                              // spare lightblue (single)
  s.players[0].money = 100;
  s.players[1].money = 200; // keep player 0 from being "behind"
  s.phase = 'manage';
  const pers = makePersonality('aggressive');
  const a1 = botAction(s, pers, makeRng(1), {});
  assert.equal(a1.type, 'MORTGAGE');  // mortgages the spare to fund a build
  assert.equal(a1.pos, 6);
  ({ state: s } = applyAction(s, { type: 'MORTGAGE', pos: 6 }));
  const a2 = botAction(s, pers, makeRng(1), {});
  assert.notEqual(a2.type, 'UNMORTGAGE'); // must not immediately undo it
  assert.equal(a2.type, 'BUILD_HOUSE');
});

test('a 4-personality game autoplays without throwing and stays valid', () => {
  let s = createGame([
    { name: 'Dumb', token: 'hat' }, { name: 'Cons', token: 'car' },
    { name: 'Mod', token: 'dog' }, { name: 'Agg', token: 'ship' },
  ], { seed: 11 });
  const persons = [makePersonality('dumb'), makePersonality('conservative'), makePersonality('moderate'), makePersonality('aggressive')];
  const rng = makeRng(11);
  const ctx = {};
  let lastTurn = -1;
  for (let i = 0; i < 20000 && s.phase !== 'game-over'; i++) {
    const id = actorId(s);
    if (id == null) break;
    if (id !== lastTurn) { ctx.proposedTrade = false; lastTurn = id; }
    const action = botAction(s, persons[id], rng, ctx);
    if (!action) break;
    ({ state: s } = applyAction(s, action));
    JSON.parse(JSON.stringify(s));
    for (const p of s.players) assert.ok(Number.isFinite(p.money));
  }
  assert.ok(s.phase === 'game-over' || s.players.filter((p) => !p.bankrupt).length >= 1);
});
