/* =====================================================================
 * engine/game.js - Core domino rules & helpers (mode-agnostic foundation)
 * =================================================================== */

const { dealHands } = require('./utils');

/* ────────────────────────────────────────────────────────────────────────
 * Constants and helpers
 * ────────────────────────────────────────────────────────────────────── */
const TURN_ORDER = [0, 1, 2, 3];
const OPENING_TILE = [6, 6];
const HAND_SIZE = 7;

const nextSeat = seat => TURN_ORDER[(TURN_ORDER.indexOf(seat) + 1) % 4];
const teamOf = seat => seat % 2;

/* ────────────────────────────────────────────────────────────────────────
 * placeTile – validates and places a tile, seeding ends on the first move
 * ────────────────────────────────────────────────────────────────────── */
function placeTile(room, tile, sideHint) {
  const [a, b] = tile;
  let side = sideHint;

  /* First tile of the round → seed the board instantly */
  if (room.board.length === 0) {
    room.board.push([a, b]);
    room.leftEnd = a;
    room.rightEnd = b;
    return true;
  }

  /* Check if tile fits on either end */
  const fitsLeft = (a === room.leftEnd || b === room.leftEnd);
  const fitsRight = (a === room.rightEnd || b === room.rightEnd);
  
  if (!fitsLeft && !fitsRight) {
    return false;
  }

  /* Auto-determine side if not specified */
  if (!side) {
    side = fitsRight ? 'right' : 'left';
  }

  /* Place tile on the specified side */
  if (side === 'left') {
    return _placeTileOnLeft(room, tile, a, b);
  } else {
    return _placeTileOnRight(room, tile, a, b);
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * Private helper functions for tile placement
 * ────────────────────────────────────────────────────────────────────── */
function _placeTileOnLeft(room, tile, a, b) {
  const fitsLeft = (a === room.leftEnd || b === room.leftEnd);
  if (!fitsLeft) return false;

  if (a === room.leftEnd) {
    room.board.unshift([b, a]);
    room.leftEnd = b;
  } else {
    room.board.unshift([a, b]);
    room.leftEnd = a;
  }
  return true;
}

function _placeTileOnRight(room, tile, a, b) {
  const fitsRight = (a === room.rightEnd || b === room.rightEnd);
  if (!fitsRight) return false;

  if (a === room.rightEnd) {
    room.board.push([a, b]);
    room.rightEnd = b;
  } else {
    room.board.push([b, a]);
    room.rightEnd = a;
  }
  return true;
}

/* ────────────────────────────────────────────────────────────────────────
 * initNewRound – reset state, deal hands, choose opener, notify players
 * ────────────────────────────────────────────────────────────────────── */
function initNewRound(room, io) {
  _resetRoundState(room);
  _dealHandsToPlayers(room);
  
  const opener = _determineOpener(room);
  _setOpener(room, opener);
  
  _notifyPlayersRoundStart(room, io, opener);
  _announceTurn(room, io, opener);
}

/* ────────────────────────────────────────────────────────────────────────
 * Private helper functions for round initialization
 * ────────────────────────────────────────────────────────────────────── */
function _resetRoundState(room) {
  Object.assign(room, {
    board: [],
    leftEnd: null,
    rightEnd: null,
    pipCounts: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    turn: null,
    turnStarter: null,
    lastMoverSeat: null,
    passCount: 0,
    isRoundOver: false,
  });
}

function _dealHandsToPlayers(room) {
  dealHands(room);
}

function _determineOpener(room) {
  if (room.isFirstRound) {
    const openerSeat = _findPlayerWithOpeningTile(room);
    room.isFirstRound = false;
    return openerSeat;
  } else {
    return room.lastWinnerSeat ?? 0;
  }
}

function _findPlayerWithOpeningTile(room) {
  const openerSeatStr = Object.keys(room.players).find(seat =>
    room.players[seat] &&
    room.players[seat].hand.some(([x, y]) => 
      x === OPENING_TILE[0] && y === OPENING_TILE[1]
    )
  );
  return openerSeatStr !== undefined ? Number(openerSeatStr) : 0;
}

function _setOpener(room, opener) {
  room.turn = opener;
  room.turnStarter = opener;
}

function _notifyPlayersRoundStart(room, io, opener) {
  Object.values(room.players).forEach(player => {
    if (!player || !player.isConnected) return;
    
    io.to(player.socketId).emit('roundStart', {
      yourHand: player.hand,
      startingSeat: opener,
      scores: room.scores,
    });
  });
}

function _announceTurn(room, io, opener) {
  io.in(room.id).emit('turnChanged', opener);
}

/* ────────────────────────────────────────────────────────────────────────
 * Validation helpers
 * ────────────────────────────────────────────────────────────────────── */
function canPlayTile(tile, leftEnd, rightEnd) {
  if (leftEnd === null && rightEnd === null) {
    // First move must be opening tile
    const [a, b] = tile;
    return a === OPENING_TILE[0] && b === OPENING_TILE[1];
  }
  
  const [a, b] = tile;
  return (a === leftEnd || b === leftEnd || a === rightEnd || b === rightEnd);
}

function isValidFirstMove(tile) {
  const [a, b] = tile;
  return a === OPENING_TILE[0] && b === OPENING_TILE[1];
}

/* ────────────────────────────────────────────────────────────────────────
 * Board state helpers
 * ────────────────────────────────────────────────────────────────────── */
function getBoardEnds(room) {
  if (room.board.length === 0) {
    return { left: null, right: null };
  }
  
  return {
    left: room.leftEnd,
    right: room.rightEnd
  };
}

function isBoardEmpty(room) {
  return room.board.length === 0;
}

/* ────────────────────────────────────────────────────────────────────────
 * Game state helpers
 * ────────────────────────────────────────────────────────────────────── */
function isFirstRound(room) {
  return room.isFirstRound;
}

function getCurrentTurn(room) {
  return room.turn;
}

function getLastMover(room) {
  return room.lastMoverSeat;
}

/* ────────────────────────────────────────────────────────────────────────
 * Exports
 * ────────────────────────────────────────────────────────────────────── */
module.exports = {
  // Core game functions
  nextSeat,
  teamOf,
  placeTile,
  initNewRound,
  
  // Validation helpers
  canPlayTile,
  isValidFirstMove,
  
  // Board state helpers
  getBoardEnds,
  isBoardEmpty,
  
  // Game state helpers
  isFirstRound,
  getCurrentTurn,
  getLastMover,
  
  // Constants
  TURN_ORDER,
  OPENING_TILE,
  HAND_SIZE,
};