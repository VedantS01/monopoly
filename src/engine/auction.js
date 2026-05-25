import { getSpace } from './board.js';
import { playerById } from './state.js';
import { log } from './rules.js';

export function startAuction(state, pos) {
  const bidders = state.players.filter((p) => !p.bankrupt).map((p) => p.id);
  state.pending.auction = {
    pos,
    bidders,
    currentBidderIndex: 0,
    highBid: 0,
    highBidderId: null,
  };
  state.phase = 'auction';
  log(state, `Auction started for ${getSpace(pos).name}.`);
}

function nextBidder(auction) {
  auction.currentBidderIndex = (auction.currentBidderIndex + 1) % auction.bidders.length;
}

function settle(state) {
  const a = state.pending.auction;
  const space = getSpace(a.pos);
  if (a.highBidderId != null) {
    const winner = playerById(state, a.highBidderId);
    winner.money -= a.highBid;
    state.properties[a.pos].ownerId = winner.id;
    log(state, `${winner.name} won ${space.name} for $${a.highBid}.`);
  } else {
    log(state, `${space.name} received no bids and stays unowned.`);
  }
  delete state.pending.auction;
  state.phase = 'manage';
}

export function auctionBid(state, amount) {
  const a = state.pending.auction;
  const bidderId = a.bidders[a.currentBidderIndex];
  const bidder = playerById(state, bidderId);
  if (amount <= a.highBid || amount > bidder.money) return;
  a.highBid = amount;
  a.highBidderId = bidderId;
  log(state, `${bidder.name} bids $${amount}.`);
  nextBidder(a);
}

export function auctionPass(state) {
  const a = state.pending.auction;
  const idx = a.currentBidderIndex;
  const passerId = a.bidders[idx];
  log(state, `${playerById(state, passerId).name} passes.`);
  a.bidders.splice(idx, 1);
  if (a.bidders.length === 0) { settle(state); return; }
  if (a.currentBidderIndex >= a.bidders.length) a.currentBidderIndex = 0;
  if (a.bidders.length === 1 && a.highBidderId === a.bidders[0]) { settle(state); return; }
  // a single remaining bidder who has not yet bid may still bid or pass
}
