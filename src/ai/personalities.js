export const PERSONALITIES = {
  dumb:         { id: 'dumb', label: 'Dumb', cashBuffer: 0, buildTo: 0, mortgageToBuild: false, auctionCeiling: 0.6, tradeInitiative: 'none', tradeAcceptBias: Infinity, riskTolerance: 'medium' },
  conservative: { id: 'conservative', label: 'Conservative', cashBuffer: 400, buildTo: 3, mortgageToBuild: false, auctionCeiling: 0.5, tradeInitiative: 'targeted', tradeAcceptBias: 150, riskTolerance: 'low' },
  moderate:     { id: 'moderate', label: 'Moderate', cashBuffer: 200, buildTo: 4, mortgageToBuild: false, auctionCeiling: 0.7, tradeInitiative: 'targeted', tradeAcceptBias: 50, riskTolerance: 'medium' },
  aggressive:   { id: 'aggressive', label: 'Aggressive', cashBuffer: 75, buildTo: 5, mortgageToBuild: true, auctionCeiling: 1.1, tradeInitiative: 'opportunistic', tradeAcceptBias: -100, riskTolerance: 'high' },
};

export function makePersonality(id, rng = Math.random) {
  if (id === 'wildcard') {
    const pick = (a, b) => a + (b - a) * rng();
    return {
      id: 'wildcard', label: 'Wildcard',
      cashBuffer: Math.round(pick(50, 450)),
      buildTo: 3 + Math.floor(rng() * 3),
      mortgageToBuild: rng() < 0.5,
      auctionCeiling: Number(pick(0.5, 1.1).toFixed(2)),
      tradeInitiative: rng() < 0.5 ? 'targeted' : 'opportunistic',
      tradeAcceptBias: Math.round(pick(-100, 150)),
      riskTolerance: ['low', 'medium', 'high'][Math.floor(rng() * 3)],
    };
  }
  return { ...(PERSONALITIES[id] || PERSONALITIES.dumb) };
}
