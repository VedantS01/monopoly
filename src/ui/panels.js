import { el, money } from './dom.js';
import { tokenSVG } from './sprites.js';

export function renderPanels(state, dispatch) {
  const wrap = el('div', { class: 'side' });

  const players = el('div', { class: 'players' }, state.players.map((p) => el('div', {
    class: 'player-card' + (p.id === state.currentPlayerIndex ? ' active' : '') + (p.bankrupt ? ' bankrupt' : ''),
    style: `border-left-color:${p.color}`,
    'data-player': p.id,
  }, [
    el('span', { class: 'p-token' }, [tokenSVG(p.token, p.color)]),
    el('span', { class: 'p-name', text: p.name + (p.inJail ? ' 🔒' : '') }),
    el('span', { class: 'p-money', text: money(p.money) }),
  ])));

  const actions = el('div', { class: 'actions' }, [
    el('div', { class: 'dice', text: state.dice[0] && state.dice[1] ? `🎲 ${state.dice[0]} + ${state.dice[1]} = ${state.dice[0] + state.dice[1]}` : '🎲 —' }),
    renderActions(state, dispatch),
  ]);

  const log = el('div', { class: 'log' },
    state.log.slice(-12).reverse().map((m) => el('div', { class: 'log-line', text: m })));

  wrap.append(players, actions, el('div', { class: 'log-wrap' }, [el('h3', { text: 'Game log' }), log]));
  return wrap;
}

function btn(label, action, dispatch, opts = {}) {
  return el('button', { class: 'btn ' + (opts.primary ? 'btn-primary' : ''), text: label, onclick: () => dispatch(action) });
}

function renderActions(state, dispatch) {
  const box = el('div', { class: 'action-buttons' });
  const cur = state.players[state.currentPlayerIndex];
  if (state.phase === 'pre-roll') {
    if (cur.inJail) {
      box.append(
        btn('Pay $50', { type: 'PAY_JAIL' }, dispatch, { primary: true }),
        ...(cur.getOutCards > 0 ? [btn('Use Jail Card', { type: 'USE_JAIL_CARD' }, dispatch)] : []),
        btn('Roll for doubles', { type: 'ROLL_FOR_JAIL' }, dispatch),
      );
    } else {
      box.append(btn('🎲 Roll', { type: 'ROLL' }, dispatch, { primary: true }));
    }
  } else if (state.phase === 'manage') {
    box.append(
      btn('🏗 Manage', { type: '__OPEN_MANAGE' }, dispatch),
      btn('🤝 Trade', { type: '__OPEN_TRADE' }, dispatch),
      btn('End turn ▸', { type: 'END_TURN' }, dispatch, { primary: true }),
    );
  }
  // 'resolving','auction','trade','debt','game-over' are driven by modals.
  return box;
}
