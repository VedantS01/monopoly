# World Monopoly — UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A responsive, vintage-styled, pass-and-play UI on top of the verified engine, with auto-save/resume, that runs offline and deploys to GitHub Pages.

**Architecture:** The UI imports `applyAction`, `createGame`, `serialize`, `deserialize` from the engine and `BOARD`/`getSpace` for rendering. It holds one `state` object, re-renders from it after every action, and autosaves to `localStorage`. No game rules live in the UI. One small engine enhancement (debt detection) is added first so the bankruptcy flow has a trigger.

**Tech Stack:** Vanilla JS ES modules + CSS. No build step. `node --test` for the engine enhancement; the UI is verified by a full-game integration test and by running it in a browser.

---

## File Structure

```
index.html                 app shell: <div id="app">, module script importing app.js
styles.css                 vintage theme tokens, board grid, panels, modals, responsive
src/engine/rules.js        (modify) debt detection + END_TURN guard
tests/debt.test.js         debt-flag + debt-resolution tests
tests/integration.test.js  plays a scripted game to completion via applyAction
src/ui/
  dom.js                   tiny helpers: el(), clear(), money formatting
  board.js                 renders the 11x11 board grid from BOARD + state
  panels.js                renders player/money list, dice + context actions, log
  modals.js                buy, auction, trade, manage, card, debt, game-over modals
  setup.js                 new-game setup screen (players, tokens, colors) + resume
  app.js                   entry: state, render(), dispatch(), autosave, screen flow
```

---

## Task U1: Engine debt detection (so bankruptcy has a trigger)

**Files:**
- Modify: `src/engine/rules.js`
- Test: `tests/debt.test.js`

When a payment drives the current player below $0, the engine flags `pending.debt` and sets `phase: 'debt'`. Raise-cash actions (mortgage/sell/unmortgage/accept-trade) that bring money back to ≥ 0 clear the debt and return to `manage`. `END_TURN` is blocked while in debt.

- [ ] **Step 1: Write failing tests** — `tests/debt.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';

function game() {
  return createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
}

test('unaffordable rent flags debt to the owner and enters debt phase', () => {
  let s = game();
  s.players[0].money = 10;
  s.properties[39].ownerId = 1; // B owns New York
  s.players[0].position = 37;
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [1, 1] })); // -> 39, rent 50
  assert.equal(s.phase, 'debt');
  assert.equal(s.pending.debt.debtorId, 0);
  assert.equal(s.pending.debt.creditorId, 1);
  assert.ok(s.players[0].money < 0);
});

test('END_TURN is blocked while in debt', () => {
  let s = game();
  s.players[0].money = -5;
  s.phase = 'debt';
  s.pending.debt = { debtorId: 0, creditorId: 1 };
  ({ state: s } = applyAction(s, { type: 'END_TURN' }));
  assert.equal(s.currentPlayerIndex, 0); // did not advance
  assert.equal(s.phase, 'debt');
});

test('mortgaging back to solvency clears the debt and returns to manage', () => {
  let s = game();
  s.players[0].money = -50;
  s.properties[39].ownerId = 0; // A owns New York (mortgage value 200)
  s.phase = 'debt';
  s.pending.debt = { debtorId: 0, creditorId: 1 };
  ({ state: s } = applyAction(s, { type: 'MORTGAGE', pos: 39 }));
  assert.ok(s.players[0].money >= 0);
  assert.equal(s.phase, 'manage');
  assert.equal(s.pending.debt, undefined);
});

test('unaffordable tax flags debt to the bank (creditor null)', () => {
  let s = game();
  s.players[0].money = 50;
  s.players[0].position = 0;
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [2, 2] })); // -> 4 Visa Fee 200
  assert.equal(s.phase, 'debt');
  assert.equal(s.pending.debt.creditorId, null);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test tests/debt.test.js` → FAIL.

- [ ] **Step 3: Implement** — in `src/engine/rules.js`:

Add a helper near `log`:

