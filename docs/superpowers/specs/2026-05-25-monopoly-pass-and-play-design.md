# World Monopoly — Pass & Play — Design

**Date:** 2026-05-25
**For:** Pravar (HTML beginner) · GitHub `pravarzawar13`

## Purpose

An offline, single-device **pass-and-play** Monopoly game with **full classic
rules**, a **world-cities** theme, and a **vintage** look. Players pass one
device around the table. Built as vanilla HTML/CSS/JS (ES modules, no build
step) so it runs fully offline and deploys to GitHub Pages.

## Success criteria

- 2–6 players can play a complete game of classic Monopoly on one device:
  buy/auction, rent, build, mortgage, trade, jail, cards, taxes, bankruptcy,
  and a winner.
- The rules engine is pure (no DOM) and covered by unit tests that pass with
  `node --test`.
- A game in progress auto-saves and resumes after closing/reopening the tab.
- Works as a static site on GitHub Pages with no build step; plays offline.

## Architecture

Two clearly separated layers:

1. **Engine** (`src/engine/`) — pure functions, **no DOM, no globals**. The
   core is a reducer: `applyAction(state, action) -> { state, events }`. Given
   current state and an action, it returns the next state plus a list of
   human-readable event strings (for the log). Pure functions make the tricky
   rules unit-testable and make phase-2 networking feasible (the engine can run
   unchanged on a host/server).
2. **UI** (`src/ui/`) — reads state and renders the screen; never computes
   rules. On a user gesture it builds an action, calls `applyAction`,
   re-renders from the new state, appends events to the log, and autosaves.

Data flow:

```
user gesture (click) → action object
  → applyAction(state, action) → { nextState, events }
  → state = nextState
  → render(state) ; appendLog(events) ; saveToLocalStorage(state)
```

## The board (40 spaces)

Classic Monopoly positions, prices, and rents (proven balance), re-themed to
world cities. Position 0 = GO, increasing clockwise.

| Pos | Space | Type | Group | Price | Notes |
|----:|-------|------|-------|------:|-------|
| 0 | GO | corner | — | — | Collect $200 when passing/landing |
| 1 | Marrakesh | city | brown | 60 | |
| 2 | Treasury 💰 | chest | — | — | Community Chest |
| 3 | Cairo | city | brown | 60 | |
| 4 | Visa Fee | tax | — | — | Pay $200 |
| 5 | JFK Airport | airport | airports | 200 | |
| 6 | Bangkok | city | lightblue | 100 | |
| 7 | Travel ✈️ | chance | — | — | Chance |
| 8 | Hanoi | city | lightblue | 100 | |
| 9 | Jakarta | city | lightblue | 120 | |
| 10 | Jail / Just Visiting | corner | — | — | |
| 11 | Istanbul | city | pink | 140 | |
| 12 | Global Power Grid | utility | utilities | 150 | |
| 13 | Athens | city | pink | 140 | |
| 14 | Cape Town | city | pink | 160 | |
| 15 | Heathrow Airport | airport | airports | 200 | |
| 16 | Lisbon | city | orange | 180 | |
| 17 | Treasury 💰 | chest | — | — | |
| 18 | Dublin | city | orange | 180 | |
| 19 | Vienna | city | orange | 200 | |
| 20 | Free Parking | corner | — | — | No jackpot (standard rules) |
| 21 | Berlin | city | red | 220 | |
| 22 | Travel ✈️ | chance | — | — | |
| 23 | Rome | city | red | 220 | |
| 24 | Madrid | city | red | 240 | |
| 25 | Changi Airport | airport | airports | 200 | |
| 26 | Toronto | city | yellow | 260 | |
| 27 | Sydney | city | yellow | 260 | |
| 28 | World Water Co. | utility | utilities | 150 | |
| 29 | Dubai | city | yellow | 280 | |
| 30 | Go To Jail | corner | — | — | Go directly to jail |
| 31 | Singapore | city | green | 300 | |
| 32 | Paris | city | green | 300 | |
| 33 | Treasury 💰 | chest | — | — | |
| 34 | Hong Kong | city | green | 320 | |
| 35 | Dubai Int'l Airport | airport | airports | 200 | |
| 36 | Travel ✈️ | chance | — | — | |
| 37 | London | city | darkblue | 350 | |
| 38 | Departure Tax | tax | — | — | Pay $100 |
| 39 | New York | city | darkblue | 400 | |

