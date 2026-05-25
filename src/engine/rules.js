import { clone, currentPlayer, playerById } from './state.js';
import { getSpace } from './board.js';
import { rentFor } from './rent.js';
import { rollDie, makeRng } from './rng.js';
import { payJail, useJailCard, rollForJail } from './jail.js';
import { getCard } from './cards.js';
import { applyCardEffect } from './cardeffects.js';
import { buildHouse, sellHouse } from './build.js';
import { mortgage, unmortgage } from './mortgage.js';
import { startAuction, auctionBid, auctionPass } from './auction.js';
import { proposeTrade, acceptTrade, rejectTrade } from './trade.js';
import { declareBankruptcy } from './bankruptcy.js';

const GO_SALARY = 200;
const JAIL_POS = 10;

function log(state, msg) {
  state.log.push(msg);
}

function flagDebt(state, debtorId, creditorId) {
  state.pending.debt = { debtorId, creditorId };
  state.phase = 'debt';
}

function clearDebtIfSolvent(state) {
  if (state.phase === 'debt' && state.pending.debt) {
    const d = playerById(state, state.pending.debt.debtorId);
    if (d.money >= 0) {
      delete state.pending.debt;
      state.phase = 'manage';
    }
  }
}

function rollPair(seed) {
  const rng = makeRng(seed);
  return [rollDie(rng), rollDie(rng)];
}

// Move a player to an absolute position, paying GO salary if they pass it.
function moveTo(state, player, newPos, { passGo = true } = {}) {
  if (passGo && newPos < player.position) {
    player.money += GO_SALARY;
    log(state, `${player.name} passed GO and collected $${GO_SALARY}.`);
  }
  player.position = newPos;
}

function sendToJail(state, player) {
  player.position = JAIL_POS;
  player.inJail = true;
  player.jailRolls = 0;
  state.doublesCount = 0;
  state.phase = 'manage';
  log(state, `${player.name} was sent to Jail.`);
}

// Resolve the space a player just landed on. Sets phase.
export function resolveLanding(state, player) {
  const space = getSpace(player.position);
  log(state, `${player.name} landed on ${space.name}.`);

  if (space.type === 'gotojail') {
    sendToJail(state, player);
    return;
  }
  if (space.price != null) {
    const prop = state.properties[player.position];
    if (prop.ownerId == null) {
      state.phase = 'resolving';
      state.pending.decision = { kind: 'buy', pos: player.position, playerId: player.id };
      return;
    }
    if (prop.ownerId !== player.id && !prop.mortgaged) {
      const rent = rentFor(state, player.position, state.dice[0] + state.dice[1]);
      payRent(state, player, playerById(state, prop.ownerId), rent);
    }
    if (state.phase !== 'debt') state.phase = 'manage';
    return;
  }
  if (space.type === 'tax') {
    player.money -= space.amount;
    log(state, `${player.name} paid ${space.name} of $${space.amount}.`);
    if (player.money < 0) flagDebt(state, player.id, null);
    else state.phase = 'manage';
    return;
  }
  if (space.type === 'chance' || space.type === 'chest') {
    const deckName = space.type === 'chance' ? 'chance' : 'chest';
    const id = state.decks[deckName].shift();
    const card = getCard(id);
    if (card.effect.kind === 'getOutOfJail') {
      // keep the card out of the deck while held by the player
    } else {
      state.decks[deckName].push(id);
    }
    applyCardEffect(state, player, card);
    if (state.phase === 'resolving' || state.phase === 'debt') { /* keep */ }
    else if (player.money < 0) flagDebt(state, player.id, null);
    else state.phase = 'manage';
    return;
  }
  // corners (Free Parking, Just Visiting) are no-ops
  state.phase = 'manage';
}

function payRent(state, payer, owner, amount) {
  payer.money -= amount;
  owner.money += amount;
  log(state, `${payer.name} paid $${amount} rent to ${owner.name}.`);
  if (payer.money < 0) flagDebt(state, payer.id, owner.id);
}

