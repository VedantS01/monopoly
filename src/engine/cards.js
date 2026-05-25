export const CHANCE = [
  { id: 'ch1',  deck: 'chance', text: 'Fly to New York. Advance to New York.', effect: { kind: 'moveTo', pos: 39, passGo: true } },
  { id: 'ch2',  deck: 'chance', text: 'Advance to GO. Collect $200.', effect: { kind: 'moveTo', pos: 0, passGo: true } },
  { id: 'ch3',  deck: 'chance', text: 'Advance to Berlin.', effect: { kind: 'moveTo', pos: 21, passGo: true } },
  { id: 'ch4',  deck: 'chance', text: 'Take a trip to Heathrow Airport.', effect: { kind: 'moveTo', pos: 15, passGo: true } },
  { id: 'ch5',  deck: 'chance', text: 'Advance to the nearest Airport. Pay owner twice the rent.', effect: { kind: 'moveToNearest', target: 'airport' } },
  { id: 'ch6',  deck: 'chance', text: 'Advance to the nearest Utility.', effect: { kind: 'moveToNearest', target: 'utility' } },
  { id: 'ch7',  deck: 'chance', text: 'Bank pays you a dividend of $50.', effect: { kind: 'money', amount: 50 } },
  { id: 'ch8',  deck: 'chance', text: 'Get Out of Jail Free.', effect: { kind: 'getOutOfJail' } },
  { id: 'ch9',  deck: 'chance', text: 'Go back 3 spaces.', effect: { kind: 'back3' } },
  { id: 'ch10', deck: 'chance', text: 'Go to Jail. Do not pass GO.', effect: { kind: 'gotojail' } },
  { id: 'ch11', deck: 'chance', text: 'Make general repairs: $25 per house, $100 per hotel.', effect: { kind: 'repairs', perHouse: 25, perHotel: 100 } },
  { id: 'ch12', deck: 'chance', text: 'Speeding fine. Pay $15.', effect: { kind: 'money', amount: -15 } },
  { id: 'ch13', deck: 'chance', text: 'You have been elected chairman. Pay each player $50.', effect: { kind: 'eachPlayer', amount: -50 } },
  { id: 'ch14', deck: 'chance', text: 'Your building loan matures. Collect $150.', effect: { kind: 'money', amount: 150 } },
];

export const CHEST = [
  { id: 'cc1',  deck: 'chest', text: 'Advance to GO. Collect $200.', effect: { kind: 'moveTo', pos: 0, passGo: true } },
  { id: 'cc2',  deck: 'chest', text: 'Bank error in your favor. Collect $200.', effect: { kind: 'money', amount: 200 } },
  { id: 'cc3',  deck: 'chest', text: "Doctor's fee. Pay $50.", effect: { kind: 'money', amount: -50 } },
  { id: 'cc4',  deck: 'chest', text: 'From sale of stock you get $50.', effect: { kind: 'money', amount: 50 } },
  { id: 'cc5',  deck: 'chest', text: 'Get Out of Jail Free.', effect: { kind: 'getOutOfJail' } },
  { id: 'cc6',  deck: 'chest', text: 'Go to Jail. Do not pass GO.', effect: { kind: 'gotojail' } },
  { id: 'cc7',  deck: 'chest', text: "It's your birthday. Collect $10 from every player.", effect: { kind: 'eachPlayer', amount: 10 } },
  { id: 'cc8',  deck: 'chest', text: 'Holiday fund matures. Collect $100.', effect: { kind: 'money', amount: 100 } },
  { id: 'cc9',  deck: 'chest', text: 'Income tax refund. Collect $20.', effect: { kind: 'money', amount: 20 } },
  { id: 'cc10', deck: 'chest', text: 'Life insurance matures. Collect $100.', effect: { kind: 'money', amount: 100 } },
  { id: 'cc11', deck: 'chest', text: 'Hospital fees. Pay $50.', effect: { kind: 'money', amount: -50 } },
  { id: 'cc12', deck: 'chest', text: 'School fees. Pay $50.', effect: { kind: 'money', amount: -50 } },
  { id: 'cc13', deck: 'chest', text: 'Consultancy fee. Collect $25.', effect: { kind: 'money', amount: 25 } },
  { id: 'cc14', deck: 'chest', text: 'Street repair: $40 per house, $115 per hotel.', effect: { kind: 'repairs', perHouse: 40, perHotel: 115 } },
];

export const ALL_CARDS = [...CHANCE, ...CHEST];

const BY_ID = Object.fromEntries(ALL_CARDS.map((c) => [c.id, c]));
export function getCard(id) {
  return BY_ID[id];
}
