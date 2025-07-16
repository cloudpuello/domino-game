/* =====================================================================
 * engine/utils.js - Shared helpers for deck and hand management
 *
 * CRITICAL FIXES:
 * - Added comprehensive logging for hand dealing
 * - Fixed dealHands to ensure all players get proper hands
 * - Added validation for hand dealing
 * - Better error handling
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
  
  console.log(`[Utils] Created deck with ${deck.length} tiles`);

  // Fisher-Yates shuffle algorithm
  for (let i = deck.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[randomIndex]] = [deck[randomIndex], deck[i]];
  }

  console.log(`[Utils] Deck shuffled. First few tiles:`, deck.slice(0, 5));
  return deck;
}

/**
 * FIXED: Creates a new shuffled deck and distributes tiles with validation
 */
function dealHands(room) {
  console.log(`[Utils] Starting Dominican hand dealing for room ${room.id}`);
  
  const players = room?.players;
  if (!players) {
    console.error(`[Utils] No players object found in room`);
    return;
  }

  const connectedPlayers = Object.values(players)
    .filter(player => {
      const isConnected = player?.isConnected || player?.connected;
      if (player && !isConnected) {
        console.log(`[Utils] Skipping disconnected player ${player.name}`);
      }
      return player && isConnected;
    });

  console.log(`[Utils] Found ${connectedPlayers.length} connected players`);

  if (connectedPlayers.length === 0) {
    console.error(`[Utils] No connected players found!`);
    return;
  }

  // Create and validate deck
  const deck = newDeck();
  
  // CRITICAL: Validate deck has exactly one [6|6]
  const doubleSixTiles = deck.filter(tile => tile[0] === 6 && tile[1] === 6);
  if (doubleSixTiles.length !== 1) {
    console.error(`[Utils] CRITICAL ERROR: Deck has ${doubleSixTiles.length} [6|6] tiles, should have exactly 1!`);
    console.error(`[Utils] Double-six tiles found:`, doubleSixTiles);
    return;
  }
  
  console.log(`[Utils] ✓ Deck validation passed: Found exactly 1 [6|6] tile`);
  
  let deckCursor = 0;

  // Deal hands to each connected player
  connectedPlayers.forEach((player, index) => {
    const handStart = deckCursor;
    const handEnd = deckCursor + GC.HAND_SIZE;
    
    if (handEnd > deck.length) {
      console.error(`[Utils] Not enough tiles in deck! Need ${handEnd}, have ${deck.length}`);
      return;
    }

    player.hand = deck.slice(handStart, handEnd);
    deckCursor = handEnd;

    console.log(`[Utils] Dealt ${player.hand.length} tiles to ${player.name} (seat ${player.seat})`);
    
    // Check if this player got the [6|6]
    const hasDoubleSix = player.hand.some(tile => tile[0] === 6 && tile[1] === 6);
    if (hasDoubleSix) {
      console.log(`[Utils] ✓ Player ${player.name} (seat ${player.seat}) received [6|6]`);
    }
    
    // Verify the hand has the expected tiles
    if (player.hand.length !== GC.HAND_SIZE) {
      console.error(`[Utils] ERROR: Player ${player.name} has ${player.hand.length} tiles, expected ${GC.HAND_SIZE}`);
    }
  });

  console.log(`[Utils] Hand dealing completed. Used ${deckCursor} tiles from deck of ${deck.length}`);
  
  // POST-DEAL VALIDATION: Verify exactly one player has [6|6]
  const playersWithDoubleSix = connectedPlayers.filter(player => 
    player.hand && player.hand.some(tile => tile[0] === 6 && tile[1] === 6)
  );
  
  if (playersWithDoubleSix.length !== 1) {
    console.error(`[Utils] CRITICAL ERROR: ${playersWithDoubleSix.length} players have [6|6], should be exactly 1!`);
    playersWithDoubleSix.forEach(player => {
      console.error(`[Utils] Player ${player.name} (seat ${player.seat}) has [6|6]`);
    });
  } else {
    const doubleSixPlayer = playersWithDoubleSix[0];
    console.log(`[Utils] ✓ POST-DEAL VALIDATION: Only ${doubleSixPlayer.name} (seat ${doubleSixPlayer.seat}) has [6|6]`);
  }
  
  // Verify all players have hands
  Object.values(players).forEach(player => {
    if (player && (player.isConnected || player.connected)) {
      if (!player.hand || player.hand.length === 0) {
        console.error(`[Utils] CRITICAL: Player ${player.name} has no hand after dealing!`);
      } else {
        console.log(`[Utils] ✓ Player ${player.name} has ${player.hand.length} tiles`);
      }
    }
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

/**
 * ADDED: Verify that all players in a room have proper hands
 */
function verifyHandsDealt(room) {
  console.log(`[Utils] Verifying hands for room ${room.id}`);
  
  const players = Object.values(room.players).filter(p => p && (p.isConnected || p.connected));
  let allHandsValid = true;
  
  players.forEach(player => {
    if (!player.hand || player.hand.length !== GC.HAND_SIZE) {
      console.error(`[Utils] Invalid hand for ${player.name}: ${player.hand ? player.hand.length : 'undefined'} tiles`);
      allHandsValid = false;
    }
  });
  
  if (allHandsValid) {
    console.log(`[Utils] ✓ All ${players.length} players have valid hands`);
  } else {
    console.error(`[Utils] ✗ Some players have invalid hands!`);
  }
  
  return allHandsValid;
}

/* ────────────────────────────────────────────────────────────────────────
 * Exports
 * ────────────────────────────────────────────────────────────────────── */
module.exports = {
  // Core functions
  newDeck,
  dealHands,
  verifyHandsDealt,

  // Debug utilities
  printDeck,
  printHand,
  calculateHandValue,
};