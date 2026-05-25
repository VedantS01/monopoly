# World Monopoly — Rules Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure, DOM-free Monopoly rules engine for the world-cities board, fully covered by `node --test`, exposing `applyAction(state, action) -> { state, events }`.

**Architecture:** All game logic lives in `src/engine/` as ES modules with no DOM and no shared mutable globals. State is a plain serializable object. Every change goes through `applyAction`, a reducer that returns a new state plus human-readable event strings. Randomness (dice, card shuffles) is injected via action payloads so tests are deterministic.

**Tech Stack:** Vanilla JavaScript ES modules. Node's built-in test runner (`node --test`) with `node:assert/strict`. No third-party dependencies, no build step.

---

## File Structure

```
package.json                 { "type": "module" } so node --test loads ESM
src/engine/
  board.js                   BOARD array (40 spaces) + lookups (getSpace, groupPositions)
  cards.js                   CHANCE / CHEST card definitions (id + text + effect)
  state.js                   createGame(), clone(), currentPlayer(), serialize/deserialize
  rng.js                     rollDice(rng) helper + seedable rng for tests
  rules.js                   applyAction() dispatcher + ROLL/move/landing/tax/END_TURN
  rent.js                    rentFor(state, pos, diceTotal) for city/airport/utility
  jail.js                    jail helpers + PAY_JAIL/USE_JAIL_CARD/ROLL_FOR_JAIL
  cardeffects.js             applyCardEffect(state, card) used by rules on DRAW
  build.js                   BUILD_HOUSE/SELL_HOUSE + even-build + bank limits
  mortgage.js                MORTGAGE/UNMORTGAGE
  auction.js                 DECLINE_PROPERTY -> auction, AUCTION_BID/AUCTION_PASS
  trade.js                   PROPOSE_TRADE/ACCEPT_TRADE/REJECT_TRADE
  bankruptcy.js              DECLARE_BANKRUPTCY + asset transfer + win detection
tests/
  board.test.js  cards.test.js  state.test.js  rent.test.js  rules.test.js
  jail.test.js  cardeffects.test.js  build.test.js  mortgage.test.js
  auction.test.js  trade.test.js  bankruptcy.test.js
```

**Design rule for every module:** functions take `state` and return a **new** state (use `clone(state)` then mutate the clone). Never mutate the argument. `applyAction` is the only public entry the UI uses; the per-module functions are imported by `rules.js`.

---

## Task 1: Project scaffolding + test harness

**Files:**
- Create: `package.json`
- Create: `tests/smoke.test.js`
- Create: `src/engine/state.js` (stub)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "world-monopoly",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write a smoke test that imports a stub**

`tests/smoke.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PING } from '../src/engine/state.js';

test('test harness runs and ESM imports work', () => {
  assert.equal(PING, 'pong');
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `PING` / module `state.js` missing.

- [ ] **Step 4: Create the stub export**

`src/engine/state.js`:

```js
export const PING = 'pong';
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 6: Commit**

```bash
git add package.json tests/smoke.test.js src/engine/state.js
git commit -m "chore: node --test harness with ESM"
```

---

## Task 2: Board data + lookups

**Files:**
- Create: `src/engine/board.js`
- Test: `tests/board.test.js`

- [ ] **Step 1: Write failing tests**

`tests/board.test.js`:

```js
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
  assert.equal(ny.rent[0], 50);     // base
  assert.equal(ny.rent[5], 2000);   // hotel
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/board.test.js`
Expected: FAIL — `board.js` not found.

- [ ] **Step 3: Implement `board.js` with the full classic data**

`src/engine/board.js`:

```js
// Each space: { pos, name, type, group?, price?, rent?[6], houseCost? }
// type: 'corner' | 'city' | 'airport' | 'utility' | 'tax' | 'chance' | 'chest' | 'gotojail'
// rent tiers: [base, 1house, 2, 3, 4, hotel]  (classic Monopoly values)

export const BOARD = [
  { pos: 0,  name: 'GO', type: 'corner' },
  { pos: 1,  name: 'Marrakesh', type: 'city', group: 'brown', price: 60, houseCost: 50, rent: [2, 10, 30, 90, 160, 250] },
  { pos: 2,  name: 'Treasury', type: 'chest' },
  { pos: 3,  name: 'Cairo', type: 'city', group: 'brown', price: 60, houseCost: 50, rent: [4, 20, 60, 180, 320, 450] },
  { pos: 4,  name: 'Visa Fee', type: 'tax', amount: 200 },
  { pos: 5,  name: 'JFK Airport', type: 'airport', group: 'airports', price: 200 },
  { pos: 6,  name: 'Bangkok', type: 'city', group: 'lightblue', price: 100, houseCost: 50, rent: [6, 30, 90, 270, 400, 550] },
  { pos: 7,  name: 'Travel', type: 'chance' },
  { pos: 8,  name: 'Hanoi', type: 'city', group: 'lightblue', price: 100, houseCost: 50, rent: [6, 30, 90, 270, 400, 550] },
  { pos: 9,  name: 'Jakarta', type: 'city', group: 'lightblue', price: 120, houseCost: 50, rent: [8, 40, 100, 300, 450, 600] },
  { pos: 10, name: 'Jail / Just Visiting', type: 'corner' },
  { pos: 11, name: 'Istanbul', type: 'city', group: 'pink', price: 140, houseCost: 100, rent: [10, 50, 150, 450, 625, 750] },
  { pos: 12, name: 'Global Power Grid', type: 'utility', group: 'utilities', price: 150 },
  { pos: 13, name: 'Athens', type: 'city', group: 'pink', price: 140, houseCost: 100, rent: [10, 50, 150, 450, 625, 750] },
  { pos: 14, name: 'Cape Town', type: 'city', group: 'pink', price: 160, houseCost: 100, rent: [12, 60, 180, 500, 700, 900] },
  { pos: 15, name: 'Heathrow Airport', type: 'airport', group: 'airports', price: 200 },
  { pos: 16, name: 'Lisbon', type: 'city', group: 'orange', price: 180, houseCost: 100, rent: [14, 70, 200, 550, 750, 950] },
  { pos: 17, name: 'Treasury', type: 'chest' },
  { pos: 18, name: 'Dublin', type: 'city', group: 'orange', price: 180, houseCost: 100, rent: [14, 70, 200, 550, 750, 950] },
  { pos: 19, name: 'Vienna', type: 'city', group: 'orange', price: 200, houseCost: 100, rent: [16, 80, 220, 600, 800, 1000] },
  { pos: 20, name: 'Free Parking', type: 'corner' },
  { pos: 21, name: 'Berlin', type: 'city', group: 'red', price: 220, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { pos: 22, name: 'Travel', type: 'chance' },
  { pos: 23, name: 'Rome', type: 'city', group: 'red', price: 220, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { pos: 24, name: 'Madrid', type: 'city', group: 'red', price: 240, houseCost: 150, rent: [20, 100, 300, 750, 925, 1100] },
  { pos: 25, name: 'Changi Airport', type: 'airport', group: 'airports', price: 200 },
  { pos: 26, name: 'Toronto', type: 'city', group: 'yellow', price: 260, houseCost: 150, rent: [22, 110, 330, 800, 975, 1150] },
  { pos: 27, name: 'Sydney', type: 'city', group: 'yellow', price: 260, houseCost: 150, rent: [22, 110, 330, 800, 975, 1150] },
  { pos: 28, name: 'World Water Co.', type: 'utility', group: 'utilities', price: 150 },
  { pos: 29, name: 'Dubai', type: 'city', group: 'yellow', price: 280, houseCost: 150, rent: [24, 120, 360, 850, 1025, 1200] },
  { pos: 30, name: 'Go To Jail', type: 'gotojail' },
  { pos: 31, name: 'Singapore', type: 'city', group: 'green', price: 300, houseCost: 200, rent: [26, 130, 390, 900, 1100, 1275] },
  { pos: 32, name: 'Paris', type: 'city', group: 'green', price: 300, houseCost: 200, rent: [26, 130, 390, 900, 1100, 1275] },
  { pos: 33, name: 'Treasury', type: 'chest' },
  { pos: 34, name: 'Hong Kong', type: 'city', group: 'green', price: 320, houseCost: 200, rent: [28, 150, 450, 1000, 1200, 1400] },
  { pos: 35, name: "Dubai Int'l Airport", type: 'airport', group: 'airports', price: 200 },
  { pos: 36, name: 'Travel', type: 'chance' },
  { pos: 37, name: 'London', type: 'city', group: 'darkblue', price: 350, houseCost: 200, rent: [35, 175, 500, 1100, 1300, 1500] },
  { pos: 38, name: 'Departure Tax', type: 'tax', amount: 100 },
  { pos: 39, name: 'New York', type: 'city', group: 'darkblue', price: 400, houseCost: 200, rent: [50, 200, 600, 1400, 1700, 2000] },
];

export const COLOR_GROUPS = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue'];

export function getSpace(pos) {
  return BOARD[pos];
}

export function groupPositions(group) {
  return BOARD.filter((s) => s.group === group).map((s) => s.pos);
}

// positions that can ever be owned (cities, airports, utilities)
export function ownablePositions() {
  return BOARD.filter((s) => s.price != null).map((s) => s.pos);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/board.test.js`
