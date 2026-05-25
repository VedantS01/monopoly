// Each space: { pos, name, type, group?, price?, rent?[6], houseCost? }
// type: 'corner' | 'city' | 'airport' | 'utility' | 'tax' | 'chance' | 'chest' | 'gotojail'
// rent tiers: [base, 1house, 2, 3, 4, hotel]  (classic Monopoly values)

export const BOARD = [
  { pos: 0,  name: 'GO', type: 'corner' },
  { pos: 1,  name: 'Marrakesh', type: 'city', group: 'brown', price: 60, houseCost: 50, rent: [2, 10, 30, 90, 160, 250] },
  { pos: 2,  name: 'Treasury', type: 'chest' },
  { pos: 3,  name: 'Cairo', type: 'city', group: 'brown', price: 60, houseCost: 50, rent: [4, 20, 60, 180, 320, 450] },
  { pos: 4,  name: 'Visa Fee', type: 'tax', amount: 200 },
  { pos: 5,  name: 'JFK Airport', type: 'airport', group: 'airports', price: 200 },
  { pos: 6,  name: 'Bangkok', type: 'city', group: 'lightblue', price: 100, houseCost: 50, rent: [6, 30, 90, 270, 400, 550] },
  { pos: 7,  name: 'Travel', type: 'chance' },
  { pos: 8,  name: 'Hanoi', type: 'city', group: 'lightblue', price: 100, houseCost: 50, rent: [6, 30, 90, 270, 400, 550] },
  { pos: 9,  name: 'Jakarta', type: 'city', group: 'lightblue', price: 120, houseCost: 50, rent: [8, 40, 100, 300, 450, 600] },
  { pos: 10, name: 'Jail / Just Visiting', type: 'corner' },
  { pos: 11, name: 'Istanbul', type: 'city', group: 'pink', price: 140, houseCost: 100, rent: [10, 50, 150, 450, 625, 750] },
  { pos: 12, name: 'Global Power Grid', type: 'utility', group: 'utilities', price: 150 },
  { pos: 13, name: 'Athens', type: 'city', group: 'pink', price: 140, houseCost: 100, rent: [10, 50, 150, 450, 625, 750] },
  { pos: 14, name: 'Cape Town', type: 'city', group: 'pink', price: 160, houseCost: 100, rent: [12, 60, 180, 500, 700, 900] },
  { pos: 15, name: 'Heathrow Airport', type: 'airport', group: 'airports', price: 200 },
  { pos: 16, name: 'Lisbon', type: 'city', group: 'orange', price: 180, houseCost: 100, rent: [14, 70, 200, 550, 750, 950] },
  { pos: 17, name: 'Treasury', type: 'chest' },
  { pos: 18, name: 'Dublin', type: 'city', group: 'orange', price: 180, houseCost: 100, rent: [14, 70, 200, 550, 750, 950] },
  { pos: 19, name: 'Vienna', type: 'city', group: 'orange', price: 200, houseCost: 100, rent: [16, 80, 220, 600, 800, 1000] },
  { pos: 20, name: 'Free Parking', type: 'corner' },
  { pos: 21, name: 'Berlin', type: 'city', group: 'red', price: 220, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { pos: 22, name: 'Travel', type: 'chance' },
  { pos: 23, name: 'Rome', type: 'city', group: 'red', price: 220, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { pos: 24, name: 'Madrid', type: 'city', group: 'red', price: 240, houseCost: 150, rent: [20, 100, 300, 750, 925, 1100] },
  { pos: 25, name: 'Changi Airport', type: 'airport', group: 'airports', price: 200 },
  { pos: 26, name: 'Toronto', type: 'city', group: 'yellow', price: 260, houseCost: 150, rent: [22, 110, 330, 800, 975, 1150] },
  { pos: 27, name: 'Sydney', type: 'city', group: 'yellow', price: 260, houseCost: 150, rent: [22, 110, 330, 800, 975, 1150] },
  { pos: 28, name: 'World Water Co.', type: 'utility', group: 'utilities', price: 150 },
  { pos: 29, name: 'Dubai', type: 'city', group: 'yellow', price: 280, houseCost: 150, rent: [24, 120, 360, 850, 1025, 1200] },
  { pos: 30, name: 'Go To Jail', type: 'gotojail' },
  { pos: 31, name: 'Singapore', type: 'city', group: 'green', price: 300, houseCost: 200, rent: [26, 130, 390, 900, 1100, 1275] },
  { pos: 32, name: 'Paris', type: 'city', group: 'green', price: 300, houseCost: 200, rent: [26, 130, 390, 900, 1100, 1275] },
  { pos: 33, name: 'Treasury', type: 'chest' },
  { pos: 34, name: 'Hong Kong', type: 'city', group: 'green', price: 320, houseCost: 200, rent: [28, 150, 450, 1000, 1200, 1400] },
  { pos: 35, name: "Dubai Int'l Airport", type: 'airport', group: 'airports', price: 200 },
  { pos: 36, name: 'Travel', type: 'chance' },
  { pos: 37, name: 'London', type: 'city', group: 'darkblue', price: 350, houseCost: 200, rent: [35, 175, 500, 1100, 1300, 1500] },
  { pos: 38, name: 'Departure Tax', type: 'tax', amount: 100 },
  { pos: 39, name: 'New York', type: 'city', group: 'darkblue', price: 400, houseCost: 200, rent: [50, 200, 600, 1400, 1700, 2000] },
];

export const COLOR_GROUPS = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue'];

export function getSpace(pos) {
  return BOARD[pos];
}

export function groupPositions(group) {
  return BOARD.filter((s) => s.group === group).map((s) => s.pos);
}

// positions that can ever be owned (cities, airports, utilities)
export function ownablePositions() {
  return BOARD.filter((s) => s.price != null).map((s) => s.pos);
}
