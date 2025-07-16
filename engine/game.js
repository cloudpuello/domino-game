/* =====================================================================
 * engine/game.js - Dominican Domino Game Engine
 *
 * IMPLEMENTS PROPER DOMINICAN RULES:
 * - Counter-clockwise turn order
 * - First round must start with [6|6]
 * - Subsequent rounds winner opens with any tile
 * - Capicú, Paso, and right-hand block bonuses
 * - Proper tranca (blocked board) detection
 * =================================================================== */

const { dealHands } = require('./utils');
const GC = require('../shared/constants/gameConstants');
const DU = require('../shared/utils/dominoUtils');

/* ────────────────────────────────────────────────────────────────────────
 * Core Game Functions
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Validates and places a tile on the board following Dominican rules
 */
function placeTile(room, tile, sideHint) {
  console.log(`[Dominican Engine] Player ${room.turn} attempting to place [${tile}] on ${sideHint}`);
  
  // First move validation
  if (room.board.length === 0) {
    // First round: Must be [6|6]
    if (room.isFirstRound && !DU.sameTile(tile, GC.FIRST_TILE)) {
      console.log(`[Dominican Engine] First round requires [${GC.FIRST_TILE}], got [${tile}]`);
      return false;
    }
    
    // Subsequent rounds: Winner can play any tile
    room.board.push([...tile]);
    room.leftEnd = tile[0];
    room.rightEnd = tile[1];
    room.lastPlayedTile = tile;
    room.lastPlayedSeat = room.turn;
    
    // IMPORTANT: Only reset first round flag after successful first move
    if (room.isFirstRound) {
      room.isFirstRound = false;
      console.log(`[Dominican Engine] First round flag reset after successful [6|6] placement`);
    }
    
    console.log(`[Dominican Engine] Opening tile [${tile}] placed`);
    return true;
  }

  // Regular move validation
  const playableSides = DU.playableSides(tile, room.board);
  if (playableSides.length === 0) {
    console.log(`[Dominican Engine] Tile [${tile}] not playable on current board`);
    return false;
  }

  // Determine side
  const side = sideHint || (playableSides.length === 1 ? playableSides[0] : null);
  if (!side) {
    console.warn(`[Dominican Engine] Ambiguous play for tile [${tile}] without side hint`);
    return false;
  }

  // Place tile
  const valueToMatch = (side === 'left') ? room.leftEnd : room.rightEnd;
  const finalTile = _orientTile(tile, valueToMatch, side);

  if (side === 'left') {
    room.board.unshift(finalTile);
    room.leftEnd = finalTile[0];
  } else {
    room.board.push(finalTile);
    room.rightEnd = finalTile[1];
  }

  room.lastPlayedTile = tile;
  room.lastPlayedSeat = room.turn;
  room.passCount = 0; // Reset pass count on successful play
  
  console.log(`[Dominican Engine] Tile [${tile}] placed on ${side}, board now: ${room.board.length} tiles`);
  return true;
}

/**
 * Initialize a new round following Dominican rules
 */
function initNewRound(room, io) {
  console.log(`[Dominican Engine] Starting new round for room ${room.id}`);
  
  _resetRoundState(room);
  dealHands(room);
  
  // Determine opener
  const opener = _determineOpener(room);
  room.turn = opener;
  room.turnStarter = opener;
  
  console.log(`[Dominican Engine] Round opener: Seat ${opener}`);
  
  _notifyPlayersRoundStart(room, io, opener);
  io.in(room.id).emit('turnChanged', opener);
}

/**
 * Handle player pass - Dominican rules: no drawing, just pass
 */
function handlePass(room, seat) {
  console.log(`[Dominican Engine] Player ${seat} passed`);
  
  room.passCount++;
  room.lastPassSeat = seat;
  
  // Check for tranca (blocked board)
  if (room.passCount >= 4) {
    console.log(`[Dominican Engine] Tranca detected - all players passed`);
    return { tranca: true };
  }
  
  return { tranca: false };
}

