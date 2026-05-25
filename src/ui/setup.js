import { el, clear } from './dom.js';

// Classic Monopoly-style tokens for that nostalgic feel.
const TOKENS = ['🎩', '🚗', '🐕', '🚢', '👢', '🐈', '🛞', '🧵'];
const COLORS = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#16a085'];

export function renderSetup(root, { onStart, onResume, hasSave }) {
  clear(root);
  let count = 2;
  const form = el('div', { class: 'setup' });

  const rowsWrap = el('div', { class: 'setup-players' });
  function rebuild() {
    clear(rowsWrap);
    for (let i = 0; i < count; i++) {
      rowsWrap.appendChild(el('div', { class: 'setup-row' }, [
        el('span', { class: 'setup-swatch', style: `background:${COLORS[i % COLORS.length]}` }),
        el('input', { class: 'setup-name', type: 'text', value: `Player ${i + 1}`, 'data-i': i, maxlength: 14 }),
        el('select', { class: 'setup-token', 'data-i': i },
          TOKENS.map((t, ti) => el('option', { value: t, ...(ti === i ? { selected: 'selected' } : {}) }, t))),
      ]));
    }
  }
  rebuild();

  const controls = el('div', { class: 'setup-controls' }, [
    el('button', { class: 'btn', text: '− Player', onclick: () => { if (count > 2) { count--; rebuild(); } } }),
    el('button', { class: 'btn', text: '+ Player', onclick: () => { if (count < 6) { count++; rebuild(); } } }),
  ]);

  const start = el('button', {
    class: 'btn btn-primary btn-lg', text: 'Start Game',
    onclick: () => {
      const names = [...rowsWrap.querySelectorAll('.setup-name')];
      const tokens = [...rowsWrap.querySelectorAll('.setup-token')];
      const defs = names.map((n, i) => ({
        name: n.value.trim() || `Player ${i + 1}`,
        token: tokens[i].value,
        color: COLORS[i % COLORS.length],
      }));
      onStart(defs);
    },
  });

  form.append(
    el('h1', { class: 'title', text: '🎲 World Monopoly' }),
    el('p', { class: 'subtitle', text: 'Pass-and-play · 2–6 players · world cities' }),
    ...(hasSave ? [el('button', { class: 'btn btn-resume', text: '↩ Resume saved game', onclick: onResume })] : []),
    el('h3', { class: 'setup-h', text: 'Players' }),
    rowsWrap, controls, start,
  );
  root.appendChild(form);
}
