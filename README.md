# 🎲 World Monopoly — Pass & Play

An offline, single-device **pass-and-play** Monopoly game with **full classic
rules**, a **world-cities** board, and a vintage look. Built in plain
HTML/CSS/JavaScript (ES modules, no build step) so it runs fully offline and
deploys straight to GitHub Pages.

**▶ Play it:** https://vedants01.github.io/monopoly/

## How to play

Two to six players share one device and pass it around the table.

- Tap **Roll** on your turn. Land on an unowned city/airport/utility and you may
  **buy** it or send it to **auction**.
- Build **houses and hotels** on full colour groups, **mortgage** for quick
  cash, and **trade** properties and money with other players.
- Land on someone's property and pay **rent**. Go to **jail**, draw **Travel**
  and **Treasury** cards, pay taxes, and try not to go **bankrupt**.
- Last player standing wins. The game **auto-saves** — close the tab and pick up
  where you left off.

## Run locally

ES modules need to be served over HTTP (not `file://`):

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Run the tests

The rules engine is pure (no DOM) and covered by Node's built-in test runner:

```bash
npm test        # node --test
```

## How it's built

- **`src/engine/`** — a pure rules engine. The whole game is a reducer:
  `applyAction(state, action) -> { state, events }`. No DOM, fully unit-tested.
- **`src/ui/`** — a thin rendering layer that dispatches actions to the engine
  and re-renders from the returned state. No game rules live here.
- **`scripts/snapshot.mjs`** — a dev tool that renders the UI to a static HTML
  file (handy for visual review without a browser):
  `node scripts/snapshot.mjs out.html`.

Design and implementation notes live in `docs/superpowers/`.

## Theme

Cities span the globe (Marrakesh → London → New York), airports replace
railroads (JFK, Heathrow, Changi, Dubai), and utilities are the Global Power
Grid and World Water Co. Classic Monopoly prices and rents are used throughout.

## Roadmap

Networked multiplayer (each player on their own device, same-WiFi or room codes)
is designed but out of scope for v1 — see `docs/superpowers/specs/`.