```js
function flagDebt(state, debtorId, creditorId) {
  state.pending.debt = { debtorId, creditorId };
  state.phase = 'debt';
}
```

In `payRent`, after the transfer, flag debt if the payer went negative:

```js
function payRent(state, payer, owner, amount) {
  payer.money -= amount;
  owner.money += amount;
  log(state, `${payer.name} paid $${amount} rent to ${owner.name}.`);
  if (payer.money < 0) flagDebt(state, payer.id, owner.id);
}
```

In `resolveLanding`, make the rent branch respect debt (replace the `state.phase = 'manage'` that follows the rent payment):

```js
    if (prop.ownerId !== player.id && !prop.mortgaged) {
      const rent = rentFor(state, player.position, state.dice[0] + state.dice[1]);
      payRent(state, player, playerById(state, prop.ownerId), rent);
    }
    if (state.phase !== 'debt') state.phase = 'manage';
    return;
```

In the tax branch:

```js
  if (space.type === 'tax') {
    player.money -= space.amount;
    log(state, `${player.name} paid ${space.name} of $${space.amount}.`);
    if (player.money < 0) flagDebt(state, player.id, null);
    else state.phase = 'manage';
    return;
  }
```

In the card branch, after `applyCardEffect`, replace the phase line:

```js
    applyCardEffect(state, player, card);
    if (state.phase === 'resolving' || state.phase === 'debt') { /* keep */ }
    else if (player.money < 0) flagDebt(state, player.id, null);
    else state.phase = 'manage';
    return;
```

Add a debt-resolution helper and call it after raise-cash actions:

```js
function clearDebtIfSolvent(state) {
  if (state.phase === 'debt' && state.pending.debt) {
    const d = playerById(state, state.pending.debt.debtorId);
    if (d.money >= 0) {
      delete state.pending.debt;
      state.phase = 'manage';
    }
  }
}
```

