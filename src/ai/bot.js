import { getSpace, groupPositions, COLOR_GROUPS } from '../engine/board.js';
import { rollDie } from '../engine/rng.js';
import { canBuild, canSell } from '../engine/build.js';
import { canMortgage, canUnmortgage } from '../engine/mortgage.js';
import { propWorth, netWorth, valueTo, completesMonopoly } from './valuation.js';

export function actorId(state) {
  if (state.phase === 'game-over') return null;
  if (state.phase === 'auction') return state.pending.auction.bidders[state.pending.auction.currentBidderIndex];
  if (state.phase === 'trade') return state.pending.trade.toId;
  return state.currentPlayerIndex;
}

export function threatLevel(state, playerId) {
  const me = netWorth(state, playerId);
  let maxOpp = 0;
  state.players.forEach((p, i) => { if (i !== playerId && !p.bankrupt) maxOpp = Math.max(maxOpp, netWorth(state, i)); });
  return maxOpp > me * 1.3 ? 'behind' : 'ok';
}

export function effectiveBuffer(state, playerId, personality) {
  if (threatLevel(state, playerId) !== 'behind') return personality.cashBuffer;
  if (personality.riskTolerance === 'low') return personality.cashBuffer * 1.5;
  if (personality.riskTolerance === 'high') return personality.cashBuffer * 0.5;
  return personality.cashBuffer;
}

function spareProps(state, playerId, exclude = []) {
  const out = [];
  for (const [pos, pr] of Object.entries(state.properties)) {
    const p = Number(pos);
    if (pr.ownerId !== playerId || pr.houses > 0 || pr.mortgaged || exclude.includes(p)) continue;
    const s = getSpace(p);
    if (s.group && groupPositions(s.group).every((q) => state.properties[q].ownerId === playerId)) continue;
    out.push(p);
  }
  return out;
}

export function findTrade(state, selfId, personality) {
  if (personality.tradeInitiative === 'none') return null;
  const self = state.players[selfId];
  const buffer = effectiveBuffer(state, selfId, personality);
  const margin = personality.tradeInitiative === 'opportunistic' ? 0.25 : 0.1;

  for (const group of COLOR_GROUPS) {
    const ps = groupPositions(group);
    const mine = ps.filter((p) => state.properties[p].ownerId === selfId);
    if (mine.length !== ps.length - 1) continue;
    const target = ps.find((p) => state.properties[p].ownerId !== selfId);
    const tp = state.properties[target];
    if (tp.ownerId == null || tp.mortgaged || tp.houses > 0) continue;

    const need = Math.ceil(propWorth(state, target) * (1 + margin));
    const give = { money: Math.max(0, Math.min(self.money - buffer, need)), props: [], jailCards: 0 };
    if (give.money < need) {
      const spare = spareProps(state, selfId, [target]).sort((a, b) => propWorth(state, a) - propWorth(state, b))[0];
      if (spare != null) give.props.push(spare);
    }
    const giveValue = give.money + give.props.reduce((s, p) => s + propWorth(state, p), 0);
    if (giveValue < propWorth(state, target)) continue;
    return { fromId: selfId, toId: tp.ownerId, give, want: { money: 0, props: [target], jailCards: 0 } };
  }
  return null;
}

function bestBuild(state, playerId, personality) {
  let best = null;
  for (const [pos, pr] of Object.entries(state.properties)) {
    const p = Number(pos);
    if (pr.ownerId !== playerId || pr.houses >= personality.buildTo) continue;
    if (!canBuild(state, playerId, p)) continue;
    if (best == null || pr.houses < state.properties[best].houses) best = p;
  }
  return best;
}

