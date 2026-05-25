import { playerById } from './state.js';
import { log } from './rules.js';

export function declareBankruptcy(state) {
  const debt = state.pending.debt;
  if (!debt) return;
  const debtor = playerById(state, debt.debtorId);
  const creditor = debt.creditorId != null ? playerById(state, debt.creditorId) : null;

  for (const pos in state.properties) {
    const prop = state.properties[pos];
    if (prop.ownerId !== debtor.id) continue;
    if (creditor) {
      prop.ownerId = creditor.id; // mortgaged status carries over
    } else {
      if (prop.houses === 5) { state.bank.hotels += 1; }
      else { state.bank.houses += prop.houses; }
      prop.houses = 0;
      prop.ownerId = null;
      prop.mortgaged = false;
    }
  }
  if (creditor && debtor.money > 0) creditor.money += debtor.money;
  if (creditor) creditor.getOutCards += debtor.getOutCards;
  debtor.money = 0;
  debtor.getOutCards = 0;
  debtor.bankrupt = true;
  log(state, `${debtor.name} went bankrupt.`);
  delete state.pending.debt;

  const solvent = state.players.filter((p) => !p.bankrupt);
  if (solvent.length === 1) {
    state.winnerId = solvent[0].id;
    state.phase = 'game-over';
    log(state, `${solvent[0].name} wins the game!`);
  } else {
    state.phase = 'manage';
  }
}
