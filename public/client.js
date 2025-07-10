/* =====================================================================
 * client.js — Dominican Domino front-end (Using shared constants)
 * =================================================================== */

/* ────────────────────────────────────────────────────────────────────────
 * Import Constants from shared folder
 * ────────────────────────────────────────────────────────────────────── */
import { 
  HIT_PADDING, 
  ERROR_DISPLAY_TIME, 
  OPENING_TILE, 
  HAND_SIZE,
  DOMINO_WIDTH,
  DOMINO_HEIGHT,
  DOMINO_GAP,
  HAND_DOMINO_WIDTH,
  HAND_DOMINO_HEIGHT 
} from '/shared/constants/gameConstants.js';

/* ────────────────────────────────────────────────────────────────────────
 * Socket connection and player setup
 * ────────────────────────────────────────────────────────────────────── */
const socket = io();
const playerName = prompt("Enter your name:") || "Anonymous";

/* ────────────────────────────────────────────────────────────────────────
 * Game state
 * ────────────────────────────────────────────────────────────────────── */
const gameState = {
  roomId: null,
  mySeat: null,
  currentTurn: null,
  myHand: [],
  boardState: [],
  scores: [0, 0],
  seatMap: {},
  handSizes: {},
  players: []
};

/* ────────────────────────────────────────────────────────────────────────
 * Drag and drop state
 * ────────────────────────────────────────────────────────────────────── */
const dragState = {
  element: null,
  originalTile: null,
  tileData: null,
  isDragging: false,
  hoveredSide: null
};

/* ────────────────────────────────────────────────────────────────────────
 * DOM elements
 * ────────────────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const elements = {
  status: $("status"),
  board: $("board"),
  hand: $("hand"),
  lobbyList: $("lobbyList"),
  lobbyContainer: $("lobbyContainer"),
  playerInfo: $("playerInfo"),
  errors: $("errors"),
  messages: $("messages"),
  pipCounts: $("pipCounts"),
  topPlayer: $("topPlayer"),
  leftPlayer: $("leftPlayer"),
  rightPlayer: $("rightPlayer"),
  team0Score: $("team0-score"),
  team1Score: $("team1-score"),
  // All hand elements
  hand0: $("hand0"),
  hand1: $("hand1"),
  hand2: $("hand2"),
  hand3: $("hand3")
};

/* ────────────────────────────────────────────────────────────────────────
 * Initialization and reconnection
 * ────────────────────────────────────────────────────────────────────── */
function initializeGame() {
  setupSocketListeners();
  attemptReconnection();
  setupWindowListeners();
  initializeDominoCSS();
  ensureHandElements();
}

function attemptReconnection() {
  socket.emit("findRoom", {
    playerName,
    roomId: sessionStorage.getItem("domino_roomId"),
    reconnectSeat: sessionStorage.getItem("domino_mySeat")
  });
}

function setupWindowListeners() {
  window.addEventListener("resize", adjustBoardCenter);
}

function initializeDominoCSS() {
  const style = document.createElement('style');
  style.textContent = `
    /* Portrait domino styles */
    .board-domino {
      position: absolute;
      width: ${DOMINO_WIDTH}px;
      height: ${DOMINO_HEIGHT}px;
      background: #f0f0f0;
      border: 2px solid #333;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      z-index: 10;
      box-shadow: 0 3px 6px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
    }
    
    .hand-domino {
      width: ${HAND_DOMINO_WIDTH}px;
      height: ${HAND_DOMINO_HEIGHT}px;
      background: #f8f8f8;
      border: 1px solid #333;
      border-radius: 4px;
      margin: 2px;
      display: inline-flex;
      flex-direction: column;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    
    .hand-domino:hover {
      transform: scale(1.1) translateY(-3px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    }
    
    .domino-section {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: #333;
    }
    
    .domino-section.top {
      border-bottom: 1px solid #333;
      font-size: 14px;
    }
    
    .domino-section.bottom {
      font-size: 14px;
    }
    
    .hand-domino .domino-section {
      font-size: 10px;
    }
    
    .player-hand-container {
      min-height: 80px;
      padding: 10px;
      border-radius: 8px;
      background: rgba(255,255,255,0.1);
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      border: 2px solid transparent;
      transition: all 0.3s ease;
    }
    
    .player-hand-container.current-player {
      border-color: #ffd700;
      background: rgba(255,215,0,0.2);
      box-shadow: 0 0 15px rgba(255,215,0,0.5);
    }
    
    .domino-dragging {
      opacity: 0.7;
      transform: scale(1.1);
      z-index: 1000;
    }
  `;
  document.head.appendChild(style);
}

