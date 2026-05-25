import { getSpace, groupPositions } from './board.js';
import { currentPlayer, playerById } from './state.js';
import { log } from './rules.js';

export function canMortgage(state, playerId, pos) {
  const space = getSpace(pos);
  const prop = state.properties[pos];
  if (!prop || prop.ownerId !== playerId || prop.mortgaged) return false;
  if (space.group && groupPositions(space.group).some((p) => state.properties[p].houses > 0)) return false;
  return true;
}

export function canUnmortgage(state, playerId, pos) {
  const space = getSpace(pos);
  const prop = state.properties[pos];
  const player = playerById(state, playerId);
  if (!prop || prop.ownerId !== playerId || !prop.mortgaged) return false;
  const value = Math.floor(space.price / 2);
  return player.money >= value + Math.ceil(value * 0.1);
}

export function mortgage(state, pos) {
  const player = currentPlayer(state);
  if (!canMortgage(state, player.id, pos)) return;
  const space = getSpace(pos);
  const value = Math.floor(space.price / 2);
  player.money += value;
  state.properties[pos].mortgaged = true;
  log(state, `${player.name} mortgaged ${space.name} for $${value}.`);
}

export function unmortgage(state, pos) {
  const player = currentPlayer(state);
  if (!canUnmortgage(state, player.id, pos)) return;
  const space = getSpace(pos);
  const value = Math.floor(space.price / 2);
  const cost = value + Math.ceil(value * 0.1);
  player.money -= cost;
  state.properties[pos].mortgaged = false;
  log(state, `${player.name} unmortgaged ${space.name} for $${cost}.`);
}