Call `clearDebtIfSolvent(s);` at the end of the `MORTGAGE`, `UNMORTGAGE`, `SELL_HOUSE`, and `ACCEPT_TRADE` cases (before `break`). Allow these actions during the `debt` phase (they already don't check for `manage`, except none should be blocked — confirm `BUILD_HOUSE` keeps its `manage` guard but `SELL_HOUSE`/`MORTGAGE` have none).

Guard `END_TURN` against the debt phase — at the very top of the `END_TURN` case add:

```js
      if (s.phase === 'debt') break;
```

- [ ] **Step 4: Run to verify it passes** — `node --test tests/debt.test.js && npm test` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/rules.js tests/debt.test.js
git commit -m "feat(engine): debt detection and resolution for bankruptcy flow"
```

---

## Task U2: Full-game integration test

**Files:**
- Test: `tests/integration.test.js`

Proves the engine can drive a whole game from setup to a winner using only `applyAction`. Uses fixed dice to script it.

- [ ] **Step 1: Write the test**

```js
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
```

- [ ] **Step 2: Run** — `node --test tests/integration.test.js` → PASS (these exercise already-built behavior).

- [ ] **Step 3: Commit**

```bash
git add tests/integration.test.js
git commit -m "test(engine): full-game integration via applyAction"
```

---

## Task U3: App shell + DOM helpers + setup screen

**Files:**
- Create: `index.html`, `src/ui/dom.js`, `src/ui/setup.js`, `src/ui/app.js` (skeleton)

- [ ] **Step 1: `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>World Monopoly — Pass &amp; Play</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div id="app"></div>
  <script type="module" src="src/ui/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: `src/ui/dom.js`**

```js
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
export function money(n) { return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US'); }
```

- [ ] **Step 3: `src/ui/setup.js`** — renders the new-game form and calls `onStart(playerDefs)`.

```js
import { el, clear } from './dom.js';

const TOKENS = ['🚗', '✈️', '🚢', '🚂', '🧳', '⛵'];
const COLORS = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#16a085'];

export function renderSetup(root, { onStart, onResume, hasSave }) {
  clear(root);
  let count = 2;
  const form = el('div', { class: 'setup' });

  const rowsWrap = el('div', { class: 'setup-players' });
  function rebuild() {
    clear(rowsWrap);
    for (let i = 0; i < count; i++) {
      rowsWrap.appendChild(el('div', { class: 'setup-row' }, [
        el('input', { class: 'setup-name', type: 'text', value: `Player ${i + 1}`, 'data-i': i, maxlength: 14 }),
        el('select', { class: 'setup-token', 'data-i': i }, TOKENS.map((t, ti) =>
          el('option', { value: t, ...(ti === i ? { selected: 'selected' } : {}) }, t))),
      ]));
    }
  }
  rebuild();

  const controls = el('div', { class: 'setup-controls' }, [
    el('button', { class: 'btn', text: '− Player', onclick: () => { if (count > 2) { count--; rebuild(); } } }),
    el('button', { class: 'btn', text: '+ Player', onclick: () => { if (count < 6) { count++; rebuild(); } } }),
  ]);

  const start = el('button', {
    class: 'btn btn-primary btn-lg', text: 'Start Game',
    onclick: () => {
      const names = [...rowsWrap.querySelectorAll('.setup-name')];
      const tokens = [...rowsWrap.querySelectorAll('.setup-token')];
      const defs = names.map((n, i) => ({
        name: n.value.trim() || `Player ${i + 1}`,
        token: tokens[i].value,
        color: COLORS[i % COLORS.length],
      }));
      onStart(defs);
    },
  });

  form.append(
    el('h1', { class: 'title', text: '🎲 World Monopoly' }),
    el('p', { class: 'subtitle', text: 'Pass-and-play · 2–6 players' }),
    ...(hasSave ? [el('button', { class: 'btn btn-resume', text: '↩ Resume saved game', onclick: onResume })] : []),
    rowsWrap, controls, start,
  );
  root.appendChild(form);
}
```

- [ ] **Step 4: `src/ui/app.js` skeleton** (renders setup, wires start → new game, autosave):

```js
import { createGame, serialize, deserialize } from '../engine/state.js';
import { applyAction } from '../engine/rules.js';
import { renderSetup } from './setup.js';
import { clear } from './dom.js';

const SAVE_KEY = 'world-monopoly-save-v1';
const root = document.getElementById('app');
let state = null;

function save() { if (state) localStorage.setItem(SAVE_KEY, serialize(state)); }
function loadSave() { const j = localStorage.getItem(SAVE_KEY); return j ? deserialize(j) : null; }

export function dispatch(action) {
  const { state: next } = applyAction(state, action);
  state = next;
  save();
  renderGame();
}

function startGame(defs) { state = createGame(defs); save(); renderGame(); }

function renderGame() {
  // Replaced in Task U4 with the full board/panels render.
  clear(root);
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify({ phase: state.phase, turn: state.currentPlayerIndex }, null, 2);
  root.appendChild(pre);
}

function boot() {
  renderSetup(root, {
    hasSave: !!loadSave(),
    onStart: startGame,
    onResume: () => { state = loadSave(); renderGame(); },
  });
}
boot();
```

- [ ] **Step 5: Verify it loads** — start a static server and open the page; the setup screen should render and "Start Game" should switch to the placeholder JSON view.

```bash
python3 -m http.server 8000 >/dev/null 2>&1 &
# open http://localhost:8000/
```

- [ ] **Step 6: Commit**

```bash
git add index.html src/ui/dom.js src/ui/setup.js src/ui/app.js
git commit -m "feat(ui): app shell, DOM helpers, and setup screen"
```

---

## Task U4: Board + panels rendering

**Files:**
- Create: `src/ui/board.js`, `src/ui/panels.js`
- Modify: `src/ui/app.js` (`renderGame` uses board + panels)

- [ ] **Step 1: `src/ui/board.js`** — render an 11×11 CSS grid; place each of the 40 spaces on the ring by position; show name, color band, price, owner dot, houses/hotel, and player tokens.

```js
import { el } from './dom.js';
import { BOARD, getSpace } from '../engine/board.js';

// Map board position (0..39) to grid cell [row, col] on an 11x11 ring.
function cell(pos) {
  if (pos <= 10) return { row: 11, col: 11 - pos };          // bottom row, GO at bottom-right
  if (pos <= 20) return { row: 11 - (pos - 10), col: 1 };    // left column up
  if (pos <= 30) return { row: 1, col: (pos - 20) + 1 };     // top row, left->right
  return { row: (pos - 30) + 1, col: 11 };                   // right column down
}

export function renderBoard(state) {
  const grid = el('div', { class: 'board' });
  for (const space of BOARD) {
    const { row, col } = cell(space.pos);
    const tile = el('div', {
      class: `tile tile-${space.type}` + (space.group ? ` grp-${space.group}` : ''),
      style: `grid-row:${row};grid-column:${col}`,
    });
    if (space.type === 'city') tile.appendChild(el('div', { class: 'band' }));
    tile.appendChild(el('div', { class: 'tile-name', text: space.name }));
    if (space.price != null) {
      const prop = state.properties[space.pos];
      if (prop.ownerId == null) tile.appendChild(el('div', { class: 'tile-price', text: '$' + space.price }));
      else {
        const owner = state.players[prop.ownerId];
        tile.appendChild(el('div', { class: 'owner-dot', style: `background:${owner.color}`, title: owner.name }));
        if (prop.mortgaged) tile.appendChild(el('div', { class: 'mortgaged', text: 'M' }));
        if (prop.houses === 5) tile.appendChild(el('div', { class: 'houses', text: '🏨' }));
        else if (prop.houses > 0) tile.appendChild(el('div', { class: 'houses', text: '🏠'.repeat(prop.houses) }));
      }
    }
    // tokens of players on this space
    const here = state.players.filter((p) => !p.bankrupt && p.position === space.pos);
    if (here.length) tile.appendChild(el('div', { class: 'tokens' }, here.map((p) => el('span', { class: 'token', title: p.name, text: p.token }))));
    grid.appendChild(tile);
  }
  // center logo
  grid.appendChild(el('div', { class: 'board-center', style: 'grid-row:2/11;grid-column:2/11' }, [
    el('div', { class: 'center-logo', text: '🌍 WORLD MONOPOLY' }),
  ]));
  return grid;
}
```

- [ ] **Step 2: `src/ui/panels.js`** — player/money list, dice + context actions, and the log.

```js
import { el, money } from './dom.js';
import { getSpace } from '../engine/board.js';

export function renderPanels(state, dispatch) {
  const wrap = el('div', { class: 'side' });

  // players
  const players = el('div', { class: 'players' }, state.players.map((p) => el('div', {
    class: 'player-card' + (p.id === state.currentPlayerIndex ? ' active' : '') + (p.bankrupt ? ' bankrupt' : ''),
    style: `border-color:${p.color}`,
  }, [
    el('span', { class: 'p-token', text: p.token }),
    el('span', { class: 'p-name', text: p.name + (p.inJail ? ' (Jail)' : '') }),
    el('span', { class: 'p-money', text: money(p.money) }),
  ])));

  // dice + context actions
  const actions = el('div', { class: 'actions' });
  actions.appendChild(el('div', { class: 'dice', text: state.dice[0] && state.dice[1] ? `🎲 ${state.dice[0]} + ${state.dice[1]}` : '🎲' }));
  actions.appendChild(renderActions(state, dispatch));

  // log (latest 10)
  const log = el('div', { class: 'log' }, state.log.slice(-10).reverse().map((m) => el('div', { class: 'log-line', text: m })));

  wrap.append(players, actions, el('div', { class: 'log-wrap' }, [el('h3', { text: 'Game log' }), log]));
  return wrap;
}

function btn(label, action, dispatch, opts = {}) {
  return el('button', { class: 'btn ' + (opts.primary ? 'btn-primary' : ''), text: label, onclick: () => dispatch(action) });
}

function renderActions(state, dispatch) {
  const box = el('div', { class: 'action-buttons' });
  const cur = state.players[state.currentPlayerIndex];
  if (state.phase === 'pre-roll') {
    if (cur.inJail) {
      box.append(
        btn('Pay $50', { type: 'PAY_JAIL' }, dispatch, { primary: true }),
        ...(cur.getOutCards > 0 ? [btn('Use Jail Card', { type: 'USE_JAIL_CARD' }, dispatch)] : []),
        btn('Roll for doubles', { type: 'ROLL_FOR_JAIL' }, dispatch),
      );
    } else {
      box.append(btn('🎲 Roll', { type: 'ROLL' }, dispatch, { primary: true }));
    }
  } else if (state.phase === 'manage') {
    box.append(btn('Manage properties', { type: '__OPEN_MANAGE' }, dispatch));
    box.append(btn('Propose trade', { type: '__OPEN_TRADE' }, dispatch));
    box.append(btn('End turn', { type: 'END_TURN' }, dispatch, { primary: true }));
  }
  // 'resolving','auction','trade','debt','game-over' are handled by modals (Task U5).
  return box;
}
```

- [ ] **Step 3: Update `app.js` `renderGame`** to compose board + panels, switching to setup on game-over reset later:

```js
import { renderBoard } from './board.js';
import { renderPanels } from './panels.js';
// ...
function renderGame() {
  clear(root);
  const layout = document.createElement('div');
  layout.className = 'game-layout';
  layout.appendChild(renderBoard(state));
  layout.appendChild(renderPanels(state, dispatch));
  root.appendChild(layout);
  renderModals(state, dispatch, root); // added in Task U5
}
```

(Define a no-op `renderModals` temporarily, replaced in U5.)

- [ ] **Step 4: Verify** in the browser: start a 2-player game, click Roll, watch a token move and the log/money update.

- [ ] **Step 5: Commit**

```bash
git add src/ui/board.js src/ui/panels.js src/ui/app.js
git commit -m "feat(ui): board grid and side panels"
```

---

## Task U5: Modals — buy, auction, trade, manage, card, debt, game-over

**Files:**
- Create: `src/ui/modals.js`
- Modify: `src/ui/app.js` (handle the `__OPEN_*` pseudo-actions with local UI flags)

`modals.js` exports `renderModals(state, dispatch, root)` that appends an overlay when `state.phase` (or a UI flag) calls for one.

- [ ] **Step 1: Local UI flags in `app.js`.** Intercept pseudo-actions in `dispatch` before calling the engine:

```js
let ui = { manage: false, trade: false };
export function dispatch(action) {
  if (action.type === '__OPEN_MANAGE') { ui.manage = true; return renderGame(); }
  if (action.type === '__OPEN_TRADE') { ui.trade = true; return renderGame(); }
  if (action.type === '__CLOSE') { ui = { manage: false, trade: false }; return renderGame(); }
  const { state: next } = applyAction(state, action);
  state = next;
  ui = { manage: false, trade: false }; // engine actions close transient panels
  save();
  renderGame();
}
```

Pass `ui` into `renderModals(state, dispatch, root, ui)`.

- [ ] **Step 2: `src/ui/modals.js`.** Implement an `overlay(title, bodyNodes)` helper and one builder per situation:
  - **buy** (`phase==='resolving'` && `pending.decision`): show property name/price, "Buy $X" → `{type:'BUY_PROPERTY'}`, "Auction" → `{type:'DECLINE_PROPERTY'}`.
  - **auction** (`phase==='auction'`): show current high bid + whose turn; a number input + "Bid" → `{type:'AUCTION_BID', amount}`; "Pass" → `{type:'AUCTION_PASS'}`.
  - **card** (transient): if the latest log line begins with "drew:", show it briefly (use last event text passed via state.log) — simplest: show nothing modal, the log already shows it. (Skip a dedicated card modal for v1.)
  - **manage** (`ui.manage`): list the current player's properties with Build/Sell/Mortgage/Unmortgage buttons dispatching `{type:'BUILD_HOUSE'|'SELL_HOUSE'|'MORTGAGE'|'UNMORTGAGE', pos}`; a Close button → `{type:'__CLOSE'}`.
  - **trade** (`ui.trade`): pick a partner, pick give/want properties (checkboxes) + money inputs, "Propose" → `{type:'PROPOSE_TRADE', offer}`. When `pending.trade` exists, show the partner an Accept/Reject (`ACCEPT_TRADE`/`REJECT_TRADE`).
  - **debt** (`phase==='debt'`): "You owe money" → buttons to open Manage (raise cash) or `{type:'DECLARE_BANKRUPTCY'}`.
  - **game-over** (`phase==='game-over'`): show winner; "New game" button → calls a `resetToSetup()` exported from app.

Full code:

```js
import { el, clear, money } from './dom.js';
import { getSpace, COLOR_GROUPS, groupPositions } from '../engine/board.js';

function overlay(title, body, root) {
  const ov = el('div', { class: 'overlay' }, [
    el('div', { class: 'modal' }, [el('h2', { text: title }), ...[].concat(body)]),
  ]);
  root.appendChild(ov);
}

export function renderModals(state, dispatch, root, ui = {}, resetToSetup) {
  const cur = state.players[state.currentPlayerIndex];

  if (state.phase === 'resolving' && state.pending.decision) {
    const sp = getSpace(state.pending.decision.pos);
    overlay(`Buy ${sp.name}?`, [
      el('p', { text: `Price: ${money(sp.price)} · Your cash: ${money(cur.money)}` }),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn btn-primary', text: `Buy ${money(sp.price)}`, disabled: cur.money < sp.price ? 'disabled' : null, onclick: () => dispatch({ type: 'BUY_PROPERTY' }) }),
        el('button', { class: 'btn', text: 'Auction', onclick: () => dispatch({ type: 'DECLINE_PROPERTY' }) }),
      ]),
    ], root);
  }

  if (state.phase === 'auction') {
    const a = state.pending.auction;
    const bidder = state.players[a.bidders[a.currentBidderIndex]];
    const input = el('input', { class: 'bid-input', type: 'number', min: a.highBid + 1, value: a.highBid + 10 });
    overlay(`Auction: ${getSpace(a.pos).name}`, [
      el('p', { text: `High bid: ${money(a.highBid)}${a.highBidderId != null ? ' by ' + state.players[a.highBidderId].name : ''}` }),
      el('p', { class: 'turn', text: `${bidder.name}'s bid (cash ${money(bidder.money)})` }),
      el('div', { class: 'modal-actions' }, [
        input,
        el('button', { class: 'btn btn-primary', text: 'Bid', onclick: () => dispatch({ type: 'AUCTION_BID', amount: Number(input.value) }) }),
        el('button', { class: 'btn', text: 'Pass', onclick: () => dispatch({ type: 'AUCTION_PASS' }) }),
      ]),
    ], root);
  }

  if (state.phase === 'debt' && state.pending.debt) {
    overlay('You owe money!', [
      el('p', { text: `${cur.name} is at ${money(cur.money)}. Raise cash by mortgaging/selling, or go bankrupt.` }),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn btn-primary', text: 'Raise cash', onclick: () => dispatch({ type: '__OPEN_MANAGE' }) }),
        el('button', { class: 'btn btn-danger', text: 'Declare bankruptcy', onclick: () => dispatch({ type: 'DECLARE_BANKRUPTCY' }) }),
      ]),
    ], root);
  }

  if (ui.manage) overlay('Manage properties', [renderManage(state, dispatch), closeBtn(dispatch)], root);
  if (ui.trade) overlay('Propose a trade', [renderTrade(state, dispatch), closeBtn(dispatch)], root);

  if (state.pending.trade) {
    const t = state.pending.trade;
    const to = state.players[t.toId];
    overlay('Trade offer', [
      el('p', { text: `${state.players[t.fromId].name} → ${to.name}` }),
      el('p', { text: describeSide('Gives', t.give, state) }),
      el('p', { text: describeSide('Wants', t.want, state) }),
      el('p', { class: 'turn', text: `${to.name}, accept?` }),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn btn-primary', text: 'Accept', onclick: () => dispatch({ type: 'ACCEPT_TRADE' }) }),
        el('button', { class: 'btn', text: 'Reject', onclick: () => dispatch({ type: 'REJECT_TRADE' }) }),
      ]),
    ], root);
  }

  if (state.phase === 'game-over') {
    overlay('🏆 Game over', [
      el('p', { class: 'winner', text: `${state.players[state.winnerId].name} wins!` }),
      el('button', { class: 'btn btn-primary', text: 'New game', onclick: () => resetToSetup() }),
    ], root);
  }
}

