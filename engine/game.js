// engine/game.js
// ---------------------------------------------------------------------------
//  Core domino board logic (we’ll expand this step-by-step)
// ---------------------------------------------------------------------------

const { dealHands } = require('./utils');

// Seat helpers (kept here for now)
const turnOrder = [0, 1, 2, 3];
const nextSeat  = seat => turnOrder[(turnOrder.indexOf(seat) + 1) % 4];
const teamOf    = seat => seat % 2;

/**
 * placeTile(room, tile, sideHint)
 * Adds a tile to either end if it fits. Returns true on success, false if illegal.
 */
function placeTile(room, tile, sideHint) {
  let [a, b] = tile;
  let side   = sideHint;   // 'left' or 'right' (or undefined when first play)

  const fitsLeft  = a === room.leftEnd  || b === room.leftEnd;
  const fitsRight = a === room.rightEnd || b === room.rightEnd;

  // Reject if it fits nowhere
  if (!fitsLeft && !fitsRight) return false;

  // Auto-decide side if not supplied
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
  } else {                    // side === 'right'
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

module.exports = {
  nextSeat,
  teamOf,
  placeTile,
  dealHands,     // we’ll use this later in initNewRound
};
