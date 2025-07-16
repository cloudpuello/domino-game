/* =====================================================================
 * src/game/gameState.js — central, logic-only state container
 * =================================================================== */

// Fallback for GameConstants in case it's not loaded yet, preventing errors.
const GC = window.GameConstants || { MAX_PIP_VALUE: 6, FIRST_TILE: [6, 6] };
const DU = window.DominoUtils;   // Assumes DominoUtils is already loaded on the page

const GameState = {
  /* ─ Room/session info ─ */
  roomId: null,
  mySeat: null,

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

  /* ─ Init / reset ─ */
  init() { this.reset(); },

  reset() {
    Object.assign(this, {
      currentTurn: null,
      isGameActive: false,
      myHand: [],
      boardState: [],
      leftEnd: null,
      rightEnd: null,
      handSizes: { 0: 0, 1: 0, 2: 0, 3: 0 },
    });
  },

  /* ─ Session helpers ─ */
  setRoomInfo(roomId, seat) {
    this.roomId = roomId;
    this.mySeat = seat;
  },

  /* ─ Core setters ─ */
  updateScores(scores = [0, 0]) { this.scores = scores; },
  setCurrentTurn(t) { this.currentTurn = t; },

  updateMyHand(hand = []) {
    this.myHand = hand;
    if (this.mySeat != null) this.handSizes[this.mySeat] = hand.length;
  },

  /** Replace full board array AND recompute exposed ends */
  updateBoard(board = []) {
    this.boardState = board;
    const ends = DU.boardEnds(board);
    this.leftEnd  = ends?.left  ?? null;
    this.rightEnd = ends?.right ?? null;
  },

  /** Merge server hand-size object, but keep my own seat authoritative */
  syncHandSizes(serverSizes = {}) {
    this.handSizes = { ...this.handSizes, ...serverSizes };
    if (this.mySeat != null) this.handSizes[this.mySeat] = this.myHand.length;
  },

  /* ─ Convenience getters ─ */
  isMyTurn()   { return this.currentTurn === this.mySeat; },
  getBoardEnds() { return (this.leftEnd == null) ? null : { left: this.leftEnd, right: this.rightEnd }; },
  hasPlayableTiles() { return this.myHand.some(t => DU.isTilePlayable(t, this.boardState)); },

  /* ─ Thin wrappers that delegate to DominoUtils ─ */
  isTilePlayable(tile)         { return DU.isTilePlayable(tile, this.boardState); },
  getPlayableSides(tile)       { return DU.playableSides(tile, this.boardState); },

  /* ─ Debug helper ─ */
  debugState() { return { ...this }; },
};

/* Global attach for legacy scripts; switch to ES-module export when ready */
window.GameState = GameState;