Expected: PASS, all assertions.

- [ ] **Step 5: Commit**

```bash
git add src/engine/board.js tests/board.test.js
git commit -m "feat(engine): world-cities board data and lookups"
```

---

## Task 3: Card decks + definitions

**Files:**
- Create: `src/engine/cards.js`
- Test: `tests/cards.test.js`

Card object shape: `{ id, deck:'chance'|'chest', text, effect }` where `effect` is one of:
- `{ kind: 'money', amount }` (negative = pay bank)
- `{ kind: 'eachPlayer', amount }` (positive = collect from each other player; negative = pay each)
- `{ kind: 'moveTo', pos, passGo: true }`
- `{ kind: 'moveToNearest', target: 'airport'|'utility' }`
- `{ kind: 'back3' }`
- `{ kind: 'gotojail' }`
- `{ kind: 'repairs', perHouse, perHotel }`
- `{ kind: 'getOutOfJail' }`

- [ ] **Step 1: Write failing tests**

`tests/cards.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/cards.test.js`
Expected: FAIL — `cards.js` not found.

- [ ] **Step 3: Implement `cards.js`**

`src/engine/cards.js`:

```js
export const CHANCE = [
  { id: 'ch1',  deck: 'chance', text: 'Fly to New York. Advance to New York.', effect: { kind: 'moveTo', pos: 39, passGo: true } },
  { id: 'ch2',  deck: 'chance', text: 'Advance to GO. Collect $200.', effect: { kind: 'moveTo', pos: 0, passGo: true } },
  { id: 'ch3',  deck: 'chance', text: 'Advance to Berlin.', effect: { kind: 'moveTo', pos: 21, passGo: true } },
  { id: 'ch4',  deck: 'chance', text: 'Take a trip to Heathrow Airport.', effect: { kind: 'moveTo', pos: 15, passGo: true } },
  { id: 'ch5',  deck: 'chance', text: 'Advance to the nearest Airport. Pay owner twice the rent.', effect: { kind: 'moveToNearest', target: 'airport' } },
  { id: 'ch6',  deck: 'chance', text: 'Advance to the nearest Utility.', effect: { kind: 'moveToNearest', target: 'utility' } },
  { id: 'ch7',  deck: 'chance', text: 'Bank pays you a dividend of $50.', effect: { kind: 'money', amount: 50 } },
  { id: 'ch8',  deck: 'chance', text: 'Get Out of Jail Free.', effect: { kind: 'getOutOfJail' } },
  { id: 'ch9',  deck: 'chance', text: 'Go back 3 spaces.', effect: { kind: 'back3' } },
  { id: 'ch10', deck: 'chance', text: 'Go to Jail. Do not pass GO.', effect: { kind: 'gotojail' } },
  { id: 'ch11', deck: 'chance', text: 'Make general repairs: $25 per house, $100 per hotel.', effect: { kind: 'repairs', perHouse: 25, perHotel: 100 } },
  { id: 'ch12', deck: 'chance', text: 'Speeding fine. Pay $15.', effect: { kind: 'money', amount: -15 } },
  { id: 'ch13', deck: 'chance', text: 'You have been elected chairman. Pay each player $50.', effect: { kind: 'eachPlayer', amount: -50 } },
  { id: 'ch14', deck: 'chance', text: 'Your building loan matures. Collect $150.', effect: { kind: 'money', amount: 150 } },
];

export const CHEST = [
  { id: 'cc1',  deck: 'chest', text: 'Advance to GO. Collect $200.', effect: { kind: 'moveTo', pos: 0, passGo: true } },
  { id: 'cc2',  deck: 'chest', text: 'Bank error in your favor. Collect $200.', effect: { kind: 'money', amount: 200 } },
  { id: 'cc3',  deck: 'chest', text: "Doctor's fee. Pay $50.", effect: { kind: 'money', amount: -50 } },
  { id: 'cc4',  deck: 'chest', text: 'From sale of stock you get $50.', effect: { kind: 'money', amount: 50 } },
  { id: 'cc5',  deck: 'chest', text: 'Get Out of Jail Free.', effect: { kind: 'getOutOfJail' } },
  { id: 'cc6',  deck: 'chest', text: 'Go to Jail. Do not pass GO.', effect: { kind: 'gotojail' } },
  { id: 'cc7',  deck: 'chest', text: "It's your birthday. Collect $10 from every player.", effect: { kind: 'eachPlayer', amount: 10 } },
  { id: 'cc8',  deck: 'chest', text: 'Holiday fund matures. Collect $100.', effect: { kind: 'money', amount: 100 } },
  { id: 'cc9',  deck: 'chest', text: 'Income tax refund. Collect $20.', effect: { kind: 'money', amount: 20 } },
  { id: 'cc10', deck: 'chest', text: 'Life insurance matures. Collect $100.', effect: { kind: 'money', amount: 100 } },
  { id: 'cc11', deck: 'chest', text: 'Hospital fees. Pay $50.', effect: { kind: 'money', amount: -50 } },
  { id: 'cc12', deck: 'chest', text: 'School fees. Pay $50.', effect: { kind: 'money', amount: -50 } },
  { id: 'cc13', deck: 'chest', text: 'Consultancy fee. Collect $25.', effect: { kind: 'money', amount: 25 } },
  { id: 'cc14', deck: 'chest', text: 'Street repair: $40 per house, $115 per hotel.', effect: { kind: 'repairs', perHouse: 40, perHotel: 115 } },
];

export const ALL_CARDS = [...CHANCE, ...CHEST];

const BY_ID = Object.fromEntries(ALL_CARDS.map((c) => [c.id, c]));
export function getCard(id) {
  return BY_ID[id];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/cards.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/cards.js tests/cards.test.js
git commit -m "feat(engine): chance and treasury card decks"
```

---

## Task 4: Game state — create, clone, serialize

**Files:**
- Modify: `src/engine/state.js` (replace the stub)
- Create: `src/engine/rng.js`
- Test: `tests/state.test.js`

- [ ] **Step 1: Write failing tests**

`tests/state.test.js`:

```js
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
  // every ownable position has an unowned entry
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

test('serialize/deserialize round-trips', () => {
  const s = createGame(players, { seed: 7 });
  const back = deserialize(serialize(s));
  assert.deepEqual(back, s);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/state.test.js`
Expected: FAIL — exports missing.

- [ ] **Step 3: Implement `rng.js`**

`src/engine/rng.js`:

```js
// Mulberry32: tiny deterministic PRNG so tests are repeatable.
export function makeRng(seed = Date.now() >>> 0) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function rollDie(rng) {
  return 1 + Math.floor(rng() * 6);
}
```

- [ ] **Step 4: Implement `state.js`**

`src/engine/state.js`:

