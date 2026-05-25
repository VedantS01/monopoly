import { ownablePositions } from './board.js';
import { CHANCE, CHEST } from './cards.js';
import { makeRng, shuffle } from './rng.js';

export const STATE_VERSION = 1;

export function createGame(playerDefs, { seed } = {}) {
  const rng = makeRng(seed);
  const players = playerDefs.map((p, id) => ({
    id,
    name: p.name,
    token: p.token,
    color: p.color,
    money: 1500,
    position: 0,
    inJail: false,
    jailRolls: 0,
    getOutCards: 0,
    bankrupt: false,
    isBot: p.isBot ?? false,
    personality: p.personality ?? 'dumb',
  }));

  const properties = {};
  for (const pos of ownablePositions()) {
    properties[pos] = { ownerId: null, houses: 0, mortgaged: false };
  }

  return {
    version: STATE_VERSION,
    players,
    currentPlayerIndex: 0,
    dice: [0, 0],
    doublesCount: 0,
    properties,
    bank: { houses: 32, hotels: 12 },
    decks: {
      chance: shuffle(CHANCE.map((c) => c.id), rng),
      chest: shuffle(CHEST.map((c) => c.id), rng),
    },
    phase: 'pre-roll',
    pending: {},
    log: [`Game started with ${players.length} players.`],
    winnerId: null,
  };
}

export function clone(state) {
  return structuredClone(state);
}

export function currentPlayer(state) {
  return state.players[state.currentPlayerIndex];
}

export function playerById(state, id) {
  return state.players.find((p) => p.id === id);
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(json) {
  return JSON.parse(json);
}
