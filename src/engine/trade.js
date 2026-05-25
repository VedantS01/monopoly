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