/**
 * Check if round is over and calculate scoring
 */
function checkRoundEnd(room) {
  const currentPlayer = room.players[room.turn];
  
  // Check if current player emptied their hand
  if (currentPlayer && currentPlayer.hand.length === 0) {
    console.log(`[Dominican Engine] Player ${room.turn} emptied their hand`);
    
    const scoring = _calculateDominoScoring(room);
    return {
      ended: true,
      reason: scoring.reason,
      winner: room.turn,
      points: scoring.points,
      details: scoring.details
    };
  }
  
  // Check for tranca
  if (room.passCount >= 4) {
    console.log(`[Dominican Engine] Tranca - blocked board`);
    
    const scoring = _calculateTrancaScoring(room);
    return {
      ended: true,
      reason: GC.END_REASONS.TRANCA,
      winner: scoring.winner,
      points: scoring.points,
      details: scoring.details
    };
  }
  
  return { ended: false };
}

/**
 * Broadcast move to all players
 */
function emitBroadcastMove(io, room, seat, tile) {
  const handSizes = Object.fromEntries(
    Object.entries(room.players)
      .filter(([, player]) => player)
      .map(([s, p]) => [s, p.hand.length])
  );

  console.log(`[Dominican Engine] Broadcasting move: Player ${seat} played [${tile}]`);

  io.in(room.id).emit('broadcastMove', {
    seat,
    tile,
    boardState: room.board,
    handSizes,
    leftEnd: room.leftEnd,
    rightEnd: room.rightEnd
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
    lastPlayedTile: null,
    lastPlayedSeat: null,
    lastPassSeat: null,
    passCount: 0,
    isRoundOver: false,
  });
}

function _orientTile(tile, valueToMatch, side) {
  if (side === 'left') {
    return (tile[0] === valueToMatch) ? DU.flipped(tile) : [...tile];
  } else {
    return (tile[1] === valueToMatch) ? DU.flipped(tile) : [...tile];
  }
}

function _determineOpener(room) {
  if (room.isFirstRound) {
    // First round: Player with [6|6] must open
    room.isFirstRound = false;
    return _findPlayerWithOpeningTile(room);
  } else {
    // Subsequent rounds: Winner of previous round opens
    return room.lastWinnerSeat ?? GC.SEAT_ORDER[0];
  }
}

function _findPlayerWithOpeningTile(room) {
  for (const [seatStr, player] of Object.entries(room.players)) {
    if (player && player.hand && player.hand.some(tile => DU.sameTile(tile, GC.FIRST_TILE))) {
      return Number(seatStr);
    }
  }
  return GC.SEAT_ORDER[0]; // Fallback
}

function _notifyPlayersRoundStart(room, io, opener) {
  const handSizes = Object.fromEntries(
    Object.entries(room.players)
      .filter(([, player]) => player)
      .map(([seat, player]) => [seat, player.hand ? player.hand.length : 0])
  );

  console.log(`[Dominican Engine] Notifying players of round start. Opener: ${opener}`);

  Object.values(room.players).forEach(player => {
    if (player && player.isConnected && player.hand) {
      const payload = {
        yourHand: player.hand,
        startingSeat: opener,
        scores: room.scores,
        handSizes: handSizes,
        isFirstRound: room.isFirstRound, // Pass the first round flag
        gameRules: 'dominican'
      };
      
      console.log(`[Dominican Engine] Sending roundStart to ${player.name} (seat ${player.seat}). First round: ${room.isFirstRound}`);
      
      io.to(player.socketId).emit('roundStart', payload);
    }
  });
}

/**
 * Calculate scoring when a player empties their hand (domino)
 */