function ensureHandElements() {
  // Make sure all hand elements exist and have proper classes
  for (let i = 0; i < 4; i++) {
    let handElement = $(`hand${i}`);
    if (!handElement) {
      // Create hand element if it doesn't exist
      handElement = document.createElement('div');
      handElement.id = `hand${i}`;
      handElement.className = 'player-hand-container';
      
      // Find appropriate parent or create one
      const gameTable = document.querySelector('.game-table') || document.body;
      gameTable.appendChild(handElement);
    } else {
      handElement.className = 'player-hand-container';
    }
    elements[`hand${i}`] = handElement;
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * UI Helper functions
 * ────────────────────────────────────────────────────────────────────── */
function setStatus(text) {
  if (elements.status) {
    elements.status.textContent = text;
  }
}

function showError(text) {
  if (elements.errors) {
    elements.errors.textContent = text;
    setTimeout(() => {
      elements.errors.textContent = "";
    }, ERROR_DISPLAY_TIME);
  }
}

function addMessage(text) {
  if (elements.messages) {
    const messageDiv = document.createElement("div");
    messageDiv.textContent = text;
    elements.messages.prepend(messageDiv);
  }
}

function adjustBoardCenter() {
  if (elements.board) {
    const shouldCenter = elements.board.scrollWidth <= elements.board.clientWidth;
    elements.board.classList.toggle("board-center", shouldCenter);
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * Snake Formation Logic - Fixed to always go left to right
 * ────────────────────────────────────────────────────────────────────── */
function calculateSnakePositions(board, startX, startY) {
  const positions = [];
  
  if (board.length === 0) return positions;
  
  // Configuration
  const MAX_DISTANCE = 300;  // Maximum distance from center before turning
  const ROW_HEIGHT = DOMINO_HEIGHT + 20;  // Space between rows
  
  // Track state
  let currentRow = 0;
  let rowDominoCount = 0;
  let rowStartX = startX;
  
  // Calculate how many dominoes fit in each row based on distance
  const dominoesPerRow = Math.floor((MAX_DISTANCE * 2) / (DOMINO_WIDTH + DOMINO_GAP));
  
  for (let i = 0; i < board.length; i++) {
    const domino = board[i];
    const isDouble = domino[0] === domino[1];
    
    // Calculate position within current row
    let x, y, rotation;
    
    // Check if we need to start a new row
    const distanceFromCenter = rowDominoCount * (DOMINO_WIDTH + DOMINO_GAP) / 2;
    if (distanceFromCenter > MAX_DISTANCE && rowDominoCount > 0) {
      currentRow++;
      rowDominoCount = 0;
      rowStartX = startX;
    }
    
    // Calculate position
    if (currentRow % 2 === 0) {
      // Even rows: left to right
      x = rowStartX - (MAX_DISTANCE) + (rowDominoCount * (DOMINO_WIDTH + DOMINO_GAP));
    } else {
      // Odd rows: still left to right but offset down
      x = rowStartX - (MAX_DISTANCE) + (rowDominoCount * (DOMINO_WIDTH + DOMINO_GAP));
    }
    
    y = startY + (currentRow * ROW_HEIGHT);
    
    // Handle rotation
    if (isDouble) {
      // Doubles are perpendicular to the line
      rotation = 90;
    } else {
      // Regular dominoes are horizontal
      rotation = 0;
    }
    
    // Special handling for turn positions
    const isAtRowEnd = (distanceFromCenter + DOMINO_WIDTH + DOMINO_GAP) > MAX_DISTANCE;
    if (isAtRowEnd && i < board.length - 1) {
      // This domino triggers a turn
      // Adjust position slightly for visual flow
      y += DOMINO_HEIGHT / 2;
      if (!isDouble) {
        rotation = 45; // Slight angle for turn dominoes
      }
    }
    
    positions.push({ x, y, rotation, isDouble });
    rowDominoCount++;
  }
  
  // Center the entire formation
  const minX = Math.min(...positions.map(p => p.x));
  const maxX = Math.max(...positions.map(p => p.x));
  const centerOffset = (maxX + minX) / 2 - startX;
  
  positions.forEach(pos => {
    pos.x -= centerOffset;
  });
  
  return positions;
}

/* ────────────────────────────────────────────────────────────────────────
 * Domino creation functions
 * ────────────────────────────────────────────────────────────────────── */
function createBoardDominoElement(domino, position) {
  const element = document.createElement('div');
  element.className = 'board-domino';
  
  // Set position and rotation
  element.style.left = `${position.x}px`;
  element.style.top = `${position.y}px`;
  element.style.transform = `rotate(${position.rotation}deg)`;
  
  // Create top section
  const topSection = document.createElement('div');
  topSection.className = 'domino-section top';
  topSection.textContent = domino[0];
  
  // Create bottom section
  const bottomSection = document.createElement('div');
  bottomSection.className = 'domino-section bottom';
  bottomSection.textContent = domino[1];
  
  element.appendChild(topSection);
  element.appendChild(bottomSection);
  
  return element;
}

function createHandDominoElement(domino, playerIndex, dominoIndex) {
  const element = document.createElement('div');
  element.className = 'hand-domino';
  element.dataset.playerIndex = playerIndex;
  element.dataset.dominoIndex = dominoIndex;
  
  // Create top section
  const topSection = document.createElement('div');
  topSection.className = 'domino-section top';
  topSection.textContent = domino[0];
  
  // Create bottom section
  const bottomSection = document.createElement('div');
  bottomSection.className = 'domino-section bottom';
  bottomSection.textContent = domino[1];
  
  element.appendChild(topSection);
  element.appendChild(bottomSection);
  
  // Add drag functionality for current player
  if (playerIndex === gameState.mySeat && isMyTurn()) {
    element.draggable = false; // Disable native drag
    element.addEventListener('mousedown', e => startDrag(e, domino, element));
    element.addEventListener('touchstart', e => startDrag(e, domino, element), { passive: false });
  }
  
  return element;
}

/* ────────────────────────────────────────────────────────────────────────
 * Board rendering with snake formation
 * ────────────────────────────────────────────────────────────────────── */
function renderBoard() {
  if (!elements.board) return;
  
  elements.board.innerHTML = "";
  
  if (gameState.boardState.length === 0) {
    renderPlaceholder();
    return;
  }
  
  // Calculate board center
  const boardRect = elements.board.getBoundingClientRect();
  const centerX = boardRect.width / 2;
  const centerY = boardRect.height / 2;
  
  // Calculate snake positions
  const positions = calculateSnakePositions(gameState.boardState, centerX, centerY);
  
  // Create and position domino elements
  gameState.boardState.forEach((domino, index) => {
    const position = positions[index];
    if (position) {
      const dominoElement = createBoardDominoElement(domino, position);
      elements.board.appendChild(dominoElement);
    }
  });
  
  adjustBoardCenter();
}

function renderPlaceholder() {
  const placeholder = document.createElement("div");
  placeholder.className = "tile-placeholder drop-target";
  placeholder.dataset.side = "left";
  placeholder.textContent = gameState.boardState.length === 0 ? "6|6" : "PLAY";
  placeholder.style.position = 'absolute';
  placeholder.style.left = '50%';
  placeholder.style.top = '50%';
  placeholder.style.transform = 'translate(-50%, -50%)';
  elements.board.appendChild(placeholder);
}

/* ────────────────────────────────────────────────────────────────────────
 * Hand rendering for all players
 * ────────────────────────────────────────────────────────────────────── */
function renderAllHands() {
  // Clear all hands first
  for (let i = 0; i < 4; i++) {
    const handElement = elements[`hand${i}`];
    if (handElement) {
      handElement.innerHTML = '';
      handElement.classList.remove('current-player');
    }
  }
  
  // Render each player's hand
  gameState.players.forEach((player, playerIndex) => {
    renderPlayerHand(playerIndex, player);
  });
  
  // Highlight current player
  if (gameState.currentTurn !== null) {
    const currentHandElement = elements[`hand${gameState.currentTurn}`];
    if (currentHandElement) {
      currentHandElement.classList.add('current-player');
    }
  }
}

function renderPlayerHand(playerIndex, player) {
  const handElement = elements[`hand${playerIndex}`];
  if (!handElement) return;
  
  // If this is the current player, show their actual hand
  if (playerIndex === gameState.mySeat && gameState.myHand) {
    gameState.myHand.forEach((domino, index) => {
      const dominoElement = createHandDominoElement(domino, playerIndex, index);
      handElement.appendChild(dominoElement);
    });
  } else {
    // For other players, show face-down dominoes
    const handSize = gameState.handSizes[playerIndex] || 0;
    for (let i = 0; i < handSize; i++) {
      const dummyDomino = document.createElement('div');
      dummyDomino.className = 'hand-domino dummy';
      dummyDomino.style.background = '#4a5568';
      dummyDomino.style.border = '1px solid #2d3748';
      
      // Add back pattern
      const backPattern = document.createElement('div');
      backPattern.style.width = '100%';
      backPattern.style.height = '100%';
      backPattern.style.background = 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)';
      backPattern.style.borderRadius = '3px';
      
      dummyDomino.appendChild(backPattern);
      handElement.appendChild(dummyDomino);
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * Game logic helpers
 * ────────────────────────────────────────────────────────────────────── */
function getBoardEnds() {
  if (gameState.boardState.length === 0) return null;
  
  return {
    leftPip: gameState.boardState[0][0],
    rightPip: gameState.boardState[gameState.boardState.length - 1][1]
  };
}

function isTilePlayable([a, b], ends) {
  const isFirstMove = gameState.boardState.length === 0;
  
  if (isFirstMove) {
    return a === OPENING_TILE[0] && b === OPENING_TILE[1];
  }
  
  return ends && (
    a === ends.leftPip || b === ends.leftPip ||
    a === ends.rightPip || b === ends.rightPip
  );
}

function isMyTurn() {
  return gameState.currentTurn === gameState.mySeat;
}

/* ────────────────────────────────────────────────────────────────────────
 * Drag and drop functionality
 * ────────────────────────────────────────────────────────────────────── */
function getEventPosition(event) {
  if (event.touches) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  return { x: event.clientX, y: event.clientY };
}

function cleanupDrag() {
  // Remove dragged element
  if (dragState.element) {
    dragState.element.remove();
  }
  
  // Remove drop targets and hover states
  document.querySelectorAll(".drop-target").forEach(element => {
    element.classList.remove("drop-target", "drop-hover");
    element.removeAttribute("data-side");
  });
  
  // Remove ghost state from original tile
  if (dragState.originalTile) {
    dragState.originalTile.classList.remove("ghost");
  }
  
  // Remove event listeners
  document.removeEventListener("mousemove", handleDragMove);
  document.removeEventListener("mouseup", handleDragEnd);
  document.removeEventListener("touchmove", handleDragMove);
  document.removeEventListener("touchend", handleDragEnd);
  
  // Reset drag state
  Object.assign(dragState, {
    element: null,
    originalTile: null,
    tileData: null,
    isDragging: false,
    hoveredSide: null
  });
}

function startDrag(event, tile, tileElement) {
  if (event.type === "touchstart") {
    event.preventDefault();
  }
  
  if (dragState.isDragging || !isMyTurn()) return;
  
  // Check if tile is playable
  const ends = getBoardEnds();
  if (!isTilePlayable(tile, ends)) return;
  
  // Set up drag state
  Object.assign(dragState, {
    tileData: tile,
    originalTile: tileElement,
    isDragging: true,
    hoveredSide: null
  });
  
  // Create dragged element
  dragState.element = tileElement.cloneNode(true);
  dragState.element.classList.add("domino-dragging");
  dragState.element.style.position = 'fixed';
  dragState.element.style.pointerEvents = 'none';
  dragState.element.style.zIndex = '1000';
  document.body.appendChild(dragState.element);
  
  // Mark original tile as ghost
  tileElement.classList.add("ghost");
  tileElement.style.opacity = '0.3';
  
  // Position dragged element
  const position = getEventPosition(event);
  dragState.element.style.left = position.x + "px";
  dragState.element.style.top = position.y + "px";
  
  // Add event listeners
  document.addEventListener("mousemove", handleDragMove);
  document.addEventListener("mouseup", handleDragEnd);
  document.addEventListener("touchmove", handleDragMove, { passive: false });
  document.addEventListener("touchend", handleDragEnd);
}

function handleDragMove(event) {
  if (!dragState.isDragging) return;
  
  event.preventDefault();
  const position = getEventPosition(event);
  
  // Update dragged element position
  dragState.element.style.left = position.x + "px";
  dragState.element.style.top = position.y + "px";
  
  // Check if over board for drop
  if (elements.board) {
    const boardRect = elements.board.getBoundingClientRect();
    const isOverBoard = position.x > boardRect.left && 
                       position.x < boardRect.right && 
                       position.y > boardRect.top && 
                       position.y < boardRect.bottom;
    
    if (isOverBoard) {
      // Determine which side based on position
      const centerX = boardRect.left + boardRect.width / 2;
      dragState.hoveredSide = position.x < centerX ? 'left' : 'right';
      elements.board.classList.add('drop-hover');
    } else {
      dragState.hoveredSide = null;
      elements.board.classList.remove('drop-hover');
    }
  }
}

function handleDragEnd() {
  if (!dragState.isDragging) return;
  
  const side = dragState.hoveredSide || 
               (gameState.boardState.length === 0 ? "left" : null);
  
  if (side) {
    // Valid drop - send tile play to server
    socket.emit("playTile", {
      roomId: gameState.roomId,
      seat: gameState.mySeat,
      tile: dragState.tileData,
      side
    });
  } else {
    // Invalid drop - restore original tile
    if (dragState.originalTile) {
      dragState.originalTile.style.opacity = '1';
    }
  }
  
  // Clean up board hover state
  if (elements.board) {
    elements.board.classList.remove('drop-hover');
  }
  
  cleanupDrag();
}

/* ────────────────────────────────────────────────────────────────────────
 * Score rendering
 * ────────────────────────────────────────────────────────────────────── */
function renderScores() {
  if (elements.team0Score) {
    elements.team0Score.textContent = gameState.scores[0] || 0;
  }
  if (elements.team1Score) {
    elements.team1Score.textContent = gameState.scores[1] || 0;
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * Main update function
 * ────────────────────────────────────────────────────────────────────── */
function updateGameDisplay() {
  renderBoard();
  renderAllHands();
  renderScores();
}

/* ────────────────────────────────────────────────────────────────────────
 * Socket event handlers
 * ────────────────────────────────────────────────────────────────────── */
function setupSocketListeners() {
  socket.on("roomJoined", handleRoomJoined);
  socket.on("lobbyUpdate", handleLobbyUpdate);
  socket.on("roundStart", handleRoundStart);
  socket.on("updateHand", handleHandUpdate);
  socket.on("broadcastMove", handleMoveUpdate);
  socket.on("turnChanged", handleTurnChange);
  socket.on("playerPassed", handlePlayerPassed);
  socket.on("roundEnded", handleRoundEnd);
  socket.on("gameOver", handleGameOver);
  socket.on("reconnectSuccess", handleReconnectSuccess);
  socket.on("errorMessage", showError);
  socket.on("bonusAwarded", handleBonusAwarded);
}

function handleRoomJoined({ roomId, seat }) {
  gameState.roomId = roomId;
  gameState.mySeat = seat;
  
  // Save to session storage for reconnection
  sessionStorage.setItem("domino_roomId", roomId);
  sessionStorage.setItem("domino_mySeat", seat);
  
  // Update player info display
  if (elements.playerInfo) {
    const teamNumber = seat % 2 === 0 ? "0 & 2" : "1 & 3";
    elements.playerInfo.textContent = `You are Seat ${seat} (Team ${teamNumber})`;
  }
}

function handleLobbyUpdate({ players }) {
  if (elements.lobbyContainer) {
    elements.lobbyContainer.style.display = "block";
  }
  
  // Update players array and seat map
  gameState.players = players;
  gameState.seatMap = Object.fromEntries(
    players.map(player => [player.seat, player])
  );
  
  // Update lobby list
  if (elements.lobbyList) {
    elements.lobbyList.innerHTML = "";
    players.forEach(player => {
      const listItem = document.createElement("li");
      listItem.textContent = `Seat ${player.seat}: ${player.name}`;
      elements.lobbyList.appendChild(listItem);
    });
  }
}

function handleRoundStart({ yourHand, startingSeat, scores }) {
  if (elements.lobbyContainer) {
    elements.lobbyContainer.style.display = "none";
  }
  
  // Update game state
  gameState.myHand = yourHand || [];
  gameState.boardState = [];
  gameState.scores = scores || [0, 0];
  gameState.currentTurn = startingSeat;
  gameState.handSizes = { 0: HAND_SIZE, 1: HAND_SIZE, 2: HAND_SIZE, 3: HAND_SIZE };
  
  // Clear messages and cleanup
  if (elements.messages) {
    elements.messages.innerHTML = "";
  }
  cleanupDrag();
  
  // Update game display
  updateGameDisplay();
  
  // Update status
  const statusText = gameState.currentTurn === gameState.mySeat ? 
    "Your turn! Play the 6|6" : 
    `Waiting for seat ${gameState.currentTurn}`;
  setStatus(statusText);
}

function handleHandUpdate(newHand) {
  gameState.myHand = newHand || [];
  gameState.handSizes[gameState.mySeat] = newHand.length;
  renderAllHands();
}

function handleMoveUpdate({ seat, tile, board }) {
  gameState.boardState = board || [];
  
  // Update hand size for the player who played
  if (seat !== gameState.mySeat) {
    gameState.handSizes[seat] = Math.max(0, (gameState.handSizes[seat] || 0) - 1);
  }
  
  cleanupDrag();
  updateGameDisplay();
  
  addMessage(`Seat ${seat} played ${tile[0]}|${tile[1]}.`);
}

function handleTurnChange(turn) {
  gameState.currentTurn = turn;
  
  const statusText = turn === gameState.mySeat ? 
    "Your turn!" : 
    `Waiting for seat ${turn}`;
  setStatus(statusText);
  
  cleanupDrag();
  renderAllHands(); // Re-render to update current player highlighting
}

function handlePlayerPassed({ seat }) {
  addMessage(`Seat ${seat} passed.`);
}

function handleRoundEnd({ winner, reason, points, scores, board }) {
  gameState.boardState = board || [];
  gameState.scores = scores || [0, 0];
  
  cleanupDrag();
  updateGameDisplay();
  
  const statusText = `Seat ${winner} wins (${reason}) +${points} pts.`;
  setStatus(statusText);
  addMessage(statusText);
}

function handleGameOver({ winningTeam, scores }) {
  // Clear session storage
  sessionStorage.removeItem("domino_roomId");
  sessionStorage.removeItem("domino_mySeat");
  
  // Show game over message
  alert(`Game over! Team ${winningTeam} wins.\nScores: ${scores.join(" / ")}`);
  setStatus("Game over.");
}

function handleReconnectSuccess() {
  console.log("Successfully reconnected to game");
}

function handleBonusAwarded({ seat, type, points, scores }) {
  gameState.scores = scores || [0, 0];
  renderScores();
  addMessage(`Team ${seat % 2} gets +${points} pts for ${type}!`);
}

/* ────────────────────────────────────────────────────────────────────────
 * Initialize the game when page loads
 * ────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', initializeGame);