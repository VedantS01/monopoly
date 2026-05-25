import { el, clear } from './dom.js';
import { tokenSVG, TOKEN_SHAPES } from './sprites.js';

const COLORS = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#16a085'];
const SHAPE_LABELS = {
  hat: 'Top hat', car: 'Car', dog: 'Dog', ship: 'Ship',
  boot: 'Boot', cat: 'Cat', thimble: 'Thimble', barrow: 'Wheelbarrow',
};

export function renderSetup(root, { onStart, onResume, hasSave }) {
  clear(root);
  let count = 2;
  const form = el('div', { class: 'setup' });

  const rowsWrap = el('div', { class: 'setup-players' });
  function rebuild() {
    clear(rowsWrap);
    for (let i = 0; i < count; i++) {
      const color = COLORS[i % COLORS.length];
      const defaultShape = TOKEN_SHAPES[i % TOKEN_SHAPES.length];
      const preview = el('span', { class: 'setup-preview' }, [tokenSVG(defaultShape, color)]);
      const tokenSel = el('select', { class: 'setup-token', 'data-i': i },
        TOKEN_SHAPES.map((id) => el('option', { value: id, ...(id === defaultShape ? { selected: 'selected' } : {}) }, SHAPE_LABELS[id])));
      tokenSel.addEventListener('change', () => { clear(preview); preview.appendChild(tokenSVG(tokenSel.value, color)); });
      rowsWrap.appendChild(el('div', { class: 'setup-row' }, [
        preview,
        el('input', { class: 'setup-name', type: 'text', value: `Player ${i + 1}`, 'data-i': i, maxlength: 14 }),
        tokenSel,
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
