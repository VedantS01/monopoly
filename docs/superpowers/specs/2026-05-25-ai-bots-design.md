# AI Bots + UI Good-to-haves — Design

**Date:** 2026-05-25
**Builds on:** the existing engine (`src/engine/`), UI (`src/ui/`), and the basic
`autoStep` autoplay in `src/ui/autoplay.js`.

## Purpose

Give each player seat the option to be played by an **AI bot** with a
**personality** (Dumb, Conservative, Moderate, Aggressive, Wildcard). Bots make
the non-forcing strategic choices a human would: building houses/hotels,
proposing reasonable trades, and raising money while preserving their best
assets — biased by personality. Bundle in a handful of UI improvements to the
existing game requested alongside this work.

The work is sequenced in three phases:

- **Phase A — UI good-to-haves + shared helpers** (no bot logic).
- **Phase B — bot decision engine** (pure, tested).
- **Phase C — bot driver + per-seat controls** (wires bots into play).

---

# Part A — UI good-to-haves

These are improvements to the current game. They ship first; Phase B/C build on
the `canBuild` helper and tinted token sprites introduced here.

### A1. Build-legality predicates (shared with bots)

Add pure predicates to the engine so the UI (and later bots) never guess:

- `canBuild(state, playerId, pos)` — true iff `pos` is a city owned by the
  player, the whole group is owned and unmortgaged, even-build holds
  (`houses === min(group houses)`), `houses < 5`, the bank has the needed
  house/hotel, and the player can afford `houseCost`.
- `canSell(state, playerId, pos)` — owns it, `houses > 0`, even-sell holds
  (`houses === max(group houses)`), and (for a hotel) the bank has ≥ 4 houses.
- `canMortgage(state, playerId, pos)` — owns it, not mortgaged, no buildings
  anywhere in the group.
- `canUnmortgage(state, playerId, pos)` — owns it, mortgaged, can afford
  `mortgageValue + 10%`.

These live in `src/engine/build.js` / `mortgage.js` and reuse the logic already
in `buildHouse`/`sellHouse`/`mortgage`/`unmortgage` (extract the guards into the
predicates; the action functions call them).

### A2. Manage modal: live cash, stays open, hides impossible actions

- The Manage modal header shows the current player's **live cash**
  (`money(cur.money)`), which updates as they act because the modal no longer
  closes.
- **Management actions keep the modal open.** Today `dispatch` resets
  `ui = { manage:false, trade:false }` after every engine action. Change it so
  the set `MANAGE_ACTIONS = { BUILD_HOUSE, SELL_HOUSE, MORTGAGE, UNMORTGAGE }`
  **preserves** the open modal (re-render only); all other actions reset `ui`
  as today. The existing debt-keeps-manage behavior is folded into this rule.
- Each property row shows a button **only when its action is legal**: Build only
  when `canBuild`, Sell only when `canSell`, Mortgage when `canMortgage`,
  Unmortgage when `canUnmortgage`. A row with no legal action shows just its
  name/status.

### A3. City names in group colors

Color each city tile's name with a **legible** per-group shade (not the raw band
colour, which washes out on cream for light blue/yellow). Add a CSS variable per
group, e.g. `--name-brown … --name-darkblue`, chosen for contrast, and apply
`.grp-<group> .tile-name { color: var(--name-<group>); font-weight: bold; }`.

### A4. SVG token + house/hotel sprites

Replace flat emoji with inline SVG so tokens can be **tinted with the player's
chosen colour** (shape + tint = doubly identifiable):

- New `src/ui/sprites.js`:
  - `tokenSVG(shapeId, color)` → an SVG element: a classic-object silhouette
    (`hat`, `car`, `dog`, `ship`, `boot`, `cat`, `thimble`, `barrow`) as a
    single filled path in `color`, on a small cream chip with a dark outline.
  - `houseSVG()` → small green house; `hotelSVG()` → red hotel (classic look).
