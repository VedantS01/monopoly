import { test } from 'node:test';
import assert from 'node:assert/strict';

class El { constructor(t) { this.tag = t; this.children = []; this._a = {}; } setAttribute(k, v) { this._a[k] = v; } appendChild(c) { this.children.push(c); return c; } setAttributeNS() {} }
globalThis.document = { createElement: (t) => new El(t), createElementNS: (_ns, t) => new El(t) };

const { tokenSVG, houseSVG, hotelSVG, TOKEN_SHAPES } = await import('../src/ui/sprites.js');

test('TOKEN_SHAPES lists eight ids', () => {
  assert.equal(TOKEN_SHAPES.length, 8);
});

test('tokenSVG fills with the given colour and tolerates unknown ids', () => {
  const a = tokenSVG('car', '#ff0000');
  assert.equal(a.tag, 'svg');
  const fallback = tokenSVG('not-a-shape', '#00ff00');
  assert.equal(fallback.tag, 'svg');
});

test('houseSVG and hotelSVG return svg nodes', () => {
  assert.equal(houseSVG().tag, 'svg');
  assert.equal(hotelSVG().tag, 'svg');
});
