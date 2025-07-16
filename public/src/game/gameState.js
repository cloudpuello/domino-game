/* =====================================================================
 * src/game/gameState.js — Dominican Domino Game State (CORRECT RULES)
 *
 * IMPLEMENTS CORRECT DOMINICAN RULES:
 * - User always at bottom (seat 0)
 * - Counter-clockwise turn order [0,3,2,1]
 * - Only first game requires [6|6]
 * - Subsequent rounds: winner starts with any tile
 * =================================================================== */

// Fallback constants in case GameConstants not loaded
const GC = window.GameConstants || { 
  MAX_PIPS: 6, 
  FIRST_TILE: [6, 6],
  SEAT_ORDER: [0, 3, 2, 1], // Counter-clockwise
  nextSeat: (seat) => {
    const order = [0, 3, 2, 1];
    const currentIndex = order.indexOf(seat);
    const nextIndex = (currentIndex + 1) % order.length;
    return order[nextIndex];
  }
};
const DU = window.DominoUtils;

const GameState = {
  /* ─ Room/session info ─ */
  roomId: null,
  mySeat: null,
  gameRules: 'dominican-correct',

  /* ─ Round-specific state ─ */
  currentTurn: null,
  isGameActive: false,
  myHand: [],
  boardState: [],
  leftEnd: null,
  rightEnd: null,
  scores: [0, 0],

  /* ─ Player info ─ */
  handSizes: { 0: 0, 1: 0, 2: 0, 3: 0 },

  /* ─ Dominican-specific state ─ */
  gamePhase: 'firstGame',
  isFirstGame: false,
  lastPlayedTile: null,
  passCount: 0,

  /* ─ Init / reset ─ */
  init() { 
    console.log('GameState: Initializing Dominican game state (CORRECT RULES)');
    this.reset(); 
  },

  reset() {
    console.log('GameState: Resetting Dominican game state');
    Object.assign(this, {
      currentTurn: null,
      isGameActive: false,
      myHand: [],
      boardState: [],
      leftEnd: null,
      rightEnd: null,
      handSizes: { 0: 0, 1: 0, 2: 0, 3: 0 },
      gamePhase: 'firstGame',
      isFirstGame: false,
      lastPlayedTile: null,
      passCount: 0,
    });
  },

  /* ─ Session helpers ─ */
  setRoomInfo(roomId, seat) {
    this.roomId = roomId;
    this.mySeat = seat;
    console.log(`GameState: Room info set - Room: ${roomId}, Seat: ${seat}`);
    
    // Validate user is at bottom
    if (seat === 0) {
      console.log('GameState: ✓ User correctly seated at bottom (seat 0)');
    } else {
      console.warn(`GameState: ⚠️ User seated at ${seat}, should be 0 for best UX`);
    }
  },

  /* ─ Core setters ─ */
  updateScores(scores = [0, 0]) { 
    this.scores = scores;
    console.log(`GameState: Scores updated - Team 1: ${scores[0]}, Team 2: ${scores[1]}`);
  },
  
  setCurrentTurn(turn) { 
    this.currentTurn = turn;
    console.log(`GameState: Current turn set to seat ${turn} (${this.getSeatPosition(turn)})`);
  },

  updateMyHand(hand = []) {
    this.myHand = hand;
    if (this.mySeat != null) {
      this.handSizes[this.mySeat] = hand.length;
    }
    console.log(`GameState: My hand updated - ${hand.length} tiles:`, hand);
  },

  /** Replace full board array AND recompute exposed ends */
  updateBoard(board = []) {
    this.boardState = board;
    
    if (board.length === 0) {
      this.leftEnd = null;
      this.rightEnd = null;
    } else {
      // Calculate ends
      const ends = DU ? DU.boardEnds(board) : this.calculateBoardEnds(board);
      this.leftEnd = ends?.left ?? null;
      this.rightEnd = ends?.right ?? null;
    }
    
    console.log(`GameState: Board updated - ${board.length} tiles, ends: ${this.leftEnd}|${this.rightEnd}`);
  },

  /** Fallback method to calculate board ends */
  calculateBoardEnds(board) {
    if (!board || board.length === 0) return null;
    
    const leftMost = board[0];
    const rightMost = board[board.length - 1];
    
    return {
      left: leftMost[0],
      right: rightMost[1]
    };
  },

  /** Merge server hand-size object */
  syncHandSizes(serverSizes = {}) {
    this.handSizes = { ...this.handSizes, ...serverSizes };
    if (this.mySeat != null) {
      this.handSizes[this.mySeat] = this.myHand.length;
    }
    console.log(`GameState: Hand sizes synced:`, this.handSizes);
  },

  /* ─ Convenience getters ─ */
  isMyTurn() { 
    return this.currentTurn === this.mySeat; 
  },
  
  getBoardEnds() { 
    return (this.leftEnd == null) ? null : { left: this.leftEnd, right: this.rightEnd }; 
  },

  /* ─ Dominican-specific tile logic with correct rules ─ */
  hasPlayableTiles() {
    if (!this.myHand || this.myHand.length === 0) {
      console.log('GameState: No tiles in hand');
      return false;
    }

    // For empty board (first move)
    if (this.boardState.length === 0) {
      // First game: Must have [6|6] - and if it's my turn, I should have it
      if (this.isFirstGame) {
        const hasFirstTile = this.myHand.some(tile => 
          tile[0] === 6 && tile[1] === 6
        );
        console.log(`GameState: First game, checking for [6|6]: ${hasFirstTile}`);
        
        // If it's my turn in first game, I MUST have [6|6]
        if (this.isMyTurn() && !hasFirstTile) {
          console.error('GameState: ERROR - It\'s my turn in first game but I don\'t have [6|6]!');
        }
        
        return hasFirstTile;
      } else {
        // Subsequent rounds: Can play any tile (I'm the winner)
        console.log('GameState: Subsequent round, can play any tile');
        return this.myHand.length > 0;
      }
    }

    // For non-empty board: Check if any tile matches ends
    const hasPlayable = this.myHand.some(tile => this.isTilePlayable(tile));
    console.log(`GameState: Has playable tiles: ${hasPlayable}`);
    
    if (!hasPlayable) {
      console.log('GameState: No playable tiles. Board ends:', this.leftEnd, this.rightEnd);
      console.log('GameState: My tiles:', this.myHand);
    }
    
    return hasPlayable;
  },

  isTilePlayable(tile) {
    if (!tile || tile.length !== 2) return false;

    // Empty board logic
    if (this.boardState.length === 0) {
      if (this.isFirstGame) {
        return tile[0] === 6 && tile[1] === 6;
      } else {
        return true; // Any tile can open subsequent rounds
      }
    }

    // Non-empty board: tile must match one of the ends
    const leftEnd = this.leftEnd;
    const rightEnd = this.rightEnd;
    
    if (leftEnd == null || rightEnd == null) {
      console.warn('GameState: Board has tiles but ends are null');
      return false;
    }

    const playable = tile.includes(leftEnd) || tile.includes(rightEnd);
    return playable;
  },

  getPlayableSides(tile) {
    if (!this.isTilePlayable(tile)) return [];

    if (this.boardState.length === 0) {
      return ['center']; // First move
    }

    const sides = [];
    if (tile.includes(this.leftEnd)) sides.push('left');
    if (tile.includes(this.rightEnd)) sides.push('right');
    
    return sides;
  },

  /* ─ Counter-clockwise turn order helpers ─ */
  getNextSeat(seat = this.currentTurn) {
    if (GC.nextSeat) {
      return GC.nextSeat(seat);
    }
    
    // Fallback counter-clockwise order
    const order = [0, 3, 2, 1];
    const currentIndex = order.indexOf(seat);
    const nextIndex = (currentIndex + 1) % order.length;
    return order[nextIndex];
  },

  getTeamOf(seat) {
    return seat % 2; // 0,2 = Team 0; 1,3 = Team 1
  },

  getSeatPosition(seat) {
    const positions = {
      0: 'Bottom (You)',
      1: 'Right',
      2: 'Top',
      3: 'Left'
    };
    return positions[seat] || `Seat ${seat}`;
  },

  /* ─ Debug helpers ─ */
  debugState() {
    const state = {
      roomId: this.roomId,
      mySeat: this.mySeat,
      gameRules: this.gameRules,
      gamePhase: this.gamePhase,
      isFirstGame: this.isFirstGame,
      currentTurn: this.currentTurn,
      isGameActive: this.isGameActive,
      myHandSize: this.myHand.length,
      boardSize: this.boardState.length,
      boardEnds: this.getBoardEnds(),
      scores: this.scores,
      handSizes: this.handSizes,
      isMyTurn: this.isMyTurn(),
      hasPlayableTiles: this.hasPlayableTiles(),
      turnOrder: 'counter-clockwise [0,3,2,1]',
      seatPosition: this.getSeatPosition(this.mySeat)
    };
    
    console.log('GameState Debug (CORRECT RULES):', state);
    return state;
  },

  /* ─ Validation helpers ─ */
  validateState() {
    const issues = [];
    
    if (!this.roomId) issues.push('No room ID');
    if (this.mySeat === null) issues.push('No seat assigned');
    if (!this.myHand) issues.push('No hand array');
    if (!this.boardState) issues.push('No board state array');
    
    // UX validation
    if (this.mySeat !== 0) issues.push('User not seated at bottom (seat 0)');
    
    if (issues.length > 0) {
      console.warn('GameState validation issues:', issues);
    }
    
    return issues.length === 0;
  }
};

/* Global attach for compatibility */
window.GameState = GameState;