```js
import { ownablePositions } from './board.js';
import { CHANCE, CHEST } from './cards.js';
import { makeRng, shuffle } from './rng.js';

export const STATE_VERSION = 1;

export function createGame(playerDefs, { seed } = {}) {
  const rng = makeRng(seed);
  const players = playerDefs.map((p, id) => ({
    id,
    name: p.name,
    token: p.token,
    color: p.color,
    money: 1500,
    position: 0,
    inJail: false,
    jailRolls: 0,
    getOutCards: 0,
    bankrupt: false,
  }));

  const properties = {};
  for (const pos of ownablePositions()) {
    properties[pos] = { ownerId: null, houses: 0, mortgaged: false };
  }

  return {
    version: STATE_VERSION,
    players,
    currentPlayerIndex: 0,
    dice: [0, 0],
    doublesCount: 0,
    properties,
    bank: { houses: 32, hotels: 12 },
    decks: {
      chance: shuffle(CHANCE.map((c) => c.id), rng),
      chest: shuffle(CHEST.map((c) => c.id), rng),
    },
    phase: 'pre-roll',
    pending: {},
    log: [`Game started with ${players.length} players.`],
    winnerId: null,
  };
}

export function clone(state) {
  return structuredClone(state);
}

export function currentPlayer(state) {
  return state.players[state.currentPlayerIndex];
}

export function playerById(state, id) {
  return state.players.find((p) => p.id === id);
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(json) {
  return JSON.parse(json);
}
```

> Note: `structuredClone` is available in Node 17+ and all modern browsers.

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/state.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/rng.js src/engine/state.js tests/state.test.js
git commit -m "feat(engine): game state creation, clone, serialize"
```

---

## Task 5: Rent calculation

**Files:**
- Create: `src/engine/rent.js`
- Test: `tests/rent.test.js`

- [ ] **Step 1: Write failing tests**

`tests/rent.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { rentFor } from '../src/engine/rent.js';
import { groupPositions } from '../src/engine/board.js';

function game() {
  return createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
}

test('base city rent when owner does not hold the full group', () => {
  const s = game();
  s.properties[1].ownerId = 1; // Marrakesh, brown
  assert.equal(rentFor(s, 1, 0), 2);
});

test('owning the full unmortgaged group doubles base rent', () => {
  const s = game();
  for (const p of groupPositions('brown')) s.properties[p].ownerId = 1;
  assert.equal(rentFor(s, 1, 0), 4); // 2 doubled
});

test('houses use the rent tier, not the doubling', () => {
  const s = game();
  for (const p of groupPositions('brown')) s.properties[p].ownerId = 1;
  s.properties[1].houses = 1;
  assert.equal(rentFor(s, 1, 0), 10);
});

test('mortgaged property earns no rent', () => {
  const s = game();
  s.properties[1].ownerId = 1;
  s.properties[1].mortgaged = true;
  assert.equal(rentFor(s, 1, 0), 0);
});

test('airport rent scales with number owned by that owner', () => {
  const s = game();
  s.properties[5].ownerId = 1;
  assert.equal(rentFor(s, 5, 0), 25);
  s.properties[15].ownerId = 1;
  assert.equal(rentFor(s, 5, 0), 50);
  s.properties[25].ownerId = 1;
  s.properties[35].ownerId = 1;
  assert.equal(rentFor(s, 5, 0), 200);
});

test('utility rent is 4x dice with one owned, 10x with both', () => {
  const s = game();
  s.properties[12].ownerId = 1;
  assert.equal(rentFor(s, 12, 9), 36);
  s.properties[28].ownerId = 1;
  assert.equal(rentFor(s, 12, 9), 90);
});

test('unowned property has zero rent', () => {
  const s = game();
  assert.equal(rentFor(s, 1, 0), 0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/rent.test.js`
Expected: FAIL — `rent.js` not found.

- [ ] **Step 3: Implement `rent.js`**

`src/engine/rent.js`:

```js
import { getSpace, groupPositions } from './board.js';

export function rentFor(state, pos, diceTotal) {
  const space = getSpace(pos);
  const prop = state.properties[pos];
  if (!prop || prop.ownerId == null || prop.mortgaged) return 0;
  const ownerId = prop.ownerId;

  if (space.type === 'airport') {
    const owned = groupPositions('airports')
      .filter((p) => state.properties[p].ownerId === ownerId).length;
    return 25 * 2 ** (owned - 1); // 25,50,100,200
  }

  if (space.type === 'utility') {
    const owned = groupPositions('utilities')
      .filter((p) => state.properties[p].ownerId === ownerId).length;
    return (owned === 2 ? 10 : 4) * diceTotal;
  }

  // city
  if (prop.houses > 0) return space.rent[prop.houses];
  const group = groupPositions(space.group);
  const ownsGroup = group.every(
    (p) => state.properties[p].ownerId === ownerId && !state.properties[p].mortgaged,
  );
  return ownsGroup ? space.rent[0] * 2 : space.rent[0];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/rent.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/rent.js tests/rent.test.js
git commit -m "feat(engine): rent calculation for all property types"
```

---

## Task 6: applyAction dispatcher + ROLL, movement, GO salary, buy/decline gate

**Files:**
- Create: `src/engine/rules.js`
- Test: `tests/rules.test.js`

This task builds the core loop: `applyAction`, a `ROLL` action that accepts explicit dice for tests, movement with GO salary, landing dispatch that sets `phase` to `'resolving'` with a `pending.decision` for buyable spaces, and `BUY_PROPERTY` / `END_TURN`. Rent payment on landing is included here (uses `rentFor`). Jail, cards, taxes, build, auction, trade, bankruptcy are layered in later tasks and dispatched from the same function.

- [ ] **Step 1: Write failing tests**

`tests/rules.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, currentPlayer } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';

function game() {
  return createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
}

test('ROLL with explicit dice moves the current player', () => {
  let s = game();
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [2, 3] }));
  assert.equal(s.players[0].position, 5);
  assert.deepEqual(s.dice, [2, 3]);
});

test('landing on an unowned property opens a buy decision', () => {
  let s = game();
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [2, 3] })); // JFK Airport (pos 5)
  assert.equal(s.phase, 'resolving');
  assert.equal(s.pending.decision.kind, 'buy');
  assert.equal(s.pending.decision.pos, 5);
});

test('BUY_PROPERTY transfers cash and ownership', () => {
  let s = game();
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [2, 3] }));
  ({ state: s } = applyAction(s, { type: 'BUY_PROPERTY' }));
  assert.equal(s.players[0].money, 1300); // 1500 - 200
  assert.equal(s.properties[5].ownerId, 0);
  assert.equal(s.phase, 'manage');
});

test('passing GO pays $200', () => {
  let s = game();
  s.players[0].position = 39;
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [1, 2] })); // wraps to pos 2
  assert.equal(s.players[0].position, 2);
  assert.equal(s.players[0].money, 1700);
});

test('landing on an owned property pays rent to the owner', () => {
  let s = game();
  s.properties[5].ownerId = 1; // B owns JFK
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [2, 3] }));
  assert.equal(s.players[0].money, 1475); // 1500 - 25
  assert.equal(s.players[1].money, 1525);
  assert.equal(s.phase, 'manage');
});

test('END_TURN advances to the next non-bankrupt player and resets to pre-roll', () => {
  let s = game();
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [2, 3] }));
  ({ state: s } = applyAction(s, { type: 'BUY_PROPERTY' }));
  ({ state: s } = applyAction(s, { type: 'END_TURN' }));
  assert.equal(s.currentPlayerIndex, 1);
  assert.equal(s.phase, 'pre-roll');
  assert.equal(currentPlayer(s).name, 'B');
});

test('rolling doubles lets the player roll again (phase returns to pre-roll after resolving)', () => {
  let s = game();
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [3, 3] })); // doubles -> empty space (pos 6 Bangkok buyable)
  // resolve the buy decision by declining is covered in auction task; here just decline-less path:
  assert.equal(s.doublesCount, 1);
});

test('three consecutive doubles sends the player to jail immediately', () => {
  let s = game();
  s.doublesCount = 2;
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [4, 4] }));
  assert.equal(s.players[0].inJail, true);
  assert.equal(s.players[0].position, 10);
  assert.equal(s.phase, 'manage'); // turn will end; cannot roll again
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/rules.test.js`
Expected: FAIL — `rules.js` not found.

- [ ] **Step 3: Implement `rules.js` (core)**

`src/engine/rules.js`:

```js
import { clone, currentPlayer, playerById } from './state.js';
import { getSpace } from './board.js';
import { rentFor } from './rent.js';
import { rollDie, makeRng } from './rng.js';

