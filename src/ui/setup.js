import { el, clear } from './dom.js';
import { tokenSVG, TOKEN_SHAPES } from './sprites.js';
import { PERSONALITIES } from '../ai/personalities.js';

const COLORS = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#16a085'];
const SHAPE_LABELS = {
  hat: 'Top hat', car: 'Car', dog: 'Dog', ship: 'Ship',
  boot: 'Boot', cat: 'Cat', thimble: 'Thimble', barrow: 'Wheelbarrow',
};
const PERSONALITY_IDS = ['dumb', 'conservative', 'moderate', 'aggressive', 'wildcard'];
const persLabel = (id) => PERSONALITIES[id]?.label || 'Wildcard';

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

      const persSel = el('select', { class: 'setup-pers', 'data-i': i, disabled: 'disabled' },
        PERSONALITY_IDS.map((id) => el('option', { value: id }, persLabel(id))));
      const botToggle = el('button', {
        class: 'btn btn-sm setup-bot', 'data-i': i, 'data-bot': '0', text: '👤 Human',
        onclick: (e) => {
          const on = e.target.getAttribute('data-bot') === '1';
          e.target.setAttribute('data-bot', on ? '0' : '1');
          e.target.textContent = on ? '👤 Human' : '🤖 Bot';
          if (on) persSel.setAttribute('disabled', 'disabled'); else persSel.removeAttribute('disabled');
        },
      });

      rowsWrap.appendChild(el('div', { class: 'setup-row' }, [
        preview,
        el('input', { class: 'setup-name', type: 'text', value: `Player ${i + 1}`, 'data-i': i, maxlength: 14 }),
        tokenSel, botToggle, persSel,
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
      const bots = [...rowsWrap.querySelectorAll('.setup-bot')];
      const pers = [...rowsWrap.querySelectorAll('.setup-pers')];
      const defs = names.map((n, i) => ({
        name: n.value.trim() || `Player ${i + 1}`,
        token: tokens[i].value,
        color: COLORS[i % COLORS.length],
        isBot: bots[i].getAttribute('data-bot') === '1',
        personality: pers[i].value,
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
