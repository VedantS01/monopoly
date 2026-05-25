import { getSpace, groupPositions } from './board.js';
import { currentPlayer, playerById } from './state.js';
import { log } from './rules.js';

export function canBuild(state, playerId, pos) {
  const space = getSpace(pos);
  const prop = state.properties[pos];
  const player = playerById(state, playerId);
  if (!space || space.type !== 'city') return false;
  if (!prop || prop.ownerId !== playerId) return false;
  const group = groupPositions(space.group);
  if (!group.every((p) => state.properties[p].ownerId === playerId && !state.properties[p].mortgaged)) return false;
  if (prop.houses >= 5) return false;
  if (prop.houses > Math.min(...group.map((p) => state.properties[p].houses))) return false;
  if (prop.houses === 4 ? state.bank.hotels <= 0 : state.bank.houses <= 0) return false;
  return player.money >= space.houseCost;
}

export function canSell(state, playerId, pos) {
  const space = getSpace(pos);
  const prop = state.properties[pos];
  if (!space || space.type !== 'city' || !prop || prop.ownerId !== playerId || prop.houses <= 0) return false;
  const group = groupPositions(space.group);
  if (prop.houses < Math.max(...group.map((p) => state.properties[p].houses))) return false;
  if (prop.houses === 5 && state.bank.houses < 4) return false;
  return true;
}

export function buildHouse(state, pos) {
  const player = currentPlayer(state);
  if (!canBuild(state, player.id, pos)) return;
  const space = getSpace(pos);
  const prop = state.properties[pos];
  const buyingHotel = prop.houses === 4;

  player.money -= space.houseCost;
  prop.houses += 1;
  if (buyingHotel) {
    state.bank.hotels -= 1;
    state.bank.houses += 4;
    log(state, `${player.name} built a hotel on ${space.name}.`);
  } else {
    state.bank.houses -= 1;
    log(state, `${player.name} built a house on ${space.name}.`);
  }
}

export function sellHouse(state, pos) {
  const player = currentPlayer(state);
  if (!canSell(state, player.id, pos)) return;
  const space = getSpace(pos);
  const prop = state.properties[pos];
  const wasHotel = prop.houses === 5;

  if (wasHotel) {
    state.bank.hotels += 1;
    state.bank.houses -= 4;
  } else {
    state.bank.houses += 1;
  }
  prop.houses -= 1;
  player.money += Math.floor(space.houseCost / 2);
  log(state, `${player.name} sold a building on ${space.name}.`);
}
