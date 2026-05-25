import { el } from './dom.js';

const HOP_MS = 110;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function tileEl(pos) { return document.querySelector(`.tile[data-pos="${pos}"]`); }
function cardEl(id) { return document.querySelector(`.player-card[data-player="${id}"]`); }
function centerOf(node) {
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Path of board positions to hop through, moving forward around the ring.
// Long jumps and backward moves go straight to the destination.
function buildPath(from, to) {
  const fd = (to - from + 40) % 40;
  if (fd === 0) return [to];
  if (fd <= 12) {
    const path = [];
    for (let i = 1; i <= fd; i++) path.push((from + i) % 40);
    return path;
  }
  return [to];
}

async function flyToken(player, fromPos, toPos) {
  const start = tileEl(fromPos);
  if (!start) return;
  const staticTok = document.querySelector(`.token[data-player="${player.id}"]`);
  if (staticTok) staticTok.style.visibility = 'hidden';

  const fly = el('div', { class: 'fly-token' });
  fly.textContent = player.token;
  fly.style.color = player.color;
  document.body.appendChild(fly);

  let c = centerOf(start);
  fly.style.left = `${c.x}px`;
  fly.style.top = `${c.y}px`;

  for (const pos of buildPath(fromPos, toPos)) {
    const t = tileEl(pos);
    if (!t) continue;
    c = centerOf(t);
    fly.style.left = `${c.x}px`;
    fly.style.top = `${c.y}px`;
    await wait(HOP_MS);
  }
  fly.remove();
  if (staticTok) staticTok.style.visibility = 'visible';
}

function moneyBadge(playerId, delta) {
  const card = cardEl(playerId);
  if (!card) return;
  const b = el('div', { class: 'money-badge ' + (delta < 0 ? 'neg' : 'pos') });
  b.textContent = (delta < 0 ? '-$' : '+$') + Math.abs(delta).toLocaleString('en-US');
  card.appendChild(b);
  setTimeout(() => b.remove(), 1400);
}

function flyCoin(fromId, toId) {
  const a = cardEl(fromId);
  const b = cardEl(toId);
  if (!a || !b) return;
  const pa = centerOf(a);
  const pb = centerOf(b);
  const coin = el('div', { class: 'fly-coin' });
  coin.textContent = '💵';
  document.body.appendChild(coin);
  coin.style.left = `${pa.x}px`;
  coin.style.top = `${pa.y}px`;
  requestAnimationFrame(() => {
    coin.style.left = `${pb.x}px`;
    coin.style.top = `${pb.y}px`;
  });
  setTimeout(() => coin.remove(), 750);
}

// Animate the difference between two states. Returns a promise that resolves
// when token movement finishes (money badges/coins are fire-and-forget).
export function animateTransitions(prev, next) {
  if (typeof document === 'undefined') return Promise.resolve();

  const losers = [];
  const gainers = [];
  next.players.forEach((p, i) => {
    const d = p.money - prev.players[i].money;
    if (d !== 0) {
      moneyBadge(i, d);
      (d < 0 ? losers : gainers).push(i);
    }
  });
  if (losers.length === 1) gainers.forEach((g) => flyCoin(losers[0], g));

  const moves = [];
  next.players.forEach((p, i) => {
    const from = prev.players[i].position;
    if (!p.bankrupt && p.position !== from) moves.push(flyToken(p, from, p.position));
  });
  return Promise.all(moves);
}
