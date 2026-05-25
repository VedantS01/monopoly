import { el } from './dom.js';
import { BOARD } from '../engine/board.js';
import { tokenSVG, houseSVG, hotelSVG } from './sprites.js';

// Nostalgic icons for the non-city spaces.
const ICONS = {
  airport: '✈️', utility: '💡', tax: '💸', chance: '❓', chest: '🎁', gotojail: '🚓',
};
function cornerIcon(space) {
  if (space.name === 'GO') return '⬅️';
  if (space.name.startsWith('Jail')) return '🔒';
  if (space.name === 'Free Parking') return '🅿️';
  return '';
}

// Map board position (0..39) to a cell [row, col] on an 11x11 ring.
function cell(pos) {
  if (pos <= 10) return { row: 11, col: 11 - pos };          // bottom row, GO at bottom-right
  if (pos <= 20) return { row: 11 - (pos - 10), col: 1 };    // left column going up
  if (pos <= 30) return { row: 1, col: (pos - 20) + 1 };     // top row, left -> right
  return { row: (pos - 30) + 1, col: 11 };                   // right column going down
}

export function renderBoard(state) {
  const grid = el('div', { class: 'board' });
  for (const space of BOARD) {
    const { row, col } = cell(space.pos);
    const tile = el('div', {
      class: `tile tile-${space.type}` + (space.group ? ` grp-${space.group}` : ''),
      style: `grid-row:${row};grid-column:${col}`,
      'data-pos': space.pos,
    });
    if (space.type === 'city') tile.appendChild(el('div', { class: 'band' }));
    const icon = ICONS[space.type] || cornerIcon(space);
    if (icon) tile.appendChild(el('div', { class: 'tile-icon', text: icon }));
    tile.appendChild(el('div', { class: 'tile-name', text: space.name }));
    if (space.price != null) {
      const prop = state.properties[space.pos];
      if (prop.ownerId == null) {
        tile.appendChild(el('div', { class: 'tile-price', text: '$' + space.price }));
      } else {
        const owner = state.players[prop.ownerId];
        tile.appendChild(el('div', { class: 'owner-dot', style: `background:${owner.color}`, title: owner.name }));
        if (prop.mortgaged) tile.appendChild(el('div', { class: 'mortgaged', text: 'M' }));
        if (prop.houses === 5) {
          tile.appendChild(el('div', { class: 'houses' }, [hotelSVG()]));
        } else if (prop.houses > 0) {
          const h = el('div', { class: 'houses' });
          for (let i = 0; i < prop.houses; i++) h.appendChild(houseSVG());
          tile.appendChild(h);
        }
      }
    }
    const here = state.players.filter((p) => !p.bankrupt && p.position === space.pos);
    if (here.length) {
      tile.appendChild(el('div', { class: 'tokens' },
        here.map((p) => el('span', { class: 'token', title: p.name, 'data-player': p.id }, [tokenSVG(p.token, p.color)]))));
    }
    grid.appendChild(tile);
  }
  grid.appendChild(el('div', { class: 'board-center', style: 'grid-row:2/11;grid-column:2/11' }, [
    el('div', { class: 'center-logo', text: '🌍 WORLD MONOPOLY' }),
    el('div', { class: 'center-sub', text: 'pass & play' }),
  ]));
  return grid;
}
