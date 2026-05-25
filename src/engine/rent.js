import { getSpace, groupPositions } from './board.js';

export function rentFor(state, pos, diceTotal) {
  const space = getSpace(pos);
  const prop = state.properties[pos];
  if (!prop || prop.ownerId == null || prop.mortgaged) return 0;
  const ownerId = prop.ownerId;

  if (space.type === 'airport') {
    const owned = groupPositions('airports')
      .filter((p) => state.properties[p].ownerId === ownerId).length;
    return 25 * 2 ** (owned - 1); // 25,50,100,200
  }

  if (space.type === 'utility') {
    const owned = groupPositions('utilities')
      .filter((p) => state.properties[p].ownerId === ownerId).length;
    return (owned === 2 ? 10 : 4) * diceTotal;
  }

  // city
  if (prop.houses > 0) return space.rent[prop.houses];
  const group = groupPositions(space.group);
  const ownsGroup = group.every(
    (p) => state.properties[p].ownerId === ownerId && !state.properties[p].mortgaged,
  );
  return ownsGroup ? space.rent[0] * 2 : space.rent[0];
}
