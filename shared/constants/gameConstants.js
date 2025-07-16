/* =====================================================================
 * shared/constants/gameConstants.js - Dominican Domino Rules
 *
 * FIXED FOR DOMINICAN RULES:
 * - Counter-clockwise turn order
 * - Proper scoring system
 * - Capicú and Paso bonuses
 * - Right-hand block bonuses
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
  /* TABLE / SEATING - DOMINICAN COUNTER-CLOCKWISE ORDER ------------- */
  /* ----------------------------------------------------------------- */
  /** Seat indexes (counter‑clockwise from your perspective) */
  const SEATS = Object.freeze({
    SOUTH: 0, // you
    WEST:  3, // player to your right (next in turn order)
    NORTH: 2, // opposite you
    EAST:  1  // player to your left
  });

  /** DOMINICAN TURN ORDER: Counter-clockwise [0,3,2,1] */
  const SEAT_ORDER = Object.freeze([0, 3, 2, 1]);

  /** Every seat belongs to team 0 or 1 (partners are 2 apart). */
  const TEAM_OF_SEAT = (seat) => seat % 2;          // 0,2 → team‑0; 1,3 → team‑1

  /* ----------------------------------------------------------------- */
  /* GAME FLOW -------------------------------------------------------- */
  /* ----------------------------------------------------------------- */
  const FIRST_TILE = Object.freeze([6, 6]);         // Double‑six must start first round
  const HAND_SIZE  = 7;                             // Classic 4‑player dominoes
  const WINNING_SCORE = 100;                        // Points cap

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
  /* GAME STATES ------------------------------------------------------ */
  /* ----------------------------------------------------------------- */
  const GAME_STATES = Object.freeze({
    WAITING: 'waiting',
    ACTIVE: 'active',
    ROUND_ENDED: 'roundEnded',
    GAME_OVER: 'gameOver',
    TRANCA: 'tranca'  // Blocked board
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
  /* HELPER FUNCTIONS ------------------------------------------------- */
  /* ----------------------------------------------------------------- */
  
  /** Get next seat in Dominican counter-clockwise order */
  const nextSeat = (currentSeat) => {
    const currentIndex = SEAT_ORDER.indexOf(currentSeat);
    const nextIndex = (currentIndex + 1) % SEAT_ORDER.length;
    return SEAT_ORDER[nextIndex];
  };

  /** Get previous seat in Dominican counter-clockwise order */
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
    SCORING,
    GAME_STATES,
    END_REASONS,
    EVENTS,
    
    // Helper functions
    nextSeat,
    prevSeat,
    isDouble,
    calculatePips
  });
});