function debtAction(state, playerId) {
  // sell from the lowest-value group that has houses (group-max property)
  let sellPos = null, sellGroupPrice = Infinity;
  for (const [pos, pr] of Object.entries(state.properties)) {
    const p = Number(pos);
    if (pr.ownerId !== playerId || pr.houses <= 0 || !canSell(state, playerId, p)) continue;
    const gp = groupPositions(getSpace(p).group).reduce((a, q) => a + getSpace(q).price, 0);
    if (gp < sellGroupPrice) { sellGroupPrice = gp; sellPos = p; }
  }
  if (sellPos != null) return { type: 'SELL_HOUSE', pos: sellPos };

  const mortgageable = [];
  for (const [pos, pr] of Object.entries(state.properties)) {
    const p = Number(pos);
    if (pr.ownerId !== playerId || !canMortgage(state, playerId, p)) continue;
    const grp = getSpace(p).group;
    const isComplete = grp && groupPositions(grp).every((q) => state.properties[q].ownerId === playerId);
    mortgageable.push({ p, isComplete: isComplete ? 1 : 0, worth: propWorth(state, p) });
  }
  mortgageable.sort((a, b) => (a.isComplete - b.isComplete) || (a.worth - b.worth));
  if (mortgageable.length) return { type: 'MORTGAGE', pos: mortgageable[0].p };

  return { type: 'DECLARE_BANKRUPTCY' };
}

export function botAction(state, personality, rng = Math.random, ctx = {}) {
  const id = actorId(state);
  if (id == null) return null;
  const me = state.players[id];
  const dice = () => [rollDie(rng), rollDie(rng)];

  switch (state.phase) {
    case 'pre-roll':
      if (me.inJail) {
        if (me.getOutCards > 0) return { type: 'USE_JAIL_CARD', dice: dice() };
        if (me.money >= 50) return { type: 'PAY_JAIL', dice: dice() };
        return { type: 'ROLL_FOR_JAIL', dice: dice() };
      }
      return { type: 'ROLL', dice: dice() };

    case 'resolving': {
      const sp = getSpace(state.pending.decision.pos);
      const buffer = effectiveBuffer(state, id, personality);
      const wants = completesMonopoly(state, id, sp.pos) || me.money - sp.price >= buffer;
      return (me.money >= sp.price && wants) ? { type: 'BUY_PROPERTY' } : { type: 'DECLINE_PROPERTY' };
    }

    case 'auction': {
      const a = state.pending.auction;
      const sp = getSpace(a.pos);
      let ceiling = personality.auctionCeiling * sp.price;
      if (completesMonopoly(state, id, a.pos)) ceiling = Math.max(ceiling, 1.5 * sp.price);
      const next = a.highBid + 10;
      return (next <= ceiling && me.money >= next) ? { type: 'AUCTION_BID', amount: next } : { type: 'AUCTION_PASS' };
    }

    case 'trade': {
      const t = state.pending.trade;
      const received = (t.give.money || 0) + (t.give.props || []).reduce((s, p) => s + valueTo(state, id, p), 0);
      const given = (t.want.money || 0) + (t.want.props || []).reduce((s, p) => s + valueTo(state, id, p), 0);
      return (received - given) >= personality.tradeAcceptBias ? { type: 'ACCEPT_TRADE' } : { type: 'REJECT_TRADE' };
    }

    case 'manage': {
      const buffer = effectiveBuffer(state, id, personality);
      for (const [pos, pr] of Object.entries(state.properties)) {
        const p = Number(pos);
        if (pr.ownerId === id && pr.mortgaged && canUnmortgage(state, id, p)) {
          const cost = Math.floor(getSpace(p).price / 2) * 1.1;
          if (me.money - cost >= buffer) return { type: 'UNMORTGAGE', pos: p };
        }
      }
      const build = bestBuild(state, id, personality);
      if (build != null) {
        const cost = getSpace(build).houseCost;
        if (me.money - cost >= buffer) return { type: 'BUILD_HOUSE', pos: build };
        if (personality.mortgageToBuild) {
          const spare = spareProps(state, id).filter((p) => canMortgage(state, id, p))
            .sort((a, b) => propWorth(state, a) - propWorth(state, b))[0];
          if (spare != null) return { type: 'MORTGAGE', pos: spare };
        }
      }
      if (!ctx.proposedTrade && personality.tradeInitiative !== 'none') {
        const offer = findTrade(state, id, personality);
        if (offer) { ctx.proposedTrade = true; return { type: 'PROPOSE_TRADE', offer }; }
      }
      return { type: 'END_TURN' };
    }

    case 'debt':
      return debtAction(state, id);

    default:
      return null;
  }
}
