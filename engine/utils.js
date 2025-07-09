// engine/utils.js
// ---------------------------------------------------------------------------
//  Small, reusable helpers (deck creation / shuffling / dealing)
// ---------------------------------------------------------------------------

function newDeck() {
  const deck = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      deck.push([i, j]);         // push tile [i|j]
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function dealHands(players) {
  const deck = newDeck();
  Object.values(players).forEach((p, idx) => {
    p.hand = deck.slice(idx * 7, idx * 7 + 7);
  });
}

module.exports = { newDeck, dealHands };
