/* =====================================================================
 * engine/utils.js - Shared helpers for deck and hand management
 *
 * REFACTORED to use shared constants and remove duplicate logic.
 * =================================================================== */

// Note: Ensure this relative path is correct for your project structure.
const GC = require('../shared/constants/gameConstants');

/* ────────────────────────────────────────────────────────────────────────
 * Core Deck and Dealing Functions
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Creates a standard double-six domino deck, fully shuffled.
 * @returns {Array<[number, number]>} - A shuffled array of 28 domino tiles.
 */
function newDeck() {
  // Create a mutable copy of the frozen DOMINO_SET from constants
  const deck = [...GC.DOMINO_SET];

  // Fisher-Yates shuffle algorithm
  for (let i = deck.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[randomIndex]] = [deck[randomIndex], deck[i]];
  }

  return deck;
}

/**
 * Creates a new shuffled deck and distributes tiles to all connected players in a room.
 * This function modifies the `hand` property of each player object directly.
 * @param {object} room - The game room object containing the players.
 */
function dealHands(room) {
  const players = room?.players;
  if (!players) return;

  const connectedPlayers = Object.values(players)
    .filter(player => player?.isConnected);

  if (connectedPlayers.length === 0) return;

  const deck = newDeck();
  let deckCursor = 0;

  connectedPlayers.forEach(player => {
    player.hand = deck.slice(deckCursor, deckCursor + GC.HAND_SIZE);
    deckCursor += GC.HAND_SIZE;
  });
}

/* ────────────────────────────────────────────────────────────────────────
 * Debug and Utility Functions (Kept for server-side logging)
 * ────────────────────────────────────────────────────────────────────── */

/** Calculates the total pip value of a hand. */
function calculateHandValue(hand) {
  // Note: Assumes DominoUtils (DU) is not available here, so we use a local sum.
  return hand.reduce((total, tile) => total + tile[0] + tile[1], 0);
}

function printDeck(deck) {
  console.log('Deck contents:');
  deck.forEach((tile, index) => {
    console.log(`${index + 1}: [${tile[0]}|${tile[1]}]`);
  });
}

function printHand(hand, playerName = 'Player') {
  console.log(`${playerName}'s hand (${hand.length} tiles, ${calculateHandValue(hand)} pips):`);
  hand.forEach((tile, index) => {
    console.log(`  ${index + 1}: [${tile[0]}|${tile[1]}]`);
  });
}

/* ────────────────────────────────────────────────────────────────────────
 * Exports
 * ────────────────────────────────────────────────────────────────────── */
module.exports = {
  // Core functions
  newDeck,
  dealHands,

  // Debug utilities
  printDeck,
  printHand,
};