function closeBtn(dispatch) {
  return el('button', { class: 'btn', text: 'Close', onclick: () => dispatch({ type: '__CLOSE' }) });
}

function describeSide(label, side, state) {
  const props = (side.props || []).map((p) => getSpace(p).name).join(', ') || '—';
  return `${label}: ${money(side.money || 0)} + [${props}]`;
}

function renderManage(state, dispatch) {
  const cur = state.players[state.currentPlayerIndex];
  const owned = Object.entries(state.properties).filter(([, p]) => p.ownerId === cur.id);
  if (!owned.length) return el('p', { text: 'You own no properties.' });
  return el('div', { class: 'manage-list' }, owned.map(([pos, p]) => {
    const sp = getSpace(Number(pos));
    const row = el('div', { class: 'manage-row' }, [
      el('span', { class: 'm-name', text: sp.name + (p.mortgaged ? ' (mortgaged)' : '') + (p.houses ? ` · ${p.houses === 5 ? 'hotel' : p.houses + 'h'}` : '') }),
    ]);
    if (sp.type === 'city') {
      row.appendChild(el('button', { class: 'btn btn-sm', text: `Build ${money(sp.houseCost)}`, onclick: () => dispatch({ type: 'BUILD_HOUSE', pos: Number(pos) }) }));
      if (p.houses > 0) row.appendChild(el('button', { class: 'btn btn-sm', text: 'Sell', onclick: () => dispatch({ type: 'SELL_HOUSE', pos: Number(pos) }) }));
    }
    if (!p.mortgaged) row.appendChild(el('button', { class: 'btn btn-sm', text: 'Mortgage', onclick: () => dispatch({ type: 'MORTGAGE', pos: Number(pos) }) }));
    else row.appendChild(el('button', { class: 'btn btn-sm', text: 'Unmortgage', onclick: () => dispatch({ type: 'UNMORTGAGE', pos: Number(pos) }) }));
    return row;
  }));
}