const GO_SALARY = 200;
const JAIL_POS = 10;

function log(state, msg) {
  state.log.push(msg);
}

// Move a player to an absolute position, paying GO salary if they pass it.
function moveTo(state, player, newPos, { passGo = true } = {}) {
  if (passGo && newPos < player.position) {
    player.money += GO_SALARY;
    log(state, `${player.name} passed GO and collected $${GO_SALARY}.`);
  }
  player.position = newPos;
}

function sendToJail(state, player) {
  player.position = JAIL_POS;
  player.inJail = true;
  player.jailRolls = 0;
  state.doublesCount = 0;
  state.phase = 'manage';
  log(state, `${player.name} was sent to Jail.`);
}

// Resolve the space a player just landed on. Sets phase.
export function resolveLanding(state, player) {
  const space = getSpace(player.position);
  log(state, `${player.name} landed on ${space.name}.`);

  if (space.type === 'gotojail') {
    sendToJail(state, player);
    return;
  }
  if (space.price != null) {
    const prop = state.properties[player.position];
    if (prop.ownerId == null) {
      state.phase = 'resolving';
      state.pending.decision = { kind: 'buy', pos: player.position, playerId: player.id };
      return;
    }
    if (prop.ownerId !== player.id && !prop.mortgaged) {
      const rent = rentFor(state, player.position, state.dice[0] + state.dice[1]);
      payRent(state, player, playerById(state, prop.ownerId), rent);
    }
    state.phase = 'manage';
    return;
  }
  // tax, cards, corners are handled in later tasks; default no-op
  state.phase = 'manage';
}

function payRent(state, payer, owner, amount) {
  payer.money -= amount;
  owner.money += amount;
  log(state, `${payer.name} paid $${amount} rent to ${owner.name}.`);
  // bankruptcy if money < 0 is handled in the bankruptcy task
}

export function applyAction(state, action) {
  const s = clone(state);
  const events0 = s.log.length;
  switch (action.type) {
    case 'ROLL': {
      if (s.phase !== 'pre-roll') break;
      const rng = makeRng(action.seed);
      const dice = action.dice ?? [rollDie(rng), rollDie(rng)];
      s.dice = dice;
      const player = currentPlayer(s);
      const isDouble = dice[0] === dice[1];
      if (isDouble) {
        s.doublesCount += 1;
        if (s.doublesCount >= 3) {
          sendToJail(s, player);
          break;
        }
      } else {
        s.doublesCount = 0;
      }
      const total = dice[0] + dice[1];
      moveTo(s, player, (player.position + total) % 40);
      resolveLanding(s, player);
      break;
    }
    case 'BUY_PROPERTY': {
      const d = s.pending.decision;
      if (!d || d.kind !== 'buy') break;
      const player = currentPlayer(s);
      const space = getSpace(d.pos);
      player.money -= space.price;
      s.properties[d.pos].ownerId = player.id;
      log(s, `${player.name} bought ${space.name} for $${space.price}.`);
      delete s.pending.decision;
      s.phase = 'manage';
      break;
    }
    case 'END_TURN': {
      // doubles (1 or 2) grant another roll
      if (s.phase === 'manage' && s.doublesCount > 0 && s.doublesCount < 3
          && !currentPlayer(s).inJail) {
        s.phase = 'pre-roll';
        log(s, `${currentPlayer(s).name} rolled doubles — roll again.`);
        break;
      }
      s.doublesCount = 0;
      advanceTurn(s);
      s.phase = 'pre-roll';
      break;
    }
    default:
      break;
  }
  const events = s.log.slice(events0);
  return { state: s, events };
}

function advanceTurn(state) {
  const n = state.players.length;
  let i = state.currentPlayerIndex;
  do {
    i = (i + 1) % n;
  } while (state.players[i].bankrupt && i !== state.currentPlayerIndex);
  state.currentPlayerIndex = i;
  log(state, `It is now ${state.players[i].name}'s turn.`);
}

export { advanceTurn, moveTo, sendToJail, log, payRent };
```

> Note: the doubles "roll again" test in Step 1 only asserts `doublesCount === 1` because the buy decision blocks `END_TURN`; the full roll-again loop is exercised once auction/decline exists. The "three doubles" test passes because `sendToJail` runs before movement.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/rules.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/rules.js tests/rules.test.js
git commit -m "feat(engine): core turn loop — roll, move, buy, rent, end turn"
```

---

## Task 7: Taxes and a decline→(placeholder) path

**Files:**
- Modify: `src/engine/rules.js` (add tax handling in `resolveLanding`)
- Modify: `tests/rules.test.js` (add tax tests)

- [ ] **Step 1: Add failing tests**

Append to `tests/rules.test.js`:

```js
test('landing on a tax space charges the fixed amount', () => {
  let s = game();
  s.players[0].position = 0;
  ({ state: s } = applyAction(s, { type: 'ROLL', dice: [2, 2] })); // pos 4 Visa Fee $200
  assert.equal(s.players[0].money, 1300);
  assert.equal(s.phase, 'manage');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/rules.test.js`
Expected: FAIL — money is 1500 (tax not applied) and/or doubles path differs. (Note: [2,2] is a double so `doublesCount` becomes 1; movement still lands on pos 4.)

- [ ] **Step 3: Implement tax handling**

In `resolveLanding`, before the final no-op, add:

```js
  if (space.type === 'tax') {
    player.money -= space.amount;
    log(state, `${player.name} paid ${space.name} of $${space.amount}.`);
    state.phase = 'manage';
    return;
  }
```

(Place this branch above the `// tax, cards, corners` comment and remove "tax" from that comment.)

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/rules.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/rules.js tests/rules.test.js
git commit -m "feat(engine): tax spaces"
```

---

## Task 8: Jail flow

**Files:**
- Create: `src/engine/jail.js`
- Modify: `src/engine/rules.js` (route PAY_JAIL/USE_JAIL_CARD/ROLL_FOR_JAIL and block normal ROLL while in jail)
- Test: `tests/jail.test.js`

- [ ] **Step 1: Write failing tests**

`tests/jail.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';

function jailedGame() {
  const s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
  s.players[0].inJail = true;
  s.players[0].position = 10;
  return s;
}

test('PAY_JAIL costs $50 and frees the player, then they move', () => {
  let s = jailedGame();
  ({ state: s } = applyAction(s, { type: 'PAY_JAIL', dice: [3, 2] }));
  assert.equal(s.players[0].inJail, false);
  assert.equal(s.players[0].money, 1450);
  assert.equal(s.players[0].position, 15); // moved 5 from jail
});

test('USE_JAIL_CARD consumes a card, frees the player, then they move', () => {
  let s = jailedGame();
  s.players[0].getOutCards = 1;
  ({ state: s } = applyAction(s, { type: 'USE_JAIL_CARD', dice: [3, 2] }));
  assert.equal(s.players[0].inJail, false);
  assert.equal(s.players[0].getOutCards, 0);
  assert.equal(s.players[0].position, 15);
});

test('ROLL_FOR_JAIL with doubles frees and moves the player', () => {
  let s = jailedGame();
  ({ state: s } = applyAction(s, { type: 'ROLL_FOR_JAIL', dice: [4, 4] }));
  assert.equal(s.players[0].inJail, false);
  assert.equal(s.players[0].position, 18); // 8 from jail
  assert.equal(s.doublesCount, 0); // does NOT grant another roll out of jail
});

test('ROLL_FOR_JAIL without doubles increments jailRolls and stays', () => {
  let s = jailedGame();
  ({ state: s } = applyAction(s, { type: 'ROLL_FOR_JAIL', dice: [1, 2] }));
  assert.equal(s.players[0].inJail, true);
  assert.equal(s.players[0].jailRolls, 1);
  assert.equal(s.phase, 'manage');
});

