const NS = 'http://www.w3.org/2000/svg';

// Simple, recognisable single-path silhouettes on a 24x24 viewBox.
const PATHS = {
  hat:    'M6 16h12v2H6zM8 16V9a4 4 0 0 1 8 0v7z',
  car:    'M3 14l2-5h14l2 5v3h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3z',
  dog:    'M4 12l3-1 1-3 3 2h4l2 3v4H6a2 2 0 0 1-2-2z',
  ship:   'M4 14h16l-2 4H6zM11 5h2v8h-2zM13 6l5 2-5 2z',
  boot:   'M8 4h3v8h6a2 2 0 0 1 2 2v3H8z',
  cat:    'M6 10l-1-4 3 2h6l3-2-1 4v7H6zM9 13h1v1H9zm5 0h1v1h-1z',
  thimble:'M8 5h8l-1 9a3 3 0 0 1-6 0z',
  barrow: 'M4 13h10l3-6h-9zM6 16a2 2 0 1 0 0 .01zM2 8h3l2 5',
};
export const TOKEN_SHAPES = Object.keys(PATHS);

function svg(size) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  return s;
}

export function tokenSVG(shape, color) {
  const s = svg(22);
  // Disc filled with the player's colour (always visible against the cream
  // board), with a white emblem on top for the token shape.
  const chip = document.createElementNS(NS, 'circle');
  chip.setAttribute('cx', 12); chip.setAttribute('cy', 12); chip.setAttribute('r', 11);
  chip.setAttribute('fill', color || '#2b2b2b');
  chip.setAttribute('stroke', '#1a1a1a'); chip.setAttribute('stroke-width', 1.5);
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', PATHS[shape] || PATHS.hat);
  p.setAttribute('fill', '#ffffff');
  p.setAttribute('stroke', 'rgba(0,0,0,0.35)'); p.setAttribute('stroke-width', 0.4);
  s.appendChild(chip); s.appendChild(p);
  return s;
}

export function houseSVG() {
  const s = svg(13);
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', 'M3 20v-9l9-6 9 6v9z'); // walls + roof apex
  p.setAttribute('fill', '#1f6b3b'); p.setAttribute('stroke', '#0d3b20'); p.setAttribute('stroke-width', 1);
  s.appendChild(p);
  return s;
}

export function hotelSVG() {
  const s = svg(15);
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', 'M3 20V8l9-5 9 5v12z');
  p.setAttribute('fill', '#9b1c1c'); p.setAttribute('stroke', '#5e0f0f'); p.setAttribute('stroke-width', 1);
  s.appendChild(p);
  return s;
}