function renderTrade(state, dispatch) {
  const cur = state.players[state.currentPlayerIndex];
  const others = state.players.filter((p) => p.id !== cur.id && !p.bankrupt);
  const partnerSel = el('select', { class: 'trade-partner' }, others.map((p) => el('option', { value: p.id }, p.name)));
  const giveMoney = el('input', { class: 'tm', type: 'number', min: 0, value: 0 });
  const wantMoney = el('input', { class: 'tm', type: 'number', min: 0, value: 0 });
  const myProps = Object.entries(state.properties).filter(([, p]) => p.ownerId === cur.id);

  function propBox(entries, cls) {
    return el('div', { class: cls }, entries.map(([pos]) => {
      const id = `${cls}-${pos}`;
      return el('label', { class: 'tradeprop' }, [
        el('input', { type: 'checkbox', value: pos, id }), getSpace(Number(pos)).name,
      ]);
    }));
  }
  const giveProps = propBox(myProps, 'give-props');

  const partnerProps = el('div', { class: 'want-props-wrap' });
  function refreshWant() {
    clear(partnerProps);
    const toId = Number(partnerSel.value);
    const theirs = Object.entries(state.properties).filter(([, p]) => p.ownerId === toId);
    partnerProps.appendChild(propBox(theirs, 'want-props'));
  }
  partnerSel.addEventListener('change', refreshWant);
  refreshWant();

  const propose = el('button', {
    class: 'btn btn-primary', text: 'Propose',
    onclick: () => {
      const toId = Number(partnerSel.value);
      const give = { money: Number(giveMoney.value) || 0, props: [...giveProps.querySelectorAll('input:checked')].map((c) => Number(c.value)), jailCards: 0 };
      const want = { money: Number(wantMoney.value) || 0, props: [...partnerProps.querySelectorAll('input:checked')].map((c) => Number(c.value)), jailCards: 0 };
      dispatch({ type: 'PROPOSE_TRADE', offer: { fromId: cur.id, toId, give, want } });
    },
  });

  return el('div', { class: 'trade-builder' }, [
    el('label', { text: 'Partner: ' }), partnerSel,
    el('h4', { text: 'You give' }), el('label', { text: 'Cash: ' }), giveMoney, giveProps,
    el('h4', { text: 'You want' }), el('label', { text: 'Cash: ' }), wantMoney, partnerProps,
    propose,
  ]);
}
```

- [ ] **Step 3: Wire `renderModals` and `resetToSetup` in `app.js`.** Replace the temporary no-op import with the real one, pass `ui` and a `resetToSetup` that clears the save and re-renders setup.

```js
import { renderModals } from './modals.js';
function resetToSetup() { localStorage.removeItem(SAVE_KEY); state = null; ui = { manage: false, trade: false }; boot(); }
// in renderGame: renderModals(state, dispatch, root, ui, resetToSetup);
```

- [ ] **Step 4: Verify** a full hot-seat game in the browser: buy, auction, build, mortgage, trade, jail, and drive someone to bankruptcy to reach the winner screen.

- [ ] **Step 5: Commit**

```bash
git add src/ui/modals.js src/ui/app.js
git commit -m "feat(ui): buy/auction/manage/trade/debt/game-over modals"
```

---

## Task U6: Vintage styling + responsive layout

**Files:**
- Create: `styles.css`

- [ ] **Step 1: Implement `styles.css`** — vintage theme tokens (cream board `#f4ecd8`, deep red `#9b1c1c`, forest green `#1f6b3b`, serif headings via `Georgia`), the 11×11 board grid (`aspect-ratio:1/1`), color-group bands (`.grp-brown`… mapped to the 8 group colors), player cards, action buttons, log, modal overlay, and a `@media (max-width: 820px)` block that stacks the board above the panels and makes the action buttons a sticky bottom bar. Keep tokens in `:root`.

