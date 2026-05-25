import { createGame, serialize, deserialize } from '../engine/state.js';
import { applyAction } from '../engine/rules.js';
import { renderSetup } from './setup.js';
import { renderBoard } from './board.js';
import { renderPanels } from './panels.js';
import { renderModals } from './modals.js';
import { clear } from './dom.js';

const SAVE_KEY = 'world-monopoly-save-v1';
const root = document.getElementById('app');
let state = null;
let ui = { manage: false, trade: false };

function save() { if (state) localStorage.setItem(SAVE_KEY, serialize(state)); }
function loadSave() {
  const j = localStorage.getItem(SAVE_KEY);
  try { return j ? deserialize(j) : null; } catch { return null; }
}

export function dispatch(action) {
  if (action.type === '__OPEN_MANAGE') { ui.manage = true; return renderGame(); }
  if (action.type === '__OPEN_TRADE') { ui.trade = true; return renderGame(); }
  if (action.type === '__CLOSE') { ui = { manage: false, trade: false }; return renderGame(); }

  const wasManage = ui.manage;
  const { state: next } = applyAction(state, action);
  state = next;
  ui = { manage: false, trade: false };
  if (state.phase === 'debt' && wasManage) ui.manage = true; // keep raising cash
  save();
  renderGame();
}

function startGame(defs) { state = createGame(defs); ui = { manage: false, trade: false }; save(); renderGame(); }
function resetToSetup() { localStorage.removeItem(SAVE_KEY); state = null; ui = { manage: false, trade: false }; boot(); }

function renderGame() {
  clear(root);
  const layout = document.createElement('div');
  layout.className = 'game-layout';
  layout.appendChild(renderBoard(state));
  layout.appendChild(renderPanels(state, dispatch));
  root.appendChild(layout);
  renderModals(state, dispatch, root, ui, resetToSetup);
}

function boot() {
  renderSetup(root, {
    hasSave: !!loadSave(),
    onStart: startGame,
    onResume: () => { state = loadSave(); renderGame(); },
  });
}

boot();