function _calculateDominoScoring(room) {
  const winner = room.turn;
  const nextPlayer = GC.nextSeat(winner);
  const lastTile = room.lastPlayedTile;
  
  // Calculate total pips in all hands
  let totalPips = 0;
  Object.values(room.players).forEach(player => {
    if (player && player.hand) {
      totalPips += GC.calculatePips(player.hand);
    }
  });
  
  let bonus = 0;
  let reason = GC.END_REASONS.DOMINO;
  let details = [];
  
  // Check for Capicú (last tile connects both ends)
  if (_isCapicu(room, lastTile)) {
    bonus += GC.SCORING.CAPICU;
    details.push('Capicú (+30)');
  }
  
  // Check for Paso (no one can respond)
  if (_isPaso(room, winner)) {
    bonus += GC.SCORING.PASO;
    details.push('Paso (+30)');
  }
  
  // Update reason based on bonuses
  if (bonus === GC.SCORING.CAPICU) {
    reason = GC.END_REASONS.CAPICU;
  } else if (bonus === GC.SCORING.PASO) {
    reason = GC.END_REASONS.PASO;
  } else if (bonus === GC.SCORING.CAPICU_PASO) {
    reason = GC.END_REASONS.CAPICU_PASO;
  }
  
  const totalPoints = totalPips + bonus;
  
  return {
    reason,
    points: totalPoints,
    details: details.concat([`Pips: ${totalPips}`, `Bonus: ${bonus}`, `Total: ${totalPoints}`])
  };
}

/**
 * Calculate scoring for tranca (blocked board)
 */
function _calculateTrancaScoring(room) {
  const lastPlayer = room.lastPlayedSeat;
  const nextPlayer = GC.nextSeat(lastPlayer);
  
  // Calculate pip totals for each player
  const pipTotals = {};
  Object.values(room.players).forEach(player => {
    if (player && player.hand) {
      pipTotals[player.seat] = GC.calculatePips(player.hand);
    }
  });
  
  const lastPlayerPips = pipTotals[lastPlayer] || 0;
  const nextPlayerPips = pipTotals[nextPlayer] || 0;
  
  // Winner is the one with fewer pips
  const winner = lastPlayerPips <= nextPlayerPips ? lastPlayer : nextPlayer;
  
  // Points = sum of all pips
  const totalPips = Object.values(pipTotals).reduce((sum, pips) => sum + pips, 0);
  
  return {
    winner,
    points: totalPips,
    details: [
      `Tranca: ${lastPlayer} (${lastPlayerPips}) vs ${nextPlayer} (${nextPlayerPips})`,
      `Winner: ${winner}`,
      `Total pips: ${totalPips}`
    ]
  };
}

/**
 * Check if last play was Capicú (connects both ends)
 */
function _isCapicu(room, tile) {
  if (room.board.length < 2) return false;
  
  const leftEnd = room.leftEnd;
  const rightEnd = room.rightEnd;
  
  // Capicú: last tile connects both ends and ends were different
  return leftEnd !== rightEnd && tile.includes(leftEnd) && tile.includes(rightEnd);
}

/**
 * Check if last play was Paso (no one can respond)
 */
function _isPaso(room, winner) {
  const leftEnd = room.leftEnd;
  const rightEnd = room.rightEnd;
  
  // Check if any other player can play
  for (const [seat, player] of Object.entries(room.players)) {
    if (Number(seat) !== winner && player && player.hand) {
      const canPlay = player.hand.some(tile => 
        tile.includes(leftEnd) || tile.includes(rightEnd)
      );
      if (canPlay) return false;
    }
  }
  
  return true;
}

/* ────────────────────────────────────────────────────────────────────────
 * Exports
 * ────────────────────────────────────────────────────────────────────── */
module.exports = {
  placeTile,
  initNewRound,
  handlePass,
  checkRoundEnd,
  emitBroadcastMove,
  
  // Dominican turn order helper
  nextSeat: GC.nextSeat,
  teamOf: GC.TEAM_OF_SEAT,
};