(Write complete CSS — board grid uses `display:grid; grid-template-columns:repeat(11,1fr); grid-template-rows:repeat(11,1fr);`. Each `.tile` has a small font, ellipsis name. Corners and the center span are styled. Provide the 8 `.grp-*` band colors.)

- [ ] **Step 2: Verify** the board looks like a Monopoly board at desktop and phone widths (use the visual companion or a browser).

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat(ui): vintage theme and responsive layout"
```

---

## Task U7: README + GitHub Pages deploy

**Files:**
- Create/replace: `README.md`

- [ ] **Step 1: Write `README.md`** — what the game is, how to play (pass the device), how to run locally (`python3 -m http.server`), how to run tests (`npm test`), the world-cities theme note, and the live Pages URL.

- [ ] **Step 2: Verify** full suite green: `npm test`.

- [ ] **Step 3: Commit and finish the branch** (via finishing-a-development-branch): merge to `main`, push, then enable GitHub Pages on `main` / root and report the live URL.

```bash
git add README.md && git commit -m "docs: README and play instructions"
# merge to main, push, then:
gh api -X POST repos/:owner/monopoly/pages -f source.branch=main -f source.path=/ 2>/dev/null || true
```

---

## Notes / known v1 simplifications
- A non-current player can only go into debt via a rare "collect from each player" card; the UI surfaces debt for the current player. Acceptable for v1.
- The card draw is shown in the log rather than a dedicated modal.
- Trades are single-step propose→accept on the same screen (pass-and-play).