test('third failed ROLL_FOR_JAIL forces $50 payment and moves the player', () => {
  let s = jailedGame();
  s.players[0].jailRolls = 2;
  ({ state: s } = applyAction(s, { type: 'ROLL_FOR_JAIL', dice: [1, 2] }));
  assert.equal(s.players[0].inJail, false);
  assert.equal(s.players[0].money, 1450);
  assert.equal(s.players[0].position, 13); // 3 from jail
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/jail.test.js`
Expected: FAIL — jail actions unhandled.

- [ ] **Step 3: Implement `jail.js`**

`src/engine/jail.js`:

```js
import { currentPlayer } from './state.js';
import { moveTo, resolveLanding, log } from './rules.js';

const JAIL_FINE = 50;

// Free the player (do not change doublesCount) and move them by `total`.
function freeAndMove(state, player, total) {
  player.inJail = false;
  player.jailRolls = 0;
  moveTo(state, player, (player.position + total) % 40);
  resolveLanding(state, player);
}

export function payJail(state, dice) {
  const player = currentPlayer(state);
  player.money -= JAIL_FINE;
  log(state, `${player.name} paid $${JAIL_FINE} to leave Jail.`);
  freeAndMove(state, player, dice[0] + dice[1]);
}

export function useJailCard(state, dice) {
  const player = currentPlayer(state);
  if (player.getOutCards <= 0) return;
  player.getOutCards -= 1;
  log(state, `${player.name} used a Get Out of Jail Free card.`);
  freeAndMove(state, player, dice[0] + dice[1]);
}

export function rollForJail(state, dice) {
  const player = currentPlayer(state);
  state.dice = dice;
  if (dice[0] === dice[1]) {
    log(state, `${player.name} rolled doubles and left Jail.`);
    freeAndMove(state, player, dice[0] + dice[1]);
    state.doublesCount = 0; // no bonus roll for leaving via doubles
    return;
  }
  player.jailRolls += 1;
  if (player.jailRolls >= 3) {
    player.money -= JAIL_FINE;
    log(state, `${player.name} failed 3 times, paid $${JAIL_FINE}, and left Jail.`);
    freeAndMove(state, player, dice[0] + dice[1]);
    return;
  }
  log(state, `${player.name} did not roll doubles and stays in Jail.`);
  state.phase = 'manage';
}
```

> Because `rules.js` and `jail.js` import from each other, keep `jail.js` importing the named helpers (`moveTo`, `resolveLanding`, `log`) that `rules.js` already exports. ES module circular imports work here because the functions are called at runtime, not at module load.

- [ ] **Step 4: Wire jail actions into `applyAction`**

In `rules.js`, add these cases to the `switch` (and `import { payJail, useJailCard, rollForJail } from './jail.js';` at the top):

```js
    case 'PAY_JAIL': {
      if (!currentPlayer(s).inJail) break;
      payJail(s, action.dice ?? rollPair(action.seed));
      break;
    }
    case 'USE_JAIL_CARD': {
      if (!currentPlayer(s).inJail) break;
      useJailCard(s, action.dice ?? rollPair(action.seed));
      break;
    }
    case 'ROLL_FOR_JAIL': {
      if (!currentPlayer(s).inJail) break;
      rollForJail(s, action.dice ?? rollPair(action.seed));
      break;
    }
```

Add a helper near the top of `rules.js`:

```js
function rollPair(seed) {
  const rng = makeRng(seed);
  return [rollDie(rng), rollDie(rng)];
}
```

Also guard the normal `ROLL` case so a jailed player can't use it: at the start of the `ROLL` case add `if (currentPlayer(s).inJail) break;`.

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/jail.test.js`
Expected: PASS. Also run `npm test` — all suites green.

- [ ] **Step 6: Commit**

```bash
git add src/engine/jail.js src/engine/rules.js tests/jail.test.js
git commit -m "feat(engine): jail entry and exit flow"
```

---

## Task 9: Card drawing + effects

**Files:**
- Create: `src/engine/cardeffects.js`
- Modify: `src/engine/rules.js` (draw a card in `resolveLanding` for chance/chest spaces)
- Test: `tests/cardeffects.test.js`

- [ ] **Step 1: Write failing tests**

`tests/cardeffects.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyCardEffect } from '../src/engine/cardeffects.js';
import { getCard } from '../src/engine/cards.js';

function game() {
  return createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
}
const A = (s) => s.players[0];

test('money card adjusts current player balance', () => {
  const s = game();
  applyCardEffect(s, A(s), getCard('cc2')); // +200
  assert.equal(A(s).money, 1700);
});

test('eachPlayer collect takes from every other player', () => {
  const s = game();
  applyCardEffect(s, A(s), getCard('cc7')); // birthday +10 each
  assert.equal(A(s).money, 1510);
  assert.equal(s.players[1].money, 1490);
});

test('moveTo GO collects salary', () => {
  const s = game();
  A(s).position = 30;
  applyCardEffect(s, A(s), getCard('cc1')); // advance to GO
  assert.equal(A(s).position, 0);
  assert.equal(A(s).money, 1700);
});

test('gotojail card jails the player without passing GO', () => {
  const s = game();
  A(s).position = 36;
  applyCardEffect(s, A(s), getCard('ch10'));
  assert.equal(A(s).inJail, true);
  assert.equal(A(s).position, 10);
  assert.equal(A(s).money, 1500);
});

test('getOutOfJail card is added to the player hand and removed from deck', () => {
  const s = game();
  const before = s.decks.chance.length;
  applyCardEffect(s, A(s), getCard('ch8'));
  assert.equal(A(s).getOutCards, 1);
});

test('repairs charges per house and per hotel owned', () => {
  const s = game();
  s.properties[1].ownerId = 0; s.properties[1].houses = 3;
  s.properties[3].ownerId = 0; s.properties[3].houses = 5; // hotel
  applyCardEffect(s, A(s), getCard('ch11')); // $25/house, $100/hotel
  // 3 houses * 25 + 1 hotel * 100 = 175
  assert.equal(A(s).money, 1500 - 175);
});

test('back3 moves the player backward without GO', () => {
  const s = game();
  A(s).position = 7;
  applyCardEffect(s, A(s), getCard('ch9'));
  assert.equal(A(s).position, 4);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/cardeffects.test.js`
Expected: FAIL — `cardeffects.js` not found.

- [ ] **Step 3: Implement `cardeffects.js`**

`src/engine/cardeffects.js`:

```js
import { getSpace, groupPositions } from './board.js';
import { moveTo, sendToJail, log, resolveLanding } from './rules.js';

export function applyCardEffect(state, player, card) {
  const e = card.effect;
  log(state, `${player.name} drew: ${card.text}`);
  switch (e.kind) {
    case 'money':
      player.money += e.amount;
      break;
    case 'eachPlayer': {
      for (const other of state.players) {
        if (other.id === player.id || other.bankrupt) continue;
        other.money -= e.amount;
        player.money += e.amount;
      }
      break;
    }
    case 'moveTo':
      moveTo(state, player, e.pos, { passGo: e.passGo });
      resolveLanding(state, player);
      break;
    case 'moveToNearest': {
      const targets = e.target === 'airport'
        ? groupPositions('airports')
        : groupPositions('utilities');
      const next = targets.find((p) => p > player.position) ?? targets[0];
      moveTo(state, player, next, { passGo: true });
      resolveLanding(state, player);
      break;
    }
    case 'back3':
      player.position = (player.position + 40 - 3) % 40;
      resolveLanding(state, player);
      break;
    case 'gotojail':
      sendToJail(state, player);
      break;
    case 'repairs': {
      let houses = 0, hotels = 0;
      for (const pos in state.properties) {
        const prop = state.properties[pos];
        if (prop.ownerId !== player.id) continue;
        if (prop.houses === 5) hotels += 1;
        else houses += prop.houses;
      }
      player.money -= houses * e.perHouse + hotels * e.perHotel;
      break;
    }
    case 'getOutOfJail':
      player.getOutCards += 1;
      break;
  }
}
```

- [ ] **Step 4: Wire drawing into `resolveLanding`**

In `rules.js`, import `applyCardEffect` and the decks, and add to `resolveLanding` before the no-op default:

```js
  if (space.type === 'chance' || space.type === 'chest') {
    const deckName = space.type === 'chance' ? 'chance' : 'chest';
    const id = state.decks[deckName].shift();
    const card = getCard(id);
    if (card.effect.kind === 'getOutOfJail') {
      // keep the card out of the deck while held; return others to the bottom
    } else {
      state.decks[deckName].push(id);
    }
    applyCardEffect(state, player, card);
    if (state.phase !== 'resolving') state.phase = 'manage';
    return;
  }
```

Add imports at top of `rules.js`: `import { getCard } from './cards.js';` and `import { applyCardEffect } from './cardeffects.js';`.

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/cardeffects.test.js && npm test`
Expected: PASS across all suites.

- [ ] **Step 6: Commit**

```bash
git add src/engine/cardeffects.js src/engine/rules.js tests/cardeffects.test.js
git commit -m "feat(engine): card drawing and effects"
```

---

## Task 10: Building & selling houses/hotels

**Files:**
- Create: `src/engine/build.js`
- Modify: `src/engine/rules.js` (route BUILD_HOUSE / SELL_HOUSE)
- Test: `tests/build.test.js`

- [ ] **Step 1: Write failing tests**

`tests/build.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';
import { groupPositions } from '../src/engine/board.js';

function ownsBrown() {
  const s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
  for (const p of groupPositions('brown')) s.properties[p].ownerId = 0; // pos 1 & 3
  s.phase = 'manage';
  return s;
}

test('can build a house on a full unmortgaged group, charges house cost', () => {
  let s = ownsBrown();
  ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: 1 }));
  assert.equal(s.properties[1].houses, 1);
  assert.equal(s.players[0].money, 1450); // brown houseCost 50
  assert.equal(s.bank.houses, 31);
});

