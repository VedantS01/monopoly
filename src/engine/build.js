import { getSpace, groupPositions } from './board.js';
import { currentPlayer } from './state.js';
import { log } from './rules.js';

function ownsFullGroup(state, player, group) {
  return groupPositions(group).every(
    (p) => state.properties[p].ownerId === player.id && !state.properties[p].mortgaged,
  );
}

export function buildHouse(state, pos) {
  const player = currentPlayer(state);
  const space = getSpace(pos);
  const prop = state.properties[pos];
  if (space.type !== 'city') return;
  if (prop.ownerId !== player.id) return;
  if (!ownsFullGroup(state, player, space.group)) return;
  if (prop.houses >= 5) return;

  // even-build: cannot exceed the group minimum
  const group = groupPositions(space.group);
  const minHouses = Math.min(...group.map((p) => state.properties[p].houses));
  if (prop.houses > minHouses) return;

  const buyingHotel = prop.houses === 4;
  if (buyingHotel) {
    if (state.bank.hotels <= 0) return;
  } else if (state.bank.houses <= 0) {
    return;
  }
  if (player.money < space.houseCost) return;

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
  const space = getSpace(pos);
  const prop = state.properties[pos];
  if (prop.ownerId !== player.id || prop.houses <= 0) return;

  // even-sell: cannot drop below the group maximum
  const group = groupPositions(space.group);
  const maxHouses = Math.max(...group.map((p) => state.properties[p].houses));
  if (prop.houses < maxHouses) return;

  const wasHotel = prop.houses === 5;
  if (wasHotel) {
    if (state.bank.houses < 4) return; // can't break a hotel without 4 houses
    state.bank.hotels += 1;
    state.bank.houses -= 4;
  } else {
    state.bank.houses += 1;
  }
  prop.houses -= 1;
  player.money += Math.floor(space.houseCost / 2);
  log(state, `${player.name} sold a building on ${space.name}.`);
}
