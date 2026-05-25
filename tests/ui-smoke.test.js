// Dependency-free DOM stub so we can render the UI in Node and catch crashes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { renderBoard } from '../src/ui/board.js';
import { renderPanels } from '../src/ui/panels.js';
import { renderModals } from '../src/ui/modals.js';
import { renderSetup } from '../src/ui/setup.js';

class El {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.style = {}; this.className = ''; this._text = ''; this._attrs = {}; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); }
  append(...n) { for (const x of n) if (x != null) this.appendChild(typeof x === 'string' ? new Text(x) : x); }
  get firstChild() { return this.children[0] || null; }
  setAttribute(k, v) { this._attrs[k] = v; }
  setAttributeNS() {}
  addEventListener() {}
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map((c) => c.textContent || '').join(''); }
  querySelectorAll() { return []; }
  querySelector() { return null; }
}
class Text { constructor(t) { this._text = String(t); } get textContent() { return this._text; } }
globalThis.document = {
  createElement: (t) => new El(t),
  createElementNS: (_ns, t) => new El(t),
  createTextNode: (t) => new Text(t),
};

function game() {
  return createGame([{ name: 'A', token: 'hat', color: '#c0392b' }, { name: 'B', token: 'car', color: '#2980b9' }], { seed: 1 });
}
const noop = () => {};

test('renderBoard builds all 40 tiles plus a center', () => {
  const node = renderBoard(game());
  assert.equal(node.children.length, 41);
});

test('renderPanels renders without throwing for pre-roll and manage', () => {
  const s1 = game();
  assert.ok(renderPanels(s1, noop).children.length > 0);
  const s2 = game(); s2.phase = 'manage';
  assert.ok(renderPanels(s2, noop).children.length > 0);
});

test('renderSetup populates the root', () => {
  const root = new El();
  renderSetup(root, { onStart: noop, onResume: noop, hasSave: true });
  assert.ok(root.children.length > 0);
});

test('renderModals shows a buy modal during resolving', () => {
  const s = game();
  s.phase = 'resolving';
  s.pending.decision = { kind: 'buy', pos: 5, playerId: 0 };
  const root = new El();
  renderModals(s, noop, root, {}, noop);
  assert.equal(root.children.length, 1); // one overlay
});

test('renderModals shows auction, debt, trade-offer, and game-over without throwing', () => {
  // auction
  let s = game(); s.phase = 'auction';
  s.pending.auction = { pos: 5, bidders: [0, 1], currentBidderIndex: 0, highBid: 0, highBidderId: null };
  let root = new El(); renderModals(s, noop, root, {}, noop);
  assert.equal(root.children.length, 1);

  // debt
  s = game(); s.phase = 'debt'; s.pending.debt = { debtorId: 0, creditorId: 1 };
  root = new El(); renderModals(s, noop, root, {}, noop);
  assert.equal(root.children.length, 1);

  // pending trade offer
  s = game();
  s.pending.trade = { fromId: 0, toId: 1, give: { money: 100, props: [1], jailCards: 0 }, want: { money: 0, props: [3], jailCards: 0 } };
  root = new El(); renderModals(s, noop, root, {}, noop);
  assert.equal(root.children.length, 1);

  // game over
  s = game(); s.phase = 'game-over'; s.winnerId = 1;
  root = new El(); renderModals(s, noop, root, {}, noop);
  assert.equal(root.children.length, 1);
});

test('renderModals manage + trade builders render', () => {
  const s = game();
  s.properties[1].ownerId = 0; // A owns Marrakesh
  const root = new El();
  renderModals(s, noop, root, { manage: true }, noop);
  assert.ok(root.children.length >= 1);
  const root2 = new El();
  renderModals(s, noop, root2, { trade: true }, noop);
  assert.ok(root2.children.length >= 1);
});

test('manage modal shows a Build button only when building is legal', () => {
  const s = game();
  s.phase = 'manage';
  s.properties[1].ownerId = 0; s.properties[3].ownerId = 0; // full brown group, affordable
  const root = new El();
  renderModals(s, noop, root, { manage: true }, noop);
  assert.ok(root.textContent.includes('Build'), 'expected a Build button for a full affordable group');

  const s2 = game();
  s2.phase = 'manage';
  s2.properties[1].ownerId = 0; // only one of the brown group -> cannot build
  const root2 = new El();
  renderModals(s2, noop, root2, { manage: true }, noop);
  assert.ok(!root2.textContent.includes('Build'), 'no Build button when the group is incomplete');
});