- `setup.js` token chooser lists the eight shape ids (preview each tinted with
  that row's colour). Player state stores `token` as the shape id.
- `board.js` renders tokens via `tokenSVG(p.token, p.color)`, and buildings via
  `houseSVG()`×n or one `hotelSVG()` instead of 🏠/🏨.
- `panels.js` shows the same `tokenSVG` next to each player.
- SVG nodes are created with `document.createElementNS`. `tokenSVG` falls back to
  a default shape for an unknown id, so games saved before this change (whose
  `token` was an emoji) still render on resume.

---

# Part B — Bot decision engine

All pure, no DOM, in `src/ai/`. The engine state is unchanged except for two new
serializable player fields (Part C).

### B1. Personalities (`src/ai/personalities.js`)

A personality is a weight bundle:

```js
{ id, label,
  cashBuffer,        // keep ≥ this liquid before discretionary spend
  buildTo,           // 0..5 target house level (0 = never build)
  mortgageToBuild,   // mortgage non-set props to fund building?
  auctionCeiling,    // max bid as a fraction of list price (×, can exceed 1)
  tradeInitiative,   // 'none' | 'targeted' | 'opportunistic'
  tradeAcceptBias,   // accept a trade if net value to me ≥ this ($)
  riskTolerance }    // 'low' | 'medium' | 'high'
```

| id | cashBuffer | buildTo | mortgageToBuild | auctionCeiling | tradeInitiative | tradeAcceptBias | risk |
|----|-----------:|--------:|-----------------|---------------:|-----------------|----------------:|------|
| dumb | 0 | 0 | false | 0.6 | none | (always reject) | n/a |
| conservative | 400 | 3 | false | 0.5 | targeted | +150 | low |
| moderate | 200 | 4 | false | 0.7 | targeted | +50 | medium |
| aggressive | 75 | 5 | true | 1.1 | opportunistic | −100 | high |
| wildcard | rand[50,450] | rand[3,5] | rand bool | rand[0.5,1.1] | rand{targeted,opportunistic} | rand[−100,150] | rand |

`makePersonality(id, rng)` returns the bundle; for `wildcard` it draws each
weight from the ranges using `rng` (seeded per game+player so a saved game
replays identically). **`dumb` reproduces today's `autoStep` exactly.**

### B2. Valuation helpers (`src/ai/valuation.js`)

- `propWorth(state, pos)` = `price + houses*houseCost` (0 if unowned-irrelevant);
  the intrinsic worth used for comparisons.
- `netWorth(state, playerId)` = cash + Σ over owned props of
  (`mortgaged ? mortgageValue : price`) + `houses*houseCost`.
- `ownedInGroup(state, playerId, group)` and `completesMonopoly(state, playerId, pos)`
  — does acquiring `pos` give the player the full group?
- `valueTo(state, playerId, pos)` = `propWorth` + synergy: `+1.5 × groupPrice`
  if it completes the player's monopoly, `+0.25 × price` if it extends a partial
  set, `0` otherwise. Used for trade decisions and money-raising priority.

### B3. Whose turn to act (`actorId`)

`actorId(state)` returns the player id whose input the engine awaits:
`auction` → `pending.auction.bidders[currentBidderIndex]`; `trade` →
`pending.trade.toId`; `game-over` → `null`; otherwise `currentPlayerIndex`. This
lets bots act in auctions and respond to trade offers on others' turns.

### B4. `botAction(state, personality, rng, ctx)`

Returns the next **single** action for `actorId(state)` (the driver loops,
calling it repeatedly until END_TURN or a human is needed). `ctx` is a small
per-turn scratch object (`{ proposedTrade: bool }`) the driver resets each turn
to prevent re-proposing loops.

- **pre-roll**: jail logic (use card → pay $50 → roll for doubles) then ROLL.
- **resolving (buy decision)**: BUY if `valueTo(self,pos) > 0` and cash after
  purchase ≥ effectiveBuffer (or it completes a monopoly); else DECLINE_PROPERTY.
- **auction**: bid `highBid+10` while `highBid+10 ≤ auctionCeiling×price`
  (ceiling raised to ~1.5× if it completes the bidder's monopoly) and affordable;
  else AUCTION_PASS. Guarantees termination.
- **trade (recipient)**: accept iff
  `valueTo(received) − valueTo(given) + cashDelta ≥ tradeAcceptBias`; else reject.
  `dumb` always rejects.
- **manage** (priority, one action per call):
  1. **Unmortgage** a mortgaged set-property if `cash − cost ≥ effectiveBuffer`.
  2. **Build** the best `canBuild` property below `buildTo`, keeping
     `effectiveBuffer`. If `mortgageToBuild` and short, first MORTGAGE a
     non-set property to fund it.
  3. **Trade** (if `tradeInitiative ≠ none` and `!ctx.proposedTrade`):
     `findTrade` (B5); if found, set `ctx.proposedTrade = true`, PROPOSE_TRADE.
  4. **END_TURN**.
- **debt** (raise cash preserving performers, one action per call):
  1. SELL_HOUSE from the **lowest-value group that has houses**, off its
     group-max property (even-sell legal).
  2. Else MORTGAGE the **lowest-`propWorth` non-complete-group** property.
  3. Else MORTGAGE the lowest-value complete-group property (sacrifice last).
  4. Else DECLARE_BANKRUPTCY.
- **game-over**: return `null`.

`effectiveBuffer = cashBuffer × threatFactor`, where `threatLevel(state, self)`
compares `netWorth(self)` to the strongest opponent: if an opponent leads by
> 30%, conservative ×1.5 (hunker), aggressive ×0.5 (gamble), moderate ×1.0.

### B5. `findTrade(state, selfId, personality)`

For each group the bot is **one property short of completing**, where the missing
property is owned by a single opponent, unmortgaged, and unbuilt: target it.
Build an offer `{ fromId:self, toId:owner, give:{money, props:[spare?]}, want:{props:[target]} }`
where cash = `min(cash − effectiveBuffer, ceil(propWorth(target) × (1+margin)))`
(`margin` = 0.1 targeted / 0.25 opportunistic). If cash alone is short, add the
bot's lowest-value non-set spare property to bridge. Skip if the offer can't reach
a plausibly-acceptable value. Returns the offer or `null`.

---

# Part C — Driver & per-seat controls

### C1. State fields

Each player gains `isBot: boolean` (default false) and
`personality: 'dumb'|'conservative'|'moderate'|'aggressive'|'wildcard'` (default
`'dumb'`). `createGame` reads them from `playerDefs`. **The engine never reads
these** — only the UI driver does — but they live in state so they serialize with
the save and survive resume.

### C2. Generalized bot driver (`app.js`)

Replace the single autoplay loop with a driver that, after each render, computes
`actorId(state)`. If the game isn't over and that actor is bot-controlled
(`players[actorId].isBot`, or global spectate on), it schedules
`botAction(state, makePersonality(players[actorId].personality, rng), rng, ctx)`
→ apply → animate → repeat after the existing delay. If the actor is a human and
spectate is off, it waits. `ctx` resets whenever the turn advances.

The **Autoplay FAB becomes a global spectate toggle**: while on, every seat is
treated as bot-controlled by its assigned personality (Dumb seats just play the
basic logic). Turning it off returns control to human seats.

### C3. Controls

- **Setup**: each player row gets a **👤 Human / 🤖 Bot** toggle and a
  personality dropdown (default Dumb), plus the SVG token preview (A4).
- **In-game**: each player card shows a small 👤/🤖 toggle so a seat can be
  handed to/taken from its bot mid-game; the active personality is shown and can
  be changed from the card.

---

## Files

```
src/engine/build.js        + canBuild, canSell (extract guards)
src/engine/mortgage.js     + canMortgage, canUnmortgage
src/ai/personalities.js    weight bundles + makePersonality(id, rng)
src/ai/valuation.js        propWorth, netWorth, valueTo, completesMonopoly, ...
src/ai/bot.js              actorId, botAction, findTrade, threatLevel
src/ui/sprites.js          tokenSVG(shape,color), houseSVG(), hotelSVG()
src/ui/setup.js            human/bot + personality + SVG token chooser
src/ui/panels.js           per-card bot toggle + personality, SVG token
src/ui/board.js            SVG tokens + SVG houses/hotels, group-coloured names
src/ui/modals.js           manage modal: live cash, legal-only buttons
src/ui/app.js              generalized bot driver, MANAGE_ACTIONS keep-open
src/ui/autoplay.js         dumb logic folds into the 'dumb' personality (or re-exports)
styles.css                 name colours, sprite/chip styles
tests/ build/mortgage predicate tests, valuation.test.js, bot.test.js
```

## Testing

- **Predicates**: `canBuild/canSell/canMortgage/canUnmortgage` truth tables
  (full group vs not, even-build, bank empty, affordability, mortgaged).
- **Valuation**: `propWorth`, `netWorth`, `valueTo` synergy (completing vs
  extending vs unrelated).
- **Bot decisions**: per phase and personality — aggressive builds to hotels when
  flush and mortgages to build; conservative keeps its buffer and won't
  mortgage-to-build; `findTrade` returns a monopoly-completing offer;
  trade-accept respects `tradeAcceptBias`; debt-raising sells from the lowest
  group and mortgages non-sets first; `actorId` resolves auction/trade actors.
- **Full game**: a 4-player game with one of each personality autoplays to a
  winner without throwing, state stays serializable; seeded wildcard is
  deterministic.
- **UI**: extend the DOM smoke test to render the manage modal (legal-only
  buttons + live cash), SVG tokens, and the setup bot controls without throwing.
  The test's DOM stub gains `createElementNS` (aliased to `createElement`) so
  `sprites.js` can build SVG nodes in Node.

## Out of scope (v1)

Lookahead/probabilistic planning; cross-turn opponent modelling beyond current
board state; multi-step trade negotiation (one offer, accept/reject only);
difficulty tiers beyond the five personalities; animated/3D assets (flat SVG
only).
