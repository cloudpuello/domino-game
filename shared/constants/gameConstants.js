/* =====================================================================
 * shared/constants/gameConstants.js - Dominican Domino (CORRECT RULES)
 *
 * FIXED FOR PROPER DOMINICAN RULES & UX:
 * - Only first game of first match requires [6|6]
 * - User always sits at bottom (seat 0)
 * - Clockwise turn order from user's perspective
 * - Subsequent rounds: winner starts with any tile
 * =================================================================== */

(function (root, factory) {
  /* eslint‑disable no‑undef */
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser – expose on window
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
  /* TABLE / SEATING - USER-FRIENDLY LAYOUT -------------------------- */
  /* ----------------------------------------------------------------- */
  /** 
   * FIXED: User always at bottom, COUNTER-CLOCKWISE turn order
   * Visual layout:
   *     [2] Top
   * [3] Left   Right [1] 
   *     [0] Bottom (User)
   * 
   * Counter-clockwise flow: User -> Left -> Top -> Right -> User
   */
  const SEATS = Object.freeze({
    USER: 0,      // Bottom - always the joining player
    RIGHT: 1,     // Right side
    TOP: 2,       // Top
    LEFT: 3       // Left side
  });

  /** COUNTER-CLOCKWISE TURN ORDER from user's perspective: [0,3,2,1] */
  const SEAT_ORDER = Object.freeze([0, 3, 2, 1]);

  /** Teams: 0&2 vs 1&3 (partners sit opposite) */
  const TEAM_OF_SEAT = (seat) => seat % 2;

  /* ----------------------------------------------------------------- */
  /* GAME FLOW - CORRECTED DOMINICAN RULES --------------------------- */
  /* ----------------------------------------------------------------- */
  const FIRST_TILE = Object.freeze([6, 6]);         // Double‑six for first game only
  const HAND_SIZE  = 7;                             // Classic 4‑player dominoes
  const WINNING_SCORE = 100;                        // Points to win match

  /* ----------------------------------------------------------------- */
  /* GAME PHASES ------------------------------------------------------ */
  /* ----------------------------------------------------------------- */
  const GAME_PHASES = Object.freeze({
    FIRST_GAME: 'firstGame',        // Very first game - requires [6|6]
    NORMAL_ROUND: 'normalRound',    // Subsequent rounds - winner starts with any tile
    MATCH_OVER: 'matchOver'         // Match finished
  });

  /* ----------------------------------------------------------------- */
  /* DOMINICAN SCORING SYSTEM ---------------------------------------- */
  /* ----------------------------------------------------------------- */
  const SCORING = Object.freeze({
    CAPICU: 30,           // Last tile connects both ends
    PASO: 30,             // No one can respond after last play
    CAPICU_PASO: 60,      // Both Capicú and Paso
    RIGHT_HAND_DOUBLE: 30,    // Next opponent can't play after opening double
    RIGHT_HAND_MIXED: 60,     // Next opponent can't play after opening mixed tile
  });

  /* ----------------------------------------------------------------- */
  /* ROUND END REASONS ------------------------------------------------ */
  /* ----------------------------------------------------------------- */
  const END_REASONS = Object.freeze({
    DOMINO: 'domino',           // Player emptied their hand
    TRANCA: 'tranca',           // Blocked board
    CAPICU: 'capicu',           // Domino with Capicú bonus
    PASO: 'paso',               // Domino with Paso bonus
    CAPICU_PASO: 'capicu_paso'  // Domino with both bonuses
  });

  /* ----------------------------------------------------------------- */
  /* HELPER FUNCTIONS - COUNTER-CLOCKWISE TURN ORDER ----------------- */
  /* ----------------------------------------------------------------- */
  
  /** Get next seat in counter-clockwise order: 0->3->2->1->0 */
  const nextSeat = (currentSeat) => {
    const currentIndex = SEAT_ORDER.indexOf(currentSeat);
    const nextIndex = (currentIndex + 1) % SEAT_ORDER.length;
    return SEAT_ORDER[nextIndex];
    };
  });

  /** Get previous seat in counter-clockwise order: 0->1->2->3->0 */
  const prevSeat = (currentSeat) => {
    const currentIndex = SEAT_ORDER.indexOf(currentSeat);
    const prevIndex = (currentIndex - 1 + SEAT_ORDER.length) % SEAT_ORDER.length;
    return SEAT_ORDER[prevIndex];
  };

  /** Check if a tile is a double */
  const isDouble = (tile) => tile[0] === tile[1];

  /** Calculate pip sum of a hand */
  const calculatePips = (hand) => {
    if (!hand || !Array.isArray(hand)) return 0;
    return hand.reduce((sum, tile) => sum + tile[0] + tile[1], 0);
  };

  /** Get seat position name for UI */
  const getSeatPosition = (seat) => {
    const positions = {
      0: 'Bottom (You)',
      1: 'Right', 
      2: 'Top',
      3: 'Left'
    };
    return positions[seat] || 'Unknown';
  };