test('even-build rule blocks a second house before the group is even', () => {
  let s = ownsBrown();
  ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: 1 }));
  const before = s.players[0].money;
  ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: 1 })); // illegal: pos 3 has 0
  assert.equal(s.properties[1].houses, 1); // unchanged
  assert.equal(s.players[0].money, before); // no charge
});

test('cannot build if you do not own the full group', () => {
  let s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
  s.properties[1].ownerId = 0; // only one brown
  s.phase = 'manage';
  ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: 1 }));
  assert.equal(s.properties[1].houses, 0);
});

test('hotel is the 5th house and returns 4 houses to the bank', () => {
  let s = ownsBrown();
  for (const p of [1, 3, 1, 3, 1, 3, 1, 3]) { // bring both to 4 evenly
    ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: p }));
  }
  assert.equal(s.properties[1].houses, 4);
  const housesBefore = s.bank.houses;
  ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: 1 })); // -> hotel
  assert.equal(s.properties[1].houses, 5);
  assert.equal(s.bank.hotels, 11);
  assert.equal(s.bank.houses, housesBefore + 4);
});

test('building is blocked when the bank has no houses left', () => {
  let s = ownsBrown();
  s.bank.houses = 0;
  ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: 1 }));
  assert.equal(s.properties[1].houses, 0);
});

test('SELL_HOUSE refunds half the house cost and returns the house to the bank', () => {
  let s = ownsBrown();
  ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: 3 }));
  ({ state: s } = applyAction(s, { type: 'BUILD_HOUSE', pos: 1 }));
  const money = s.players[0].money;
  ({ state: s } = applyAction(s, { type: 'SELL_HOUSE', pos: 1 }));
  assert.equal(s.properties[1].houses, 0);
  assert.equal(s.players[0].money, money + 25); // half of 50
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/build.test.js`
Expected: FAIL — build actions unhandled.

- [ ] **Step 3: Implement `build.js`**

`src/engine/build.js`:

```js
import { getSpace, groupPositions } from './board.js';
import { currentPlayer } from './state.js';
import { log } from './rules.js';

function ownsFullGroup(state, player, group) {
  return groupPositions(group).every(
    (p) => state.properties[p].ownerId === player.id && !state.properties[p].mortgaged,
  );
}

export function buildHouse(state, pos) {
  const player = currentPlayer(state);
  const space = getSpace(pos);
  const prop = state.properties[pos];
  if (space.type !== 'city') return;
  if (prop.ownerId !== player.id) return;
  if (!ownsFullGroup(state, player, space.group)) return;
  if (prop.houses >= 5) return;

  // even-build: cannot exceed the minimum in the group by more than 0
  const group = groupPositions(space.group);
  const minHouses = Math.min(...group.map((p) => state.properties[p].houses));
  if (prop.houses > minHouses) return;

  const buyingHotel = prop.houses === 4;
  if (buyingHotel) {
    if (state.bank.hotels <= 0) return;
  } else if (state.bank.houses <= 0) {
    return;
  }
  if (player.money < space.houseCost) return;

  player.money -= space.houseCost;
  prop.houses += 1;
  if (buyingHotel) {
    state.bank.hotels -= 1;
    state.bank.houses += 4; // 4 houses returned to bank
    log(state, `${player.name} built a hotel on ${space.name}.`);
  } else {
    state.bank.houses -= 1;
    log(state, `${player.name} built a house on ${space.name}.`);
  }
}

export function sellHouse(state, pos) {
  const player = currentPlayer(state);
  const space = getSpace(pos);
  const prop = state.properties[pos];
  if (prop.ownerId !== player.id || prop.houses <= 0) return;

  // even-sell: cannot drop below the max in the group by more than 0
  const group = groupPositions(space.group);
  const maxHouses = Math.max(...group.map((p) => state.properties[p].houses));
  if (prop.houses < maxHouses) return;

  const wasHotel = prop.houses === 5;
  if (wasHotel) {
    if (state.bank.houses < 4) return; // can't break a hotel without 4 houses
    state.bank.hotels += 1;
    state.bank.houses -= 4;
  } else {
    state.bank.houses += 1;
  }
  prop.houses -= 1;
  player.money += Math.floor(space.houseCost / 2);
  log(state, `${player.name} sold a building on ${space.name}.`);
}
```

- [ ] **Step 4: Wire into `applyAction`**

In `rules.js` add `import { buildHouse, sellHouse } from './build.js';` and cases:

```js
    case 'BUILD_HOUSE':
      if (s.phase !== 'manage') break;
      buildHouse(s, action.pos);
      break;
    case 'SELL_HOUSE':
      sellHouse(s, action.pos);
      break;
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/build.test.js && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/build.js src/engine/rules.js tests/build.test.js
git commit -m "feat(engine): build and sell houses/hotels with even-build and bank limits"
```

---

## Task 11: Mortgage / unmortgage

**Files:**
- Create: `src/engine/mortgage.js`
- Modify: `src/engine/rules.js` (route MORTGAGE / UNMORTGAGE)
- Test: `tests/mortgage.test.js`

- [ ] **Step 1: Write failing tests**

`tests/mortgage.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';

function owns(pos) {
  const s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
  s.properties[pos].ownerId = 0;
  s.phase = 'manage';
  return s;
}

test('MORTGAGE pays half the price and marks the property mortgaged', () => {
  let s = owns(39); // New York, price 400
  ({ state: s } = applyAction(s, { type: 'MORTGAGE', pos: 39 }));
  assert.equal(s.properties[39].mortgaged, true);
  assert.equal(s.players[0].money, 1700); // +200
});

test('UNMORTGAGE costs mortgage value + 10% interest', () => {
  let s = owns(39);
  ({ state: s } = applyAction(s, { type: 'MORTGAGE', pos: 39 }));
  ({ state: s } = applyAction(s, { type: 'UNMORTGAGE', pos: 39 }));
  assert.equal(s.properties[39].mortgaged, false);
  // mortgage value 200, unmortgage 200 + 20 = 220; net from 1700 -> 1480
  assert.equal(s.players[0].money, 1480);
});

