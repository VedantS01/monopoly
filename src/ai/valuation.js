import { getSpace, groupPositions } from '../engine/board.js';

export function propWorth(state, pos) {
  const s = getSpace(pos);
  if (!s || s.price == null) return 0;
  return s.price + (state.properties[pos]?.houses || 0) * (s.houseCost || 0);
}

export function netWorth(state, playerId) {
  let w = state.players[playerId].money;
  for (const [pos, pr] of Object.entries(state.properties)) {
    if (pr.ownerId !== playerId) continue;
    const s = getSpace(Number(pos));
    w += pr.mortgaged ? Math.floor(s.price / 2) : s.price;
    w += pr.houses * (s.houseCost || 0);
  }
  return w;
}

export function ownedInGroup(state, playerId, group) {
  return groupPositions(group).filter((p) => state.properties[p].ownerId === playerId).length;
}

export function completesMonopoly(state, playerId, pos) {
  const s = getSpace(pos);
  if (!s || !s.group) return false;
  return groupPositions(s.group).every((p) => p === pos || state.properties[p].ownerId === playerId);
}

function groupPrice(group) {
  return groupPositions(group).reduce((a, p) => a + (getSpace(p).price || 0), 0);
}

export function valueTo(state, playerId, pos) {
  const s = getSpace(pos);
  let v = propWorth(state, pos);
  if (s && s.group) {
    if (completesMonopoly(state, playerId, pos)) v += 1.5 * groupPrice(s.group);
    else if (ownedInGroup(state, playerId, s.group) > 0) v += 0.25 * (s.price || 0);
  }
  return v;
}
