import { el, clear, money } from './dom.js';
import { getSpace } from '../engine/board.js';

function overlay(title, body, root) {
  const ov = el('div', { class: 'overlay' }, [
    el('div', { class: 'modal' }, [el('h2', { text: title }), ...[].concat(body)]),
  ]);
  root.appendChild(ov);
}

export function renderModals(state, dispatch, root, ui = {}, resetToSetup) {
  const cur = state.players[state.currentPlayerIndex];

  if (state.phase === 'resolving' && state.pending.decision) {
    const sp = getSpace(state.pending.decision.pos);
    overlay(`Buy ${sp.name}?`, [
      el('p', { text: `Price: ${money(sp.price)} · ${cur.name}'s cash: ${money(cur.money)}` }),
      el('div', { class: 'modal-actions' }, [
        el('button', {
          class: 'btn btn-primary', text: `Buy ${money(sp.price)}`,
          disabled: cur.money < sp.price ? 'disabled' : null,
          onclick: () => dispatch({ type: 'BUY_PROPERTY' }),
        }),
        el('button', { class: 'btn', text: 'Auction it', onclick: () => dispatch({ type: 'DECLINE_PROPERTY' }) }),
      ]),
    ], root);
  }

  if (state.phase === 'auction') {
    const a = state.pending.auction;
    const bidder = state.players[a.bidders[a.currentBidderIndex]];
    const input = el('input', { class: 'bid-input', type: 'number', min: a.highBid + 1, value: a.highBid + 10 });
    overlay(`Auction: ${getSpace(a.pos).name}`, [
      el('p', { text: `High bid: ${money(a.highBid)}${a.highBidderId != null ? ' by ' + state.players[a.highBidderId].name : ''}` }),
      el('p', { class: 'turn', text: `${bidder.name}'s turn to bid (cash ${money(bidder.money)})` }),
      el('div', { class: 'modal-actions' }, [
        input,
        el('button', { class: 'btn btn-primary', text: 'Bid', onclick: () => dispatch({ type: 'AUCTION_BID', amount: Number(input.value) }) }),
        el('button', { class: 'btn', text: 'Pass', onclick: () => dispatch({ type: 'AUCTION_PASS' }) }),
      ]),
    ], root);
  }

  if (state.phase === 'debt' && state.pending.debt && !ui.manage) {
    overlay('You owe money!', [
      el('p', { text: `${cur.name} is at ${money(cur.money)}. Raise cash by mortgaging or selling, or declare bankruptcy.` }),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn btn-primary', text: '🏗 Raise cash', onclick: () => dispatch({ type: '__OPEN_MANAGE' }) }),
        el('button', { class: 'btn btn-danger', text: 'Declare bankruptcy', onclick: () => dispatch({ type: 'DECLARE_BANKRUPTCY' }) }),
      ]),
    ], root);
  }

  if (ui.manage) overlay(`Manage — ${cur.name}`, [renderManage(state, dispatch), closeBtn(dispatch)], root);
  if (ui.trade) overlay('Propose a trade', [renderTrade(state, dispatch), closeBtn(dispatch)], root);

  if (state.pending.trade) {
    const t = state.pending.trade;
    const to = state.players[t.toId];
    overlay('Trade offer', [
      el('p', { text: `${state.players[t.fromId].name} → ${to.name}` }),
      el('p', { text: describeSide('Gives', t.give) }),
      el('p', { text: describeSide('Wants', t.want) }),
      el('p', { class: 'turn', text: `${to.name}, do you accept?` }),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn btn-primary', text: 'Accept', onclick: () => dispatch({ type: 'ACCEPT_TRADE' }) }),
        el('button', { class: 'btn', text: 'Reject', onclick: () => dispatch({ type: 'REJECT_TRADE' }) }),
      ]),
    ], root);
  }

  if (state.phase === 'game-over') {
    overlay('🏆 Game over', [
      el('p', { class: 'winner', text: `${state.players[state.winnerId].name} wins!` }),
      el('button', { class: 'btn btn-primary', text: 'New game', onclick: () => resetToSetup() }),
    ], root);
  }
}

function closeBtn(dispatch) {
  return el('button', { class: 'btn', text: 'Close', onclick: () => dispatch({ type: '__CLOSE' }) });
}

function describeSide(label, side) {
  const props = (side.props || []).map((p) => getSpace(p).name).join(', ') || '—';
  return `${label}: ${money(side.money || 0)} + [${props}]`;
}

