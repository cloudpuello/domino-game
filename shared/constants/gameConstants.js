/* =====================================================================
 * shared/constants/gameConstants.js
 *
 * AI NOTES ‑ WHY THIS EXISTS
 * ---------------------------------------------------------------------
 * • “One source of truth” for numbers / strings that are referenced by
 *   *both* the browser code and the Node.js server (room logic, tests…).
 * • Absolutely **no** live logic here – just frozen data.
 * • Written in a tiny UMD wrapper so you can:
 *       const { DOMINO_SET } = require('./gameConstants');
 *   or in the browser:
 *       <script src="/shared/constants/gameConstants.js"></script>
 *       console.log(window.GameConstants.DOMINO_SET);
 * =================================================================== */

(function (root, factory) {
  /* eslint‑disable no‑undef */
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser – expose on window
    root.GameConstants = factory();
  }
})(typeof self !== 'undefined' ? self : this, () => {
  /* ----------------------------------------------------------------- */
  /* DOMINO SET ------------------------------------------------------- */
  /* ----------------------------------------------------------------- */
  const MAX_PIPS = 6;            // Double‑six set (0‑6)
  /** A frozen array of [low, high] tuples. */
  const DOMINO_SET = (() => {
    /** @type {Array<[number, number]>} */
    const set = [];
    for (let high = 0; high <= MAX_PIPS; high++) {
      for (let low = 0; low <= high; low++) {
        set.push([low, high]);
      }
    }
    return Object.freeze(set);
  })();

  /* ----------------------------------------------------------------- */
  /* TABLE / SEATING -------------------------------------------------- */
  /* ----------------------------------------------------------------- */
  /** Seat indexes (counter‑clockwise from your perspective) */
  const SEATS = Object.freeze({
    SOUTH: 0, // you
    EAST:  1, // player to your left
    NORTH: 2, // opposite you
    WEST:  3  // player to your right
  });

  /** Handy list for loops → [0,1,2,3] */
  const SEAT_ORDER = Object.freeze(Object.values(SEATS));

  /** Every seat belongs to team 0 or 1 (partners are 2 apart). */
  const TEAM_OF_SEAT = (seat) => seat % 2;          // 0 → team‑0, 1 → team‑1…

  /* ----------------------------------------------------------------- */
  /* GAME FLOW -------------------------------------------------------- */
  /* ----------------------------------------------------------------- */
  const FIRST_TILE = Object.freeze([6, 6]);         // Double‑six must start
  const HAND_SIZE  = 7;                             // Classic 4‑player dominoes
  const WINNING_SCORE = 100;                        // Points cap

  /* Socket / event names (single source) */
  const EVENTS = Object.freeze({
    SERVER: {
      FIND_ROOM:     'findRoom',
      PLAY_TILE:     'playTile',
      PASS_TURN:     'passTurn'
    },
    CLIENT: {
      ROOM_JOINED:   'roomJoined',
      LOBBY_UPDATE:  'lobbyUpdate',
      GAME_STATE:    'gameState'
    }
  });

  /* ----------------------------------------------------------------- */
  /* PUBLIC API ------------------------------------------------------- */
  /* ----------------------------------------------------------------- */
  return Object.freeze({
    MAX_PIPS,
    DOMINO_SET,
    SEATS,
    SEAT_ORDER,
    TEAM_OF_SEAT,
    FIRST_TILE,
    HAND_SIZE,
    WINNING_SCORE,
    EVENTS
  });
});
