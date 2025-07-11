/* =====================================================================
 * src/game/gameState.js — Central Game State
 * 
 * AI NOTES:
 * - Single source of truth for all game data
 * - Other modules read from here
 * - Only this module modifies game state
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
  players: [],
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
    this.handSizes[this.mySeat] = this.myHand.length;
  },
  
  /**
   * Update board state
   */
  updateBoard(board) {
    this.boardState = board || [];
  },
  
  /**
   * Get board ends for matching
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
  }
};