function renderManage(state, dispatch) {
  const cur = state.players[state.currentPlayerIndex];
  const owned = Object.entries(state.properties).filter(([, p]) => p.ownerId === cur.id);
  if (!owned.length) return el('p', { text: 'You own no properties.' });
  return el('div', { class: 'manage-list' }, owned.map(([pos, p]) => {
    const sp = getSpace(Number(pos));
    const label = sp.name + (p.mortgaged ? ' (mortgaged)' : '')
      + (p.houses ? ` · ${p.houses === 5 ? 'hotel' : p.houses + 'h'}` : '');
    const row = el('div', { class: 'manage-row' }, [el('span', { class: 'm-name', text: label })]);
    if (sp.type === 'city' && !p.mortgaged) {
      row.appendChild(el('button', { class: 'btn btn-sm', text: `Build ${money(sp.houseCost)}`, onclick: () => dispatch({ type: 'BUILD_HOUSE', pos: Number(pos) }) }));
      if (p.houses > 0) row.appendChild(el('button', { class: 'btn btn-sm', text: 'Sell', onclick: () => dispatch({ type: 'SELL_HOUSE', pos: Number(pos) }) }));
    }
    if (!p.mortgaged) row.appendChild(el('button', { class: 'btn btn-sm', text: 'Mortgage', onclick: () => dispatch({ type: 'MORTGAGE', pos: Number(pos) }) }));
    else row.appendChild(el('button', { class: 'btn btn-sm', text: 'Unmortgage', onclick: () => dispatch({ type: 'UNMORTGAGE', pos: Number(pos) }) }));
    return row;
  }));
}

function renderTrade(state, dispatch) {
  const cur = state.players[state.currentPlayerIndex];
  const others = state.players.filter((p) => p.id !== cur.id && !p.bankrupt);
  if (!others.length) return el('p', { text: 'No one to trade with.' });
  const partnerSel = el('select', { class: 'trade-partner' }, others.map((p) => el('option', { value: p.id }, p.name)));
  const giveMoney = el('input', { class: 'tm', type: 'number', min: 0, value: 0 });
  const wantMoney = el('input', { class: 'tm', type: 'number', min: 0, value: 0 });
  const myProps = Object.entries(state.properties).filter(([, p]) => p.ownerId === cur.id && p.houses === 0);

  function propBox(entries, cls) {
    if (!entries.length) return el('div', { class: cls + ' empty', text: '(none)' });
    return el('div', { class: cls }, entries.map(([pos]) => el('label', { class: 'tradeprop' }, [
      el('input', { type: 'checkbox', value: pos }), getSpace(Number(pos)).name,
    ])));
  }
  const giveProps = propBox(myProps, 'give-props');

  const partnerProps = el('div', { class: 'want-props-wrap' });
  function refreshWant() {
    clear(partnerProps);
    const toId = Number(partnerSel.value);
    const theirs = Object.entries(state.properties).filter(([, p]) => p.ownerId === toId && p.houses === 0);
    partnerProps.appendChild(propBox(theirs, 'want-props'));
  }
  partnerSel.addEventListener('change', refreshWant);
  refreshWant();

  const propose = el('button', {
    class: 'btn btn-primary', text: 'Propose',
    onclick: () => {
      const toId = Number(partnerSel.value);
      const give = { money: Number(giveMoney.value) || 0, props: [...giveProps.querySelectorAll('input:checked')].map((c) => Number(c.value)), jailCards: 0 };
      const want = { money: Number(wantMoney.value) || 0, props: [...partnerProps.querySelectorAll('input:checked')].map((c) => Number(c.value)), jailCards: 0 };
      dispatch({ type: 'PROPOSE_TRADE', offer: { fromId: cur.id, toId, give, want } });
    },
  });

  return el('div', { class: 'trade-builder' }, [
    el('div', { class: 'trade-field' }, [el('label', { text: 'Partner: ' }), partnerSel]),
    el('h4', { text: 'You give' }),
    el('div', { class: 'trade-field' }, [el('label', { text: 'Cash: $' }), giveMoney]),
    giveProps,
    el('h4', { text: 'You want' }),
    el('div', { class: 'trade-field' }, [el('label', { text: 'Cash: $' }), wantMoney]),
    partnerProps,
    propose,
  ]);
}
