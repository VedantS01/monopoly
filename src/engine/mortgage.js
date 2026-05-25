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
