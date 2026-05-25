import { groupPositions } from './board.js';
import { moveTo, sendToJail, log, resolveLanding } from './rules.js';

export function applyCardEffect(state, player, card) {
  const e = card.effect;
  log(state, `${player.name} drew: ${card.text}`);
  switch (e.kind) {
    case 'money':
      player.money += e.amount;
      break;
    case 'eachPlayer': {
      for (const other of state.players) {
        if (other.id === player.id || other.bankrupt) continue;
        other.money -= e.amount;
        player.money += e.amount;
      }
      break;
    }
    case 'moveTo':
      moveTo(state, player, e.pos, { passGo: e.passGo });
      resolveLanding(state, player);
      break;
    case 'moveToNearest': {
      const targets = e.target === 'airport'
        ? groupPositions('airports')
        : groupPositions('utilities');
      const next = targets.find((p) => p > player.position) ?? targets[0];
      moveTo(state, player, next, { passGo: true });
      resolveLanding(state, player);
      break;
    }
    case 'back3':
      player.position = (player.position + 40 - 3) % 40;
      resolveLanding(state, player);
      break;
    case 'gotojail':
      sendToJail(state, player);
      break;
    case 'repairs': {
      let houses = 0, hotels = 0;
      for (const pos in state.properties) {
        const prop = state.properties[pos];
        if (prop.ownerId !== player.id) continue;
        if (prop.houses === 5) hotels += 1;
        else houses += prop.houses;
      }
      player.money -= houses * e.perHouse + hotels * e.perHotel;
      break;
    }
    case 'getOutOfJail':
      player.getOutCards += 1;
      break;
  }
}
