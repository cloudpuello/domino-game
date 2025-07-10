/* =====================================================================
 * engine/utils.js - Shared helpers for deck and hand management
 * =================================================================== */

/* ────────────────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────────────────── */
const MAX_PIP_VALUE = 6;
const TILES_PER_HAND = 7;
const TOTAL_TILES = 28;

/* ────────────────────────────────────────────────────────────────────────
 * newDeck - creates a shuffled double-six domino deck (28 tiles)
 * ────────────────────────────────────────────────────────────────────── */
function newDeck() {
  const deck = _createOrderedDeck();
  return _shuffleDeck(deck);
}

/* ────────────────────────────────────────────────────────────────────────
 * Private deck creation helpers
 * ────────────────────────────────────────────────────────────────────── */
function _createOrderedDeck() {
  const deck = [];
  for (let high = 0; high <= MAX_PIP_VALUE; high++) {
    for (let low = high; low <= MAX_PIP_VALUE; low++) {
      deck.push([high, low]);
    }
  }
  return deck;
}

function _shuffleDeck(deck) {
  // Fisher-Yates shuffle algorithm
  const shuffled = [...deck]; // Create a copy to avoid mutating original
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }
  
  return shuffled;
}

/* ────────────────────────────────────────────────────────────────────────
 * dealHands - distributes tiles to connected players
 * ────────────────────────────────────────────────────────────────────── */
function dealHands(roomOrPlayers) {
  const players = _extractPlayers(roomOrPlayers);
  if (!players) return;

  const connectedPlayers = _getConnectedPlayers(players);
  if (connectedPlayers.length === 0) return;

  const deck = newDeck();
  _distributeTiles(deck, connectedPlayers);
}

/* ────────────────────────────────────────────────────────────────────────
 * Private dealing helpers
 * ────────────────────────────────────────────────────────────────────── */
function _extractPlayers(roomOrPlayers) {
  // Handle both dealHands(room) and dealHands(room.players) signatures
  return roomOrPlayers?.players ?? roomOrPlayers;
}

function _getConnectedPlayers(players) {
  return Object.values(players)
    .filter(player => player && player.isConnected);
}

function _distributeTiles(deck, players) {
  let deckCursor = 0;
  
  players.forEach(player => {
    player.hand = deck.slice(deckCursor, deckCursor + TILES_PER_HAND);
    deckCursor += TILES_PER_HAND;
  });
}

/* ────────────────────────────────────────────────────────────────────────
 * Tile utility functions
 * ────────────────────────────────────────────────────────────────────── */
function tilesAreEqual(tile1, tile2) {
  const [a1, b1] = tile1;
  const [a2, b2] = tile2;
  return (a1 === a2 && b1 === b2) || (a1 === b2 && b1 === a2);
}

function getTileValue(tile) {
  const [a, b] = tile;
  return a + b;
}

function isDouble(tile) {
  const [a, b] = tile;
  return a === b;
}

function tileContainsPip(tile, pip) {
  const [a, b] = tile;
  return a === pip || b === pip;
}

/* ────────────────────────────────────────────────────────────────────────
 * Hand utility functions
 * ────────────────────────────────────────────────────────────────────── */
function calculateHandValue(hand) {
  return hand.reduce((total, tile) => total + getTileValue(tile), 0);
}

function findTileInHand(hand, targetTile) {
  return hand.findIndex(tile => tilesAreEqual(tile, targetTile));
}

function handContainsTile(hand, targetTile) {
  return findTileInHand(hand, targetTile) !== -1;
}

function removeTileFromHand(hand, targetTile) {
  const index = findTileInHand(hand, targetTile);
  if (index !== -1) {
    return hand.splice(index, 1)[0];
  }
  return null;
}

function getPlayableTiles(hand, leftEnd, rightEnd) {
  if (leftEnd === null && rightEnd === null) {
    // First move - only [6,6] is playable
    return hand.filter(tile => tile[0] === 6 && tile[1] === 6);
  }
  
  return hand.filter(tile => 
    tileContainsPip(tile, leftEnd) || tileContainsPip(tile, rightEnd)
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Deck validation functions
 * ────────────────────────────────────────────────────────────────────── */
function validateDeck(deck) {
  if (!Array.isArray(deck)) return false;
  if (deck.length !== TOTAL_TILES) return false;
  
  // Check for duplicates and valid tiles
  const tileStrings = new Set();
  for (const tile of deck) {
    if (!Array.isArray(tile) || tile.length !== 2) return false;
    
    const [a, b] = tile;
    if (a < 0 || a > MAX_PIP_VALUE || b < 0 || b > MAX_PIP_VALUE) return false;
    if (a > b) return false; // Tiles should be normalized (smaller first)
    
    const tileString = `${a},${b}`;
    if (tileStrings.has(tileString)) return false; // Duplicate found
    tileStrings.add(tileString);
  }
  
  return true;
}

function normalizeTile(tile) {
  const [a, b] = tile;
  return a <= b ? [a, b] : [b, a];
}

/* ────────────────────────────────────────────────────────────────────────
 * Debug and utility functions
 * ────────────────────────────────────────────────────────────────────── */
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
  
  // Tile utilities
  tilesAreEqual,
  getTileValue,
  isDouble,
  tileContainsPip,
  normalizeTile,
  
  // Hand utilities
  calculateHandValue,
  findTileInHand,
  handContainsTile,
  removeTileFromHand,
  getPlayableTiles,
  
  // Validation
  validateDeck,
  
  // Debug utilities
  printDeck,
  printHand,
  
  // Constants
  MAX_PIP_VALUE,
  TILES_PER_HAND,
  TOTAL_TILES,
};