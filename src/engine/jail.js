import { currentPlayer } from './state.js';
import { moveTo, resolveLanding, log } from './rules.js';

const JAIL_FINE = 50;

// Free the player (do not change doublesCount) and move them by `total`.
function freeAndMove(state, player, total) {
  player.inJail = false;
  player.jailRolls = 0;
  moveTo(state, player, (player.position + total) % 40);
  resolveLanding(state, player);
}

export function payJail(state, dice) {
  const player = currentPlayer(state);
  player.money -= JAIL_FINE;
  log(state, `${player.name} paid $${JAIL_FINE} to leave Jail.`);
  freeAndMove(state, player, dice[0] + dice[1]);
}

export function useJailCard(state, dice) {
  const player = currentPlayer(state);
  if (player.getOutCards <= 0) return;
  player.getOutCards -= 1;
  log(state, `${player.name} used a Get Out of Jail Free card.`);
  freeAndMove(state, player, dice[0] + dice[1]);
}

export function rollForJail(state, dice) {
  const player = currentPlayer(state);
  state.dice = dice;
  if (dice[0] === dice[1]) {
    log(state, `${player.name} rolled doubles and left Jail.`);
    freeAndMove(state, player, dice[0] + dice[1]);
    state.doublesCount = 0; // no bonus roll for leaving via doubles
    return;
  }
  player.jailRolls += 1;
  if (player.jailRolls >= 3) {
    player.money -= JAIL_FINE;
    log(state, `${player.name} failed 3 times, paid $${JAIL_FINE}, and left Jail.`);
    freeAndMove(state, player, dice[0] + dice[1]);
    return;
  }
  log(state, `${player.name} did not roll doubles and stays in Jail.`);
  state.phase = 'manage';
}
