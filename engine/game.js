// engine/game.js
// ---------------------------------------------------------------------------
//  Core domino rules & helpers (mode-agnostic foundation)
// ---------------------------------------------------------------------------

const { dealHands } = require('./utils');

// Seat helpers
const turnOrder = [0, 1, 2, 3];
const nextSeat  = seat => turnOrder[(turnOrder.indexOf(seat) + 1) % 4];
const teamOf    = seat => seat % 2;

/**
 * placeTile(room, tile, sideHint)
 *   Adds a tile to either end if it fits.
 *   Returns true on success, false if illegal.
 */
function placeTile(room, tile, sideHint) {
  let [a, b] = tile;
  let side   = sideHint;                        // 'left' | 'right' | undefined

  const fitsLeft  = a === room.leftEnd  || b === room.leftEnd;
  const fitsRight = a === room.rightEnd || b === room.rightEnd;
  if (!fitsLeft && !fitsRight) return false;

  if (!side) side = fitsRight ? 'right' : 'left';

  if (side === 'left') {
    if (!fitsLeft) return false;
    if (a === room.leftEnd) {
      room.board.unshift([b, a]);
      room.leftEnd = b;
    } else {
      room.board.unshift([a, b]);
      room.leftEnd = a;
    }
  } else {
    if (!fitsRight) return false;
    if (a === room.rightEnd) {
      room.board.push([a, b]);
      room.rightEnd = b;
    } else {
      room.board.push([b, a]);
      room.rightEnd = a;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
//  initNewRound  – resets room state, deals hands, notifies players
// ---------------------------------------------------------------------------
function initNewRound(room, io) {
  Object.assign(room, {
    board: [],
    leftEnd: null,
    rightEnd: null,
    pipCounts: { 0:0,1:0,2:0,3:0,4:0,5:0,6:0 },
    turn: null,
    turnStarter: null,
    lastMoverSeat: null,
    passCount: 0,
    isRoundOver: false,
  });

 dealHands(room);

  let opener;
  if (room.isFirstRound) {
    opener = +Object.keys(room.players).find(s =>
      room.players[s].hand.some(([a, b]) => a === 6 && b === 6)
    );
    if (opener === undefined) opener = 0;
  } else {
    opener = room.lastWinnerSeat;
  }

  room.turn        = opener;
  room.turnStarter = opener;

  // Send each player their hand
  Object.values(room.players).forEach(p => {
    io.to(p.socketId).emit('roundStart', {
      yourHand: p.hand,
      startingSeat: opener,
      scores: room.scores,
    });
  });

  // Announce first turn
  io.in(room.id).emit('turnChanged', opener);
}

// ---------------------------------------------------------------------------
module.exports = {
  nextSeat,
  teamOf,
  placeTile,
  dealHands,     // (exported for convenience)
  initNewRound,  // <-- new export
};