### Rent tables (classic values, by group)

Each city stores `rent[0..5]` = [base, 1 house, 2, 3, 4, hotel] and a
`houseCost`. Examples (classic):

- Marrakesh/Cairo (brown, houseCost 50): rent [2,10,30,90,160,250]; Cairo
  [4,20,60,180,320,450].
- Standard classic numbers are used for every property; the full table lives in
  `board.js` as data.
- **Monopoly bonus:** if a player owns a full color group and none are
  mortgaged, base rent (0 houses) is **doubled**.
- **Airports:** rent by count owned = $25 / $50 / $100 / $200 (1/2/3/4).
- **Utilities:** if one owned, rent = 4 × dice roll; if both, 10 × dice roll.
- **Mortgaged** property collects no rent.

## Cards

Two decks, drawn from the top, returned to the bottom (a held "Get Out of Jail
Free" card is removed from the deck until used/returned). Effects supported:

- **Move:** advance to a named space (collect $200 if passing GO); advance to
  nearest airport/utility (pay special rent if owned); go back 3 spaces; go to
  jail (no GO).
- **Money:** collect/pay a fixed amount; collect from / pay each player;
  **street repairs** (pay per house and per hotel owned).
- **Get Out of Jail Free:** held by the player until used or traded.

Decks contain the classic card set (16 each), trimmed/adapted to the effects
above. Card text is themed (travel/treasury) but mechanics are classic.

## Turn flow (full classic)

1. **Start of turn.** If the player is in jail, offer: pay $50, use a Get Out
   of Jail Free card, or roll for doubles (up to 3 turns; on the 3rd failed
   try, pay $50 and move by that roll).
2. **Roll.** Two dice. Doubles → after resolving the landing, roll again.
   **Three consecutive doubles → go straight to jail**, turn ends.
3. **Move** clockwise; passing/landing on GO pays $200. Resolve the space:
   - **Unowned city/airport/utility:** buy at list price, or **decline →
     auction** (all non-bankrupt players bid; bidding may start below price;
     highest bid buys; if all pass, it stays unowned).
   - **Owned by another, not mortgaged:** pay rent (per tables above).
   - **Owned by self, or mortgaged:** nothing.
   - **Tax:** pay the fixed amount.
   - **Chance / Community Chest:** draw and apply.
   - **Go To Jail:** go to jail, do not pass GO. **Free Parking / Just
     Visiting:** nothing.
4. **Manage (any time during own turn, including before rolling for builds):**
   build/sell houses & hotels, mortgage/unmortgage, and **propose trades**.
5. **End turn** (only when not owing money and not mid-extra-roll).

## Building, mortgaging, bankruptcy

- **Build** only on a full unmortgaged color group, **evenly** (no second house
  on a property until every property in the group has one). Hotel = 5th house;
  buying a hotel returns its 4 houses to the bank.
- **Bank limits:** 32 houses and 12 hotels total. If the bank is out, building
  is blocked. Selling returns buildings to the bank at half cost.
- **Mortgage** value = ½ price; collects no rent while mortgaged.
  **Unmortgage** = mortgage value + 10% interest. Can't mortgage a property
  that still has buildings in its group.
- **Bankruptcy:** if a player owes more than they can pay, they may raise cash
  (sell buildings, mortgage, trade) or **declare bankruptcy**. Debt to another
  player → all assets transfer to that creditor (mortgaged properties included;
  creditor may pay off interest). Debt to the bank → buildings sold to bank and
  properties **auctioned**. Last solvent player wins.

## State shape (sketch)

```js
{
  version: 1,
  players: [{ id, name, token, color, money, position,
              inJail, jailRolls, getOutCards, bankrupt }],
  currentPlayerIndex,
  dice: [d1, d2],
  doublesCount,
  properties: { [pos]: { ownerId|null, houses /*0..5, 5=hotel*/, mortgaged } },
  bank: { houses: 32, hotels: 12 },
  decks: { chance: [...ids], chest: [...ids] }, // order = draw pile
  phase: 'setup'|'pre-roll'|'resolving'|'manage'|'auction'|'trade'|'game-over',
  pending: { auction?: {...}, trade?: {...}, debt?: {...} },
  log: [ ...strings ],
  winnerId: null
}
```

## Actions (engine API)

`ROLL`, `BUY_PROPERTY`, `DECLINE_PROPERTY` (→ auction), `AUCTION_BID`,
`AUCTION_PASS`, `BUILD_HOUSE`, `SELL_HOUSE`, `MORTGAGE`, `UNMORTGAGE`,
`PROPOSE_TRADE`, `ACCEPT_TRADE`, `REJECT_TRADE`, `PAY_JAIL`, `USE_JAIL_CARD`,
`ROLL_FOR_JAIL`, `DRAW_CARD` (auto on landing), `END_TURN`,
`DECLARE_BANKRUPTCY`. Each returns `{ state, events }`; invalid actions return
state unchanged with an explanatory event.

## Screens & UX

- **Setup:** choose 2–6 players; each gets a name, a travel token
  (✈️ 🚢 🚗 🚂 🧳 ⛵), and a color. "Resume" appears if a save exists.
- **Game (responsive):** wide screens use board-left + side panel
  (players/money, dice + context actions, log); narrow screens stack the board
  on top with a sticky bottom action bar and a details drawer.
- **Modals:** buy prompt, auction, trade builder, build/mortgage manager, card
  popup, bankruptcy/raise-cash flow, game-over.
- **Vintage style:** cream board, deep reds/greens, serif headings, classic
  bordered property tiles and color bands.

## Files

```
index.html
styles.css                     vintage theme tokens + responsive layout
src/engine/
  board.js                     40-space board data (cities, prices, rent tables)
  cards.js                     chance + chest decks and effect definitions
  state.js                     createGame(), serialize/deserialize, helpers
  rules.js                     applyAction core: roll, move, rent, buy, build,
                               mortgage, jail, tax, end-turn dispatch
  auction.js                   auction state machine
  trade.js                     trade proposal/validation/execution
  bankruptcy.js                debt resolution + asset transfer/auction
src/ui/
  render.js                    board + panels + log rendering from state
  components/                  modal builders (buy, auction, trade, manage, card)
  app.js                       entry: setup flow, wiring, autosave, screen switch
tests/
  *.test.js                    node --test, engine-only (rent, jail, build,
                               auction, trade, bankruptcy, cards)
README.md
```

Local dev needs a static server (e.g. `python3 -m http.server`) because ES
modules don't load over `file://`. GitHub Pages serves it directly.

## Persistence

Full game state serializes to JSON in `localStorage` after every applied
action. On load, if a save exists, offer Resume; "New Game" clears it. `version`
guards against incompatible old saves.

## Testing approach

Engine-first, test-driven. Each rule area gets focused unit tests run with
`node --test` (no dependencies): rent calculation (incl. monopoly bonus,
airports, utilities, mortgaged), jail flow, even-build and bank limits,
mortgage/interest, auction resolution, trade validation/execution, card
effects, and bankruptcy transfers. UI is built only after the engine is green.

## Out of scope for v1 (documented for later)

- **Networked multiplayer (phase 2).** Two recorded options:
  1. **WiFi host + QR/link (offline):** one device runs a small local server
     (Node + WebSocket); others on the same WiFi join via a QR/link. Engine runs
     authoritatively on the host. Fully offline; not a static-only site.
  2. **Internet rooms + 6-char code (Jackbox-style):** static client + a
     realtime backend hands out room codes; players join from anywhere. Needs
     internet + a service. The engine/UI split makes either feasible without
     rewriting game logic.
- House-rule variants (Free Parking jackpot, etc.), sound, animations beyond
  simple token movement, AI opponents.

## Deployment

GitHub Pages from `main`, root folder, repo `pravarzawar13/monopoly`.
`index.html` at repo root; served at the Pages URL. No build step.
