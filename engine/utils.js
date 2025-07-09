// engine/utils.js
// ---------------------------------------------------------------------------
//  Shared helpers – newDeck()   |   dealHands(room)
// ---------------------------------------------------------------------------

/** Return a shuffled double-six deck (28 tiles). */
function newDeck () {
  const deck = [];
  for (let hi = 0; hi <= 6; hi++) {
    for (let lo = hi; lo <= 6; lo++) deck.push([hi, lo]);
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * dealHands(room)
 * -------------------------------------------------------
 *  • draws a fresh deck
 *  • gives **every connected player** 7 tiles
 *    (skips empty seats or yet-to-connect players)
 */
function dealHands (room) {
  const deck = newDeck();
  let cursor = 0;

  Object.values(room.players)          // { 0: Player, 1: Player, 2: undefined, … }
        .filter(Boolean)               // keep only real Player instances
        .forEach(player => {
          player.hand = deck.slice(cursor, cursor + 7);
          cursor += 7;
        });
}

module.exports = { newDeck, dealHands };
