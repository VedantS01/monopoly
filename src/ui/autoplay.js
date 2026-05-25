import { rollDie } from '../engine/rng.js';
import { getSpace } from '../engine/board.js';

// Pick a reasonable automated action for the current state. `rng` is a
// function returning [0,1); it is only used to generate dice. Returns null
// when the game is over (stop autoplaying). The logic always makes progress
// so an autoplayed game cannot get stuck.
export function autoStep(state, rng = Math.random) {
  const dice = () => [rollDie(rng), rollDie(rng)];
  const cur = state.players[state.currentPlayerIndex];

  switch (state.phase) {
    case 'pre-roll':
      if (cur.inJail) {
        if (cur.getOutCards > 0) return { type: 'USE_JAIL_CARD', dice: dice() };
        if (cur.money >= 50) return { type: 'PAY_JAIL', dice: dice() };
        return { type: 'ROLL_FOR_JAIL', dice: dice() };
      }
      return { type: 'ROLL', dice: dice() };

    case 'resolving': {
      const sp = getSpace(state.pending.decision.pos);
      return cur.money >= sp.price ? { type: 'BUY_PROPERTY' } : { type: 'DECLINE_PROPERTY' };
    }

    case 'auction': {
      const a = state.pending.auction;
      const bidder = state.players[a.bidders[a.currentBidderIndex]];
      const cap = Math.floor(getSpace(a.pos).price * 0.6);
      const next = a.highBid + 10;
      if (next <= cap && bidder.money >= next) return { type: 'AUCTION_BID', amount: next };
      return { type: 'AUCTION_PASS' };
    }

    case 'trade':
      return { type: 'REJECT_TRADE' };

    case 'debt': {
      // Sell buildings first (always from the property with the most houses,
      // which is legal under even-sell), then mortgage, then give up.
      let sellPos = null, sellMax = 0;
      let mortgagePos = null;
      for (const [pos, p] of Object.entries(state.properties)) {
        if (p.ownerId !== cur.id) continue;
        if (p.houses > sellMax) { sellMax = p.houses; sellPos = Number(pos); }
        if (!p.mortgaged && p.houses === 0 && mortgagePos == null) mortgagePos = Number(pos);
      }
      if (sellPos != null) return { type: 'SELL_HOUSE', pos: sellPos };
      if (mortgagePos != null) return { type: 'MORTGAGE', pos: mortgagePos };
      return { type: 'DECLARE_BANKRUPTCY' };
    }

    case 'manage':
      return { type: 'END_TURN' };

    case 'game-over':
    default:
      return null;
  }
}
