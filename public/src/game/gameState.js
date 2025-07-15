/* =====================================================================
 * src/game/gameState.js — FIXED Game State (Simple & Working)
 * 
 * FIXES:
 * - Proper board ends calculation
 * - Clean initialization
 * - All required methods present
 * =================================================================== */

const GameState = {
  // Room info
  roomId: null,
  mySeat: null,
  
  // Game state
  currentTurn: null,
  isGameActive: false,
  myHand: [],
  boardState: [],
  scores: [0, 0],
  
  // Player info
  handSizes: { 0: 0, 1: 0, 2: 0, 3: 0 },
  
  /**
   * Initialize game state
   */
  init() {
    console.log('GameState: Initializing');
    this.reset();
  },
  
  /**
   * Reset game state
   */
  reset() {
    this.currentTurn = null;
    this.isGameActive = false;
    this.myHand = [];
    this.boardState = [];
    this.handSizes = { 0: 0, 1: 0, 2: 0, 3: 0 };
  },
  
  /**
   * Set room information
   */
  setRoomInfo(roomId, seat) {
    this.roomId = roomId;
    this.mySeat = seat;
    console.log('GameState: Room info set', { roomId, seat });
  },
  
  /**
   * Update scores
   */
  updateScores(scores) {
    this.scores = scores || [0, 0];
  },
  
  /**
   * Set current turn
   */
  setCurrentTurn(turn) {
    this.currentTurn = turn;
  },
  
  /**
   * Check if it's my turn
   */
  isMyTurn() {
    return this.currentTurn === this.mySeat;
  },
  
  /**
   * Get team for a seat
   */
  getTeam(seat) {
    return seat % 2;
  },
  
  /**
   * Update my hand
   */
  updateMyHand(hand) {
    this.myHand = hand || [];
    if (this.mySeat !== null) {
      this.handSizes[this.mySeat] = this.myHand.length;
    }
  },
  
  /**
   * Update board state
   */
  updateBoard(board) {
    this.boardState = board || [];
  },
  
  /**
   * Get board ends - FIXED calculation
   */
  getBoardEnds() {
    if (this.boardState.length === 0) return null;
    
    return {
      left: this.boardState[0][0],
      right: this.boardState[this.boardState.length - 1][1]
    };
  },
  
  /**
   * Check if a tile is playable
   */
  isTilePlayable(tile) {
    // First move must be double-six
    if (this.boardState.length === 0) {
      return tile[0] === 6 && tile[1] === 6;
    }
    
    const ends = this.getBoardEnds();
    if (!ends) return false;
    
    const [a, b] = tile;
    return a === ends.left || b === ends.left || 
           a === ends.right || b === ends.right;
  },
  
  /**
   * Get playable sides for a tile - REQUIRED method
   */
  getPlayableSides(tile) {
    if (this.boardState.length === 0) {
      return ['center'];
    }
    
    const ends = this.getBoardEnds();
    if (!ends) return [];
    
    const [a, b] = tile;
    const playableSides = [];
    
    // Check left side
    if (a === ends.left || b === ends.left) {
      playableSides.push('left');
    }
    
    // Check right side
    if (a === ends.right || b === ends.right) {
      playableSides.push('right');
    }
    
    return playableSides;
  },
  
  /**
   * Check if hand has any playable tiles
   */
  hasPlayableTiles() {
    return this.myHand.some(tile => this.isTilePlayable(tile));
  },
  
  /**
   * Debug function
   */
  debugState() {
    return {
      roomId: this.roomId,
      mySeat: this.mySeat,
      currentTurn: this.currentTurn,
      isMyTurn: this.isMyTurn(),
      myHandSize: this.myHand.length,
      boardSize: this.boardState.length,
      boardEnds: this.getBoardEnds(),
      scores: this.scores,
      handSizes: this.handSizes
    };
  }
};

// CRITICAL: Make GameState globally available
window.GameState = GameState;