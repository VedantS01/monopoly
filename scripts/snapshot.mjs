// Dev tool: render the real UI to a static HTML snapshot for visual review.
// Usage: node scripts/snapshot.mjs /abs/path/to/output.html
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const VOID = new Set(['input', 'br', 'img', 'meta', 'link']);
class El {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.className = ''; this._text = ''; this._attrs = {}; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); }
  append(...n) { for (const x of n) if (x != null) this.appendChild(typeof x === 'string' ? new Text(x) : x); }
  get firstChild() { return this.children[0] || null; }
  setAttribute(k, v) { this._attrs[k] = v; }
  addEventListener() {}
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text; }
  querySelectorAll() { return []; }
  querySelector() { return null; }
}
class Text { constructor(t) { this._text = String(t); } }
globalThis.document = { createElement: (t) => new El(t), createTextNode: (t) => new Text(t) };

const here = dirname(fileURLToPath(import.meta.url));
const { createGame } = await import(join(here, '../src/engine/state.js'));
const { renderBoard } = await import(join(here, '../src/ui/board.js'));
const { renderPanels } = await import(join(here, '../src/ui/panels.js'));

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function html(node) {
  if (node instanceof Text) return esc(node._text);
  const attrs = [];
  if (node.className) attrs.push(`class="${esc(node.className)}"`);
  for (const [k, v] of Object.entries(node._attrs)) if (v != null && v !== false) attrs.push(`${k}="${esc(v)}"`);
  const open = `<${node.tagName}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;
  if (VOID.has(node.tagName)) return open;
  const inner = node._text ? esc(node._text) : node.children.map(html).join('');
  return `${open}${inner}</${node.tagName}>`;
}

// Build a visually rich mid-game state.
const s = createGame([
  { name: 'Ada', token: '🎩', color: '#c0392b' },
  { name: 'Ben', token: '🚗', color: '#2980b9' },
  { name: 'Cleo', token: '🐕', color: '#27ae60' },
], { seed: 5 });
s.dice = [3, 4];
s.players[0].position = 39; s.players[0].money = 1740;
s.players[1].position = 11; s.players[1].money = 980; s.players[1].inJail = true; s.players[1].position = 10;
s.players[2].position = 24; s.players[2].money = 1320;
// ownership + buildings
for (const p of [1, 3]) { s.properties[p].ownerId = 0; s.properties[p].houses = 2; }
s.properties[6].ownerId = 1; s.properties[8].ownerId = 1; s.properties[9].ownerId = 1; s.properties[9].houses = 5;
s.properties[39].ownerId = 0; s.properties[37].ownerId = 0;
s.properties[5].ownerId = 2; s.properties[15].ownerId = 2;
s.properties[21].ownerId = 2; s.properties[21].mortgaged = true;
s.properties[24].ownerId = 1;
s.phase = 'manage';

const layout = new El('div'); layout.className = 'game-layout';
layout.appendChild(renderBoard(s));
layout.appendChild(renderPanels(s, () => {}));

const styles = readFileSync(join(here, '../styles.css'), 'utf8');
const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head>
<body><div id="app">${html(layout)}</div></body></html>`;

const out = process.argv[2] || join(here, '../snapshot.html');
writeFileSync(out, doc);
console.log('wrote', out);
