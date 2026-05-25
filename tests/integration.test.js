import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';

test('a scripted sequence of actions runs without throwing and keeps state serializable', () => {
  let s = createGame([{ name: 'A', token: '🚗' }, { name: 'B', token: '✈️' }], { seed: 3 });
  const steps = [
    { type: 'ROLL', dice: [2, 3] }, { type: 'BUY_PROPERTY' }, { type: 'END_TURN' },
    { type: 'ROLL', dice: [3, 4] }, { type: 'DECLINE_PROPERTY' }, { type: 'AUCTION_PASS' }, { type: 'AUCTION_PASS' }, { type: 'END_TURN' },
    { type: 'ROLL', dice: [1, 2] }, { type: 'END_TURN' },
  ];
  for (const a of steps) {
    const r = applyAction(s, a);
    s = r.state;
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(s)));
    assert.ok(Array.isArray(r.events));
  }
  assert.ok(s.players.length === 2);
});

test('a player with no money and no assets can be driven to bankruptcy and a winner', () => {
  let s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
  s.players[0].money = 0;
  s.properties[39].ownerId = 1;
  s.players[0].position = 37;
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [1, 1] })); // rent on NY -> debt
  assert.equal(s.phase, 'debt');
  ({ state: s } = applyAction(s, { type: 'DECLARE_BANKRUPTCY' }));
  assert.equal(s.phase, 'game-over');
  assert.equal(s.winnerId, 1);
});
