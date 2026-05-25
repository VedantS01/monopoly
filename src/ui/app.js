import { createGame, serialize, deserialize } from '../engine/state.js';
import { applyAction } from '../engine/rules.js';
import { renderSetup } from './setup.js';
import { renderBoard } from './board.js';
import { renderPanels } from './panels.js';
import { renderModals } from './modals.js';
import { animateTransitions } from './animate.js';
import { actorId, botAction } from '../ai/bot.js';
import { makePersonality } from '../ai/personalities.js';
import { makeRng } from '../engine/rng.js';
import { el, clear } from './dom.js';

const SAVE_KEY = 'world-monopoly-save-v1';
const MANAGE_ACTIONS = new Set(['BUILD_HOUSE', 'SELL_HOUSE', 'MORTGAGE', 'UNMORTGAGE']);
const root = document.getElementById('app');
let state = null;
let ui = { manage: false, trade: false, tune: null };
let spectate = false;       // global Autoplay: every seat plays its bot
let botTimer = null;
let botCtx = {};
const rng = makeRng();

function save() { if (state) localStorage.setItem(SAVE_KEY, serialize(state)); }
function loadSave() {
  const j = localStorage.getItem(SAVE_KEY);
  try { return j ? deserialize(j) : null; } catch { return null; }
}

// Apply an engine action, persist, re-render, and animate the diff.
function applyAndRender(action) {
  const prev = state;
  const wasManage = ui.manage;
  const { state: next } = applyAction(state, action);
  state = next;
  const keepManage = MANAGE_ACTIONS.has(action.type) && (wasManage || state.phase === 'debt');
  ui = { manage: keepManage, trade: false, tune: null };
  save();
  renderGame();
  return animateTransitions(prev, state);
}

export function dispatch(action) {
  switch (action.type) {
    case '__TOGGLE_AUTOPLAY': spectate = !spectate; return renderGame();
    case '__OPEN_MANAGE': ui.manage = true; return renderGame();
    case '__OPEN_TRADE': ui.trade = true; return renderGame();
    case '__CLOSE': ui = { manage: false, trade: false, tune: null }; return renderGame();
    case '__TOGGLE_SEAT_BOT': state.players[action.playerId].isBot = !state.players[action.playerId].isBot; save(); return renderGame();
    case '__SET_PERSONALITY': {
      const pl = state.players[action.playerId];
      pl.personality = action.personality;
      pl.persWeights = makePersonality(action.personality, rng); // re-resolve (clears prior tuning)
      save(); return renderGame();
    }
    case '__TUNE_SEAT': {
      const pl = state.players[action.playerId];
      if (!pl.persWeights) pl.persWeights = makePersonality(pl.personality || 'dumb', rng);
      pl.persWeights[action.key] = action.value;
      save(); return renderGame();
    }
    case '__OPEN_TUNE': ui.tune = action.playerId; return renderGame();
    default: applyAndRender(action);
  }
}

// --- bot driver ---
// Resolve a seat's working personality once and cache it on the player (so
// Wildcard doesn't re-randomise every step, and mid-game tuning persists).
function personalityFor(id) {
  const p = state.players[id];
  if (!p.persWeights) p.persWeights = makePersonality(p.personality || 'dumb', rng);
  return p.persWeights;
}

function actorIsBot(s) {
  const id = actorId(s);
  return id != null && (spectate || s.players[id].isBot);
}

function scheduleBots() {
  clearTimeout(botTimer);
  if (!state || state.phase === 'game-over' || !actorIsBot(state)) return;
  botTimer = setTimeout(runBotStep, 600);
}

function runBotStep() {
  if (!state || state.phase === 'game-over' || !actorIsBot(state)) return;
  const id = actorId(state);
  if (state.phase === 'pre-roll') botCtx = {}; // reset per-turn memory at turn start only
  const action = botAction(state, personalityFor(id), rng, botCtx);
  if (action) applyAndRender(action); // re-renders -> scheduleBots()
}

function startGame(defs) { state = createGame(defs); ui = { manage: false, trade: false, tune: null }; save(); renderGame(); }
function resetToSetup() {
  spectate = false; clearTimeout(botTimer);
  localStorage.removeItem(SAVE_KEY); state = null; ui = { manage: false, trade: false, tune: null };
  boot();
}

function autoplayFab() {
  return el('button', {
    class: 'autoplay-fab' + (spectate ? ' on' : ''),
    text: spectate ? '⏸ Stop autoplay' : '▶ Autoplay (all bots)',
    onclick: () => dispatch({ type: '__TOGGLE_AUTOPLAY' }),
  });
}

function renderGame() {
  clear(root);
  const layout = el('div', { class: 'game-layout' });
  layout.appendChild(renderBoard(state));
  layout.appendChild(renderPanels(state, dispatch));
  root.appendChild(layout);
  renderModals(state, dispatch, root, ui, resetToSetup);
  if (state.phase !== 'game-over') root.appendChild(autoplayFab());
  scheduleBots();
}

function boot() {
  renderSetup(root, {
    hasSave: !!loadSave(),
    onStart: startGame,
    onResume: () => { state = loadSave(); renderGame(); },
  });
}

boot();
