// engine/game.js
// ---------------------------------------------------------------------------
//  Core domino rules & helpers (mode-agnostic foundation)
// ---------------------------------------------------------------------------

const { dealHands } = require('./utils');

// Seat helpers
const turnOrder = [0, 1, 2, 3];
const nextSeat  = seat => turnOrder[(turnOrder.indexOf(seat) + 1) % 4];
const teamOf    = seat => seat % 2;

/* ────────────────────────────────────────────────────────────────────────
 * placeTile – validates and places a tile, seeding ends on the first move
 * ────────────────────────────────────────────────────────────────────── */
function placeTile(room, tile, sideHint) {
  let [a, b] = tile;
  let side   = sideHint;

  /* First tile of the round → seed the board instantly */
  if (room.board.length === 0) {
    room.board.push([a, b]);
    room.leftEnd  = a;
    room.rightEnd = b;
    return true;
  }

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

/* ────────────────────────────────────────────────────────────────────────
 * initNewRound – reset state, deal hands, choose opener, notify players
 * ────────────────────────────────────────────────────────────────────── */
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

  /* Deal 7 tiles to every connected seat */
  dealHands(room);

  /* Pick opener */
  let opener;
  if (room.isFirstRound) {
    const openerStr = Object.keys(room.players).find(s =>
      room.players[s] &&
      room.players[s].hand.some(([x, y]) => x === 6 && y === 6)
    );
    opener = openerStr !== undefined ? Number(openerStr) : 0;
    room.isFirstRound = false;            // flip the flag so this runs only once
  } else {
    opener = room.lastWinnerSeat ?? 0;    // fallback to seat 0 just in case
  }

  room.turn        = opener;
  room.turnStarter = opener;

  /* Send each player their hand */
  Object.values(room.players).forEach(p => {
    if (!p) return;
    io.to(p.socketId).emit('roundStart', {
      yourHand:     p.hand,
      startingSeat: opener,
      scores:       room.scores,
    });
  });

  /* Announce first turn */
  io.in(room.id).emit('turnChanged', opener);
}

/* --------------------------------------------------------------------- */
module.exports = {
  nextSeat,
  teamOf,
  placeTile,
  initNewRound,
};