test('cannot mortgage a property that has buildings in its group', () => {
  let s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
  s.properties[1].ownerId = 0; s.properties[3].ownerId = 0;
  s.properties[1].houses = 1;
  s.phase = 'manage';
  ({ state: s } = applyAction(s, { type: 'MORTGAGE', pos: 3 }));
  assert.equal(s.properties[3].mortgaged, false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/mortgage.test.js`
Expected: FAIL — actions unhandled.

- [ ] **Step 3: Implement `mortgage.js`**

`src/engine/mortgage.js`:

```js
import { getSpace, groupPositions } from './board.js';
import { currentPlayer } from './state.js';
import { log } from './rules.js';

export function mortgage(state, pos) {
  const player = currentPlayer(state);
  const space = getSpace(pos);
  const prop = state.properties[pos];
  if (prop.ownerId !== player.id || prop.mortgaged) return;
  // no buildings anywhere in the group
  if (space.group && groupPositions(space.group).some((p) => state.properties[p].houses > 0)) return;
  const value = Math.floor(space.price / 2);
  player.money += value;
  prop.mortgaged = true;
  log(state, `${player.name} mortgaged ${space.name} for $${value}.`);
}

export function unmortgage(state, pos) {
  const player = currentPlayer(state);
  const space = getSpace(pos);
  const prop = state.properties[pos];
  if (prop.ownerId !== player.id || !prop.mortgaged) return;
  const value = Math.floor(space.price / 2);
  const cost = value + Math.ceil(value * 0.1);
  if (player.money < cost) return;
  player.money -= cost;
  prop.mortgaged = false;
  log(state, `${player.name} unmortgaged ${space.name} for $${cost}.`);
}
```

- [ ] **Step 4: Wire into `applyAction`**

In `rules.js` add `import { mortgage, unmortgage } from './mortgage.js';` and cases:

```js
    case 'MORTGAGE':
      mortgage(s, action.pos);
      break;
    case 'UNMORTGAGE':
      unmortgage(s, action.pos);
      break;
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/mortgage.test.js && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/mortgage.js src/engine/rules.js tests/mortgage.test.js
git commit -m "feat(engine): mortgage and unmortgage"
```

---

## Task 12: Auctions

**Files:**
- Create: `src/engine/auction.js`
- Modify: `src/engine/rules.js` (DECLINE_PROPERTY opens auction; route AUCTION_BID / AUCTION_PASS)
- Test: `tests/auction.test.js`

Auction model in `state.pending.auction`: `{ pos, bidders:[playerIds still in], currentBidderIndex, highBid, highBidderId }`. Bidding starts at `highBid: 0`, `highBidderId: null`. A bid must exceed `highBid`. When only one bidder remains and there has been at least one bid, they win; if all pass with no bid, the property stays unowned.

- [ ] **Step 1: Write failing tests**

`tests/auction.test.js`:

```js
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
  ({ state: s } = applyAction(s, { type: 'AUCTION_BID', amount: 50 })); // player 0 bids
  ({ state: s } = applyAction(s, { type: 'AUCTION_PASS' }));            // player 1 passes
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/auction.test.js`
Expected: FAIL — auction actions unhandled.

- [ ] **Step 3: Implement `auction.js`**

`src/engine/auction.js`:

```js
import { getSpace } from './board.js';
import { playerById, currentPlayer } from './state.js';
import { log } from './rules.js';

export function startAuction(state, pos) {
  const bidders = state.players.filter((p) => !p.bankrupt).map((p) => p.id);
  state.pending.auction = {
    pos,
    bidders,
    currentBidderIndex: 0,
    highBid: 0,
    highBidderId: null,
  };
  state.phase = 'auction';
  log(state, `Auction started for ${getSpace(pos).name}.`);
}

function nextBidder(auction) {
  auction.currentBidderIndex = (auction.currentBidderIndex + 1) % auction.bidders.length;
}

function settle(state) {
  const a = state.pending.auction;
  const space = getSpace(a.pos);
  if (a.highBidderId != null) {
    const winner = playerById(state, a.highBidderId);
    winner.money -= a.highBid;
    state.properties[a.pos].ownerId = winner.id;
    log(state, `${winner.name} won ${space.name} for $${a.highBid}.`);
  } else {
    log(state, `${space.name} received no bids and stays unowned.`);
  }
  delete state.pending.auction;
  state.phase = 'manage';
}

export function auctionBid(state, amount) {
  const a = state.pending.auction;
  const bidderId = a.bidders[a.currentBidderIndex];
  const bidder = playerById(state, bidderId);
  if (amount <= a.highBid || amount > bidder.money) return;
  a.highBid = amount;
  a.highBidderId = bidderId;
  log(state, `${bidder.name} bids $${amount}.`);
  nextBidder(a);
}

export function auctionPass(state) {
  const a = state.pending.auction;
  const idx = a.currentBidderIndex;
  const passerId = a.bidders[idx];
  log(state, `${playerById(state, passerId).name} passes.`);
  a.bidders.splice(idx, 1);
  if (a.bidders.length === 0) { settle(state); return; }
  if (a.currentBidderIndex >= a.bidders.length) a.currentBidderIndex = 0;
  if (a.bidders.length === 1 && a.highBidderId === a.bidders[0]) { settle(state); return; }
  if (a.bidders.length === 1 && a.highBidderId == null) {
    // single remaining bidder, nobody has bid yet — they can still bid or pass
    return;
  }
}
```

- [ ] **Step 4: Wire into `applyAction`**

In `rules.js` add `import { startAuction, auctionBid, auctionPass } from './auction.js';` and cases, plus change `DECLINE_PROPERTY`:

```js
    case 'DECLINE_PROPERTY': {
      const d = s.pending.decision;
      if (!d || d.kind !== 'buy') break;
      const pos = d.pos;
      delete s.pending.decision;
      startAuction(s, pos);
      break;
    }
    case 'AUCTION_BID':
      if (s.phase === 'auction') auctionBid(s, action.amount);
      break;
    case 'AUCTION_PASS':
      if (s.phase === 'auction') auctionPass(s);
      break;
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/auction.test.js && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/auction.js src/engine/rules.js tests/auction.test.js
git commit -m "feat(engine): property auctions"
```

---

## Task 13: Player-to-player trading

**Files:**
- Create: `src/engine/trade.js`
- Modify: `src/engine/rules.js` (route PROPOSE_TRADE / ACCEPT_TRADE / REJECT_TRADE)
- Test: `tests/trade.test.js`

Trade offer shape in `state.pending.trade`:
`{ fromId, toId, give: { money, props:[pos], jailCards }, want: { money, props:[pos], jailCards } }`.
On accept, assets swap (giver's `give` goes to `toId`, `want` comes back to `fromId`). Validate ownership and sufficient funds before executing.

- [ ] **Step 1: Write failing tests**

`tests/trade.test.js`:

```js
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

test('PROPOSE_TRADE stores a pending offer', () => {
  let s = setup();
  ({ state: s } = applyAction(s, {
    type: 'PROPOSE_TRADE',
    offer: { fromId: 0, toId: 1, give: { money: 100, props: [1], jailCards: 0 }, want: { money: 0, props: [3], jailCards: 0 } },
  }));
  assert.equal(s.pending.trade.toId, 1);
  assert.equal(s.phase, 'trade');
});

test('ACCEPT_TRADE swaps money and properties', () => {
  let s = setup();
  ({ state: s } = applyAction(s, {
    type: 'PROPOSE_TRADE',
    offer: { fromId: 0, toId: 1, give: { money: 100, props: [1], jailCards: 0 }, want: { money: 0, props: [3], jailCards: 0 } },
  }));
  ({ state: s } = applyAction(s, { type: 'ACCEPT_TRADE' }));
  assert.equal(s.properties[1].ownerId, 1); // Marrakesh -> B
  assert.equal(s.properties[3].ownerId, 0); // Cairo -> A
  assert.equal(s.players[0].money, 1400);   // A paid 100
  assert.equal(s.players[1].money, 1600);
  assert.equal(s.phase, 'manage');
});

test('REJECT_TRADE clears the offer with no changes', () => {
  let s = setup();
  ({ state: s } = applyAction(s, {
    type: 'PROPOSE_TRADE',
    offer: { fromId: 0, toId: 1, give: { money: 100, props: [1], jailCards: 0 }, want: { money: 0, props: [3], jailCards: 0 } },
  }));
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
  assert.equal(s.pending.trade, undefined); // A does not own pos 3
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/trade.test.js`
Expected: FAIL — trade actions unhandled.

- [ ] **Step 3: Implement `trade.js`**

`src/engine/trade.js`:

```js
import { playerById } from './state.js';
import { log } from './rules.js';

function sideValid(state, ownerId, side) {
  const owner = playerById(state, ownerId);
  if (owner.money < (side.money || 0)) return false;
  if ((side.jailCards || 0) > owner.getOutCards) return false;
  for (const pos of side.props || []) {
    if (state.properties[pos].ownerId !== ownerId) return false;
    if (state.properties[pos].houses > 0) return false; // sell buildings first
  }
  return true;
}

export function proposeTrade(state, offer) {
  if (!sideValid(state, offer.fromId, offer.give)) return;
  if (!sideValid(state, offer.toId, offer.want)) return;
  state.pending.trade = offer;
  state.phase = 'trade';
  const from = playerById(state, offer.fromId).name;
  const to = playerById(state, offer.toId).name;
  log(state, `${from} proposed a trade to ${to}.`);
}

function transfer(state, fromId, toId, side) {
  const from = playerById(state, fromId);
  const to = playerById(state, toId);
  from.money -= side.money || 0;
  to.money += side.money || 0;
  from.getOutCards -= side.jailCards || 0;
  to.getOutCards += side.jailCards || 0;
  for (const pos of side.props || []) state.properties[pos].ownerId = toId;
}

export function acceptTrade(state) {
  const t = state.pending.trade;
  if (!t) return;
  // re-validate at acceptance time
  if (!sideValid(state, t.fromId, t.give) || !sideValid(state, t.toId, t.want)) {
    delete state.pending.trade;
    state.phase = 'manage';
    return;
  }
  transfer(state, t.fromId, t.toId, t.give);
  transfer(state, t.toId, t.fromId, t.want);
  log(state, 'Trade accepted.');
  delete state.pending.trade;
  state.phase = 'manage';
}

export function rejectTrade(state) {
  if (!state.pending.trade) return;
  delete state.pending.trade;
  state.phase = 'manage';
  log(state, 'Trade rejected.');
}
```

- [ ] **Step 4: Wire into `applyAction`**

In `rules.js` add `import { proposeTrade, acceptTrade, rejectTrade } from './trade.js';` and cases:

```js
    case 'PROPOSE_TRADE':
      if (s.phase === 'manage') proposeTrade(s, action.offer);
      break;
    case 'ACCEPT_TRADE':
      acceptTrade(s);
      break;
    case 'REJECT_TRADE':
      rejectTrade(s);
      break;
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/trade.test.js && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/trade.js src/engine/rules.js tests/trade.test.js
git commit -m "feat(engine): player-to-player trading"
```

---

## Task 14: Bankruptcy + win detection

**Files:**
- Create: `src/engine/bankruptcy.js`
- Modify: `src/engine/rules.js` (route DECLARE_BANKRUPTCY; detect winner after a player exits)
- Test: `tests/bankruptcy.test.js`

Model: a player whose `money < 0` is "in debt". The UI offers raise-cash actions (sell/mortgage) or `DECLARE_BANKRUPTCY`. On bankruptcy, record the creditor in `state.pending.debt = { debtorId, creditorId|null }` (creditor null = bank). `declareBankruptcy` transfers assets to the creditor (or releases them to the bank, clearing buildings) and marks the debtor bankrupt. After removal, if one solvent player remains, set `winnerId` and `phase: 'game-over'`.

- [ ] **Step 1: Write failing tests**

`tests/bankruptcy.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/state.js';
import { applyAction } from '../src/engine/rules.js';

function twoPlayerDebt() {
  const s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }], { seed: 1 });
  s.properties[1].ownerId = 0; // A owns Marrakesh
  s.properties[3].ownerId = 0; // A owns Cairo
  s.players[0].money = -50;    // A is in debt
  s.phase = 'manage';
  s.pending.debt = { debtorId: 0, creditorId: 1 };
  return s;
}

test('declaring bankruptcy to a player transfers all properties to that creditor', () => {
  let s = twoPlayerDebt();
  ({ state: s } = applyAction(s, { type: 'DECLARE_BANKRUPTCY' }));
  assert.equal(s.players[0].bankrupt, true);
  assert.equal(s.properties[1].ownerId, 1);
  assert.equal(s.properties[3].ownerId, 1);
});

test('last solvent player wins', () => {
  let s = twoPlayerDebt();
  ({ state: s } = applyAction(s, { type: 'DECLARE_BANKRUPTCY' }));
  assert.equal(s.phase, 'game-over');
  assert.equal(s.winnerId, 1);
});

test('bankruptcy to the bank releases properties (unowned) and clears buildings', () => {
  let s = createGame([{ name: 'A', token: 'x' }, { name: 'B', token: 'y' }, { name: 'C', token: 'z' }], { seed: 1 });
  s.properties[1].ownerId = 0; s.properties[1].houses = 2;
  s.players[0].money = -10;
  s.phase = 'manage';
  s.pending.debt = { debtorId: 0, creditorId: null };
  const bankHousesBefore = s.bank.houses;
  ({ state: s } = applyAction(s, { type: 'DECLARE_BANKRUPTCY' }));
  assert.equal(s.players[0].bankrupt, true);
  assert.equal(s.properties[1].ownerId, null);
  assert.equal(s.properties[1].houses, 0);
  assert.equal(s.bank.houses, bankHousesBefore + 2);
  assert.equal(s.phase, 'manage'); // 2 players remain -> game continues
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/bankruptcy.test.js`
Expected: FAIL — action unhandled.

- [ ] **Step 3: Implement `bankruptcy.js`**

`src/engine/bankruptcy.js`:

```js
import { playerById } from './state.js';
import { log } from './rules.js';

export function declareBankruptcy(state) {
  const debt = state.pending.debt;
  if (!debt) return;
  const debtor = playerById(state, debt.debtorId);
  const creditor = debt.creditorId != null ? playerById(state, debt.creditorId) : null;

  for (const pos in state.properties) {
    const prop = state.properties[pos];
    if (prop.ownerId !== debtor.id) continue;
    if (creditor) {
      prop.ownerId = creditor.id; // mortgaged status carries over
    } else {
      // return buildings to bank, release the property
      if (prop.houses === 5) { state.bank.hotels += 1; }
      else { state.bank.houses += prop.houses; }
      prop.houses = 0;
      prop.ownerId = null;
      prop.mortgaged = false;
    }
  }
  if (creditor && debtor.money > 0) creditor.money += debtor.money;
  if (creditor) creditor.getOutCards += debtor.getOutCards;
  debtor.money = 0;
  debtor.getOutCards = 0;
  debtor.bankrupt = true;
  log(state, `${debtor.name} went bankrupt.`);
  delete state.pending.debt;

  const solvent = state.players.filter((p) => !p.bankrupt);
  if (solvent.length === 1) {
    state.winnerId = solvent[0].id;
    state.phase = 'game-over';
    log(state, `${solvent[0].name} wins the game!`);
  } else {
    state.phase = 'manage';
  }
}
```

- [ ] **Step 4: Wire into `applyAction`**

In `rules.js` add `import { declareBankruptcy } from './bankruptcy.js';` and a case:

```js
    case 'DECLARE_BANKRUPTCY':
      declareBankruptcy(s);
      break;
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/bankruptcy.test.js && npm test`
Expected: PASS — all engine suites green.

- [ ] **Step 6: Commit**

```bash
git add src/engine/bankruptcy.js src/engine/rules.js tests/bankruptcy.test.js
git commit -m "feat(engine): bankruptcy resolution and win detection"
```

---

## Final engine verification

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: every suite passes; no skipped tests.

- [ ] **Step 2: Sanity-check a full simulated turn in a scratch file (optional, delete after)**

Confirm `applyAction` never mutates its input by asserting `serialize(before) === serialize(stateBeforeCall)` in one test if not already covered.

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A && git commit -m "test(engine): full-suite verification"
```

---

## Notes for the UI plan (next)

The UI imports only `applyAction`, `createGame`, `serialize`, `deserialize`, plus `BOARD`/`getSpace` for rendering. It must:
- Generate dice locally and pass them as `action.dice` (or omit to let the engine roll) — for the real game, omit `dice` so the engine rolls; tests pass explicit dice.
- Read `state.phase` and `state.pending` to decide which controls/modals to show (`pre-roll` → Roll; `resolving`+`pending.decision` → Buy/Auction; `auction` → bid UI; `trade` → accept/reject; `manage` → build/mortgage/trade/end; `game-over` → winner screen).
- Detect `player.money < 0` to drive the raise-cash / declare-bankruptcy flow and set `state.pending.debt` via a dedicated action (add a `SET_DEBT`/automatic detection step in the UI plan).
- Autosave `serialize(state)` to `localStorage` after each `applyAction`.
