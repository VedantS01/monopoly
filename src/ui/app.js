import { createGame, serialize, deserialize } from '../engine/state.js';
import { applyAction } from '../engine/rules.js';
import { renderSetup } from './setup.js';
import { renderBoard } from './board.js';
import { renderPanels } from './panels.js';
import { renderModals } from './modals.js';
import { animateTransitions } from './animate.js';
import { autoStep } from './autoplay.js';
import { el, clear } from './dom.js';

const SAVE_KEY = 'world-monopoly-save-v1';
const root = document.getElementById('app');
let state = null;
let ui = { manage: false, trade: false };
let autoplay = false;
let autoTimer = null;

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
  ui = { manage: false, trade: false };
  if (state.phase === 'debt' && wasManage) ui.manage = true; // keep raising cash
  save();
  renderGame();
  return animateTransitions(prev, state);
}

export function dispatch(action) {
  if (action.type === '__TOGGLE_AUTOPLAY') { toggleAutoplay(); return; }
  if (action.type === '__OPEN_MANAGE') { ui.manage = true; return renderGame(); }
  if (action.type === '__OPEN_TRADE') { ui.trade = true; return renderGame(); }
  if (action.type === '__CLOSE') { ui = { manage: false, trade: false }; return renderGame(); }
  applyAndRender(action);
}

function toggleAutoplay() {
  autoplay = !autoplay;
  renderGame();
  if (autoplay) autoLoop();
  else clearTimeout(autoTimer);
}

function autoLoop() {
  if (!autoplay) return;
  const action = autoStep(state, Math.random);
  if (!action) { autoplay = false; renderGame(); return; }
  applyAndRender(action).then(() => {
    if (autoplay && state.phase !== 'game-over') autoTimer = setTimeout(autoLoop, 350);
    else { autoplay = false; renderGame(); }
  });
}

function startGame(defs) { state = createGame(defs); ui = { manage: false, trade: false }; save(); renderGame(); }
function resetToSetup() {
  autoplay = false; clearTimeout(autoTimer);
  localStorage.removeItem(SAVE_KEY); state = null; ui = { manage: false, trade: false };
  boot();
}

function autoplayFab() {
  return el('button', {
    class: 'autoplay-fab' + (autoplay ? ' on' : ''),
    text: autoplay ? '⏸ Stop autoplay' : '▶ Autoplay',
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
}

function boot() {
  renderSetup(root, {
    hasSave: !!loadSave(),
    onStart: startGame,
    onResume: () => { state = loadSave(); renderGame(); },
  });
}

boot();