export function applyAction(state, action) {
  const s = clone(state);
  const events0 = s.log.length;
  switch (action.type) {
    case 'ROLL': {
      if (s.phase !== 'pre-roll') break;
      if (currentPlayer(s).inJail) break;
      const rng = makeRng(action.seed);
      const dice = action.dice ?? [rollDie(rng), rollDie(rng)];
      s.dice = dice;
      const player = currentPlayer(s);
      const isDouble = dice[0] === dice[1];
      if (isDouble) {
        s.doublesCount += 1;
        if (s.doublesCount >= 3) {
          sendToJail(s, player);
          break;
        }
      } else {
        s.doublesCount = 0;
      }
      const total = dice[0] + dice[1];
      moveTo(s, player, (player.position + total) % 40);
      resolveLanding(s, player);
      break;
    }
    case 'BUY_PROPERTY': {
      const d = s.pending.decision;
      if (!d || d.kind !== 'buy') break;
      const player = currentPlayer(s);
      const space = getSpace(d.pos);
      player.money -= space.price;
      s.properties[d.pos].ownerId = player.id;
      log(s, `${player.name} bought ${space.name} for $${space.price}.`);
      delete s.pending.decision;
      s.phase = 'manage';
      break;
    }
    case 'PAY_JAIL': {
      if (!currentPlayer(s).inJail) break;
      payJail(s, action.dice ?? rollPair(action.seed));
      break;
    }
    case 'USE_JAIL_CARD': {
      if (!currentPlayer(s).inJail) break;
      useJailCard(s, action.dice ?? rollPair(action.seed));
      break;
    }
    case 'ROLL_FOR_JAIL': {
      if (!currentPlayer(s).inJail) break;
      rollForJail(s, action.dice ?? rollPair(action.seed));
      break;
    }
    case 'BUILD_HOUSE':
      if (s.phase !== 'manage') break;
      buildHouse(s, action.pos);
      break;
    case 'SELL_HOUSE':
      sellHouse(s, action.pos);
      clearDebtIfSolvent(s);
      break;
    case 'MORTGAGE':
      mortgage(s, action.pos);
      clearDebtIfSolvent(s);
      break;
    case 'UNMORTGAGE':
      unmortgage(s, action.pos);
      clearDebtIfSolvent(s);
      break;
    case 'DECLINE_PROPERTY': {
      const d = s.pending.decision;
      if (!d || d.kind !== 'buy') break;
      const pos = d.pos;
      delete s.pending.decision;
      startAuction(s, pos);
      break;
    }
    case 'AUCTION_BID':
      if (s.phase === 'auction') auctionBid(s, action.amount);
      break;
    case 'AUCTION_PASS':
      if (s.phase === 'auction') auctionPass(s);
      break;
    case 'PROPOSE_TRADE':
      if (s.phase === 'manage') proposeTrade(s, action.offer);
      break;
    case 'ACCEPT_TRADE':
      acceptTrade(s);
      clearDebtIfSolvent(s);
      break;
    case 'REJECT_TRADE':
      rejectTrade(s);
      break;
    case 'DECLARE_BANKRUPTCY':
      declareBankruptcy(s);
      break;
    case 'END_TURN': {
      if (s.phase === 'debt') break;
      if (s.phase === 'manage' && s.doublesCount > 0 && s.doublesCount < 3
          && !currentPlayer(s).inJail) {
        s.phase = 'pre-roll';
        log(s, `${currentPlayer(s).name} rolled doubles — roll again.`);
        break;
      }
      s.doublesCount = 0;
      advanceTurn(s);
      s.phase = 'pre-roll';
      break;
    }
    default:
      break;
  }
  const events = s.log.slice(events0);
  return { state: s, events };
}

function advanceTurn(state) {
  const n = state.players.length;
  let i = state.currentPlayerIndex;
  do {
    i = (i + 1) % n;
  } while (state.players[i].bankrupt && i !== state.currentPlayerIndex);
  state.currentPlayerIndex = i;
  log(state, `It is now ${state.players[i].name}'s turn.`);
}

export { advanceTurn, moveTo, sendToJail, log, payRent };
