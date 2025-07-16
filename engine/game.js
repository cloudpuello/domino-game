/* =====================================================================
 * engine/game.js - Core domino rules & helpers (mode-agnostic foundation)
 *
 * REFACTORED to use shared constants and utilities.
 * =================================================================== */

// Note: Ensure this relative path is correct for your project structure.
const { dealHands } = require('./utils');
const GC = require('../shared/constants/gameConstants'); // GameConstants
const DU = require('../shared/utils/dominoUtils');      // DominoUtils

/* ────────────────────────────────────────────────────────────────────────
 * Core Game Functions
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Validates and places a tile on the board.
 * Flips the tile if necessary and updates the board's exposed ends.
 * @returns {boolean} - True if the placement was successful.
 */
function placeTile(room, tile, sideHint) {
  // On the first move, the board is seeded directly.
  if (room.board.length === 0) {
    if (!DU.sameTile(tile, GC.FIRST_TILE)) return false; // Must start with the designated tile
    room.board.push([...tile]); // Use a copy
    room.leftEnd = tile[0];
    room.rightEnd = tile[1];
    return true;
  }

  const playableSides = DU.playableSides(tile, room.board);
  if (playableSides.length === 0) {
    return false; // Not a legal move
  }

  // If a side is specified, use it. Otherwise, auto-pick if there's only one option.
  const side = sideHint || (playableSides.length === 1 ? playableSides[0] : null);
  if (!side) {
    // This case should be handled by the client prompting the user.
    // Server should ideally receive an explicit side when ambiguous.
    console.warn(`[Game Engine] Ambiguous play received for tile [${tile}] without a side hint. Rejecting move.`);
    return false;
  }

  const valueToMatch = (side === 'left') ? room.leftEnd : room.rightEnd;
  const finalTile = _orientTile(tile, valueToMatch, side);

  if (side === 'left') {
    room.board.unshift(finalTile);
    room.leftEnd = finalTile[0];
  } else { // side === 'right'
    room.board.push(finalTile);
    room.rightEnd = finalTile[1];
  }

  return true;
}


/**
 * Resets the board state, deals new hands, finds the opening player,
 * and notifies all players that a new round has begun.
 */
function initNewRound(room, io) {
  _resetRoundState(room);
  dealHands(room); // Assumes dealHands populates room.players[seat].hand

  const opener = _determineOpener(room);
  room.turn = opener;
  room.turnStarter = opener;

  _notifyPlayersRoundStart(room, io, opener);
  io.in(room.id).emit('turnChanged', opener);
}

/**
 * AI NOTE: This new function centralizes the broadcasting of a move.
 * It constructs the full payload, including the new `boardState` key and
 * the `handSizes` object, that the client-side GameManager expects.
 */
function emitBroadcastMove(io, room, seat, tile) {
    const handSizes = Object.fromEntries(
      Object.entries(room.players)
            .filter(([, player]) => player)
            .map(([s, p]) => [s, p.hand.length])
    );

    io.in(room.id).emit('broadcastMove', {
      seat,                   // who made the move
      tile,                   // the tile played
      boardState: room.board,     // NEW key name
      handSizes                   // NEW – keeps counts in sync
    });
}


/* ────────────────────────────────────────────────────────────────────────
 * Private Helper Functions
 * ────────────────────────────────────────────────────────────────────── */

function _resetRoundState(room) {
  Object.assign(room, {
    board: [],
    leftEnd: null,
    rightEnd: null,
    turn: null,
    turnStarter: null,
    lastMoverSeat: null,
    passCount: 0,
    isRoundOver: false,
  });
}

/** Flips a tile if needed to ensure its connecting value is on the correct edge. */
function _orientTile(tile, valueToMatch, side) {
    if (side === 'left') {
        // For the left side, the matching value must end up on the right of the new tile.
        return (tile[0] === valueToMatch) ? DU.flipped(tile) : [...tile];
    } else { // side === 'right'
        // For the right side, the matching value must end up on the left of the new tile.
        return (tile[1] === valueToMatch) ? DU.flipped(tile) : [...tile];
    }
}

function _determineOpener(room) {
  // First round of the entire game is opened by the player with the double-six.
  if (room.isFirstRound) {
    room.isFirstRound = false;
    const openerSeat = _findPlayerWithOpeningTile(room);
    return openerSeat;
  }
  // Subsequent rounds are opened by the winner of the previous round.
  return room.lastWinnerSeat ?? GC.SEAT_ORDER[0]; // Default to seat 0 if no winner yet
}

function _findPlayerWithOpeningTile(room) {
  const openerSeatStr = Object.keys(room.players).find(seat =>
    room.players[seat]?.hand.some(tile => DU.sameTile(tile, GC.FIRST_TILE))
  );
  return openerSeatStr !== undefined ? Number(openerSeatStr) : GC.SEAT_ORDER[0]; // Default to seat 0
}

/**
 * AI NOTE: This function now correctly constructs and includes the `handSizes`
 * object in the 'roundStart' payload, which is required by the client's
 * GameManager to properly render opponent hand counts.
 */
function _notifyPlayersRoundStart(room, io, opener) {
  // Create an object mapping each seat to its hand size.
  const handSizes = Object.fromEntries(
    Object.entries(room.players)
          .filter(([, player]) => player) // Ensure player object exists
          .map(([seat, player]) => [seat, player.hand.length])
  );

  Object.values(room.players).forEach(player => {
    if (!player?.isConnected) return;

    io.to(player.socketId).emit('roundStart', {
      yourHand: player.hand,
      startingSeat: opener,
      scores: room.scores,
      handSizes: handSizes, // FIXED: Added the missing handSizes object
    });
  });
}

/* ────────────────────────────────────────────────────────────────────────
 * Exports
 * ────────────────────────────────────────────────────────────────────── */
module.exports = {
  // Core game functions
  placeTile,
  initNewRound,
  emitBroadcastMove, // NEWLY EXPORTED

  // Simple helpers that can be useful elsewhere
  nextSeat: (seat) => GC.SEAT_ORDER[(GC.SEAT_ORDER.indexOf(seat) + 1) % 4],
  teamOf: (seat) => seat % 2,
};
