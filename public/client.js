/* =====================================================================
 * client.js — Dominican Domino front-end (REWRITTEN)
 * =================================================================== */

/* ────────────────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────────────────── */
const HIT_PADDING = 25;
const ERROR_DISPLAY_TIME = 4000;
const OPENING_TILE = [6, 6];
const HAND_SIZE = 7;

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
  handSizes: {}
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
  team1Score: $("team1-score")
};

/* ────────────────────────────────────────────────────────────────────────
 * Pip layouts for domino rendering
 * ────────────────────────────────────────────────────────────────────── */
const PIP_LAYOUTS = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]]
};

/* ────────────────────────────────────────────────────────────────────────
 * Initialization and reconnection
 * ────────────────────────────────────────────────────────────────────── */
function initializeGame() {
  setupSocketListeners();
  attemptReconnection();
  setupWindowListeners();
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

/* ────────────────────────────────────────────────────────────────────────
 * UI Helper functions
 * ────────────────────────────────────────────────────────────────────── */
function setStatus(text) {
  elements.status.textContent = text;
}

function showError(text) {
  elements.errors.textContent = text;
  setTimeout(() => {
    elements.errors.textContent = "";
  }, ERROR_DISPLAY_TIME);
}

function addMessage(text) {
  const messageDiv = document.createElement("div");
  messageDiv.textContent = text;
  elements.messages.prepend(messageDiv);
}

function adjustBoardCenter() {
  const shouldCenter = elements.board.scrollWidth <= elements.board.clientWidth;
  elements.board.classList.toggle("board-center", shouldCenter);
}

/* ────────────────────────────────────────────────────────────────────────
 * Domino tile rendering
 * ────────────────────────────────────────────────────────────────────── */
function createHalfHTML(pipCount) {
  let html = '<div class="half">';
  
  PIP_LAYOUTS[pipCount].forEach(([row, col]) => {
    html += `<span class="pip" style="grid-area:${row + 1}/${col + 1}"></span>`;
  });
  
  html += '</div>';
  return html;
}

function createTileHTML([leftPips, rightPips]) {
  return createHalfHTML(leftPips) + 
         '<div class="separator"></div>' + 
         createHalfHTML(rightPips);
}

/* ────────────────────────────────────────────────────────────────────────
 * Board rendering
 * ────────────────────────────────────────────────────────────────────── */
function renderPlaceholder() {
  const placeholder = document.createElement("div");
  placeholder.className = "tile-placeholder drop-target";
  placeholder.dataset.side = "left";
  placeholder.textContent = gameState.boardState.length === 0 ? "6|6" : "PLAY";
  elements.board.appendChild(placeholder);
}

function renderBoard() {
  elements.board.innerHTML = "";
  
  if (gameState.boardState.length === 0) {
    renderPlaceholder();
  } else {
    gameState.boardState.forEach(tile => {
      const tileElement = document.createElement("div");
      tileElement.className = "tile disabled";
      
      if (tile[0] === tile[1]) {
        tileElement.classList.add("double");
      }
      
      tileElement.innerHTML = createTileHTML(tile);
      elements.board.appendChild(tileElement);
    });
  }
  
  adjustBoardCenter();
}

/* ────────────────────────────────────────────────────────────────────────
 * Game logic helpers
 * ────────────────────────────────────────────────────────────────────── */
function getBoardEnds() {
  if (gameState.boardState.length === 0) return null;
  
  return {
    leftTile: elements.board.firstChild,
    leftPip: gameState.boardState[0][0],
    rightTile: elements.board.lastChild,
    rightPip: gameState.boardState.at(-1)[1]
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
 * Hand rendering
 * ────────────────────────────────────────────────────────────────────── */
function renderHand() {
  elements.hand.innerHTML = "";
  const ends = getBoardEnds();
  
  gameState.myHand.forEach(tile => {
    const tileElement = createHandTileElement(tile, ends);
    elements.hand.appendChild(tileElement);
  });
}

function createHandTileElement(tile, ends) {
  const tileElement = document.createElement("div");
  tileElement.className = "tile";
  tileElement.innerHTML = createTileHTML(tile);
  
  const playable = isTilePlayable(tile, ends);
  
  if (isMyTurn() && playable) {
    makePlayableTile(tileElement, tile);
  } else {
    tileElement.classList.add("disabled");
  }
  
  return tileElement;
}

function makePlayableTile(tileElement, tile) {
  tileElement.classList.add("playable");
  tileElement.addEventListener("mousedown", e => startDrag(e, tile, tileElement));
  tileElement.addEventListener("touchstart", e => startDrag(e, tile, tileElement), { passive: false });
  tileElement.addEventListener("dragstart", e => e.preventDefault());
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

function isPositionInExpandedRect(position, rect) {
  return position.x > rect.left - HIT_PADDING && 
         position.x < rect.right + HIT_PADDING &&
         position.y > rect.top - HIT_PADDING && 
         position.y < rect.bottom + HIT_PADDING;
}

function markValidDropTargets([a, b]) {
  const ends = getBoardEnds();
  if (!ends) return;
  
  if (a === ends.leftPip || b === ends.leftPip) {
    ends.leftTile.classList.add("drop-target");
    ends.leftTile.dataset.side = "left";
  }
  
  if (a === ends.rightPip || b === ends.rightPip) {
    ends.rightTile.classList.add("drop-target");
    ends.rightTile.dataset.side = "right";
  }
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
  
  if (dragState.isDragging) return;
  
  // Set up drag state
  Object.assign(dragState, {
    tileData: tile,
    originalTile: tileElement,
    isDragging: true,
    hoveredSide: null
  });
  
  // Create dragged element
  dragState.element = tileElement.cloneNode(true);
  dragState.element.classList.add("dragging");
  document.body.appendChild(dragState.element);
  
  // Mark original tile as ghost
  tileElement.classList.add("ghost");
  
  // Mark valid drop targets
  markValidDropTargets(tile);
  
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
  
  // Check for valid drop targets
  let foundValidTarget = false;
  
  document.querySelectorAll(".drop-target").forEach(target => {
    const rect = target.getBoundingClientRect();
    
    if (isPositionInExpandedRect(position, rect)) {
      foundValidTarget = true;
      dragState.hoveredSide = target.dataset.side;
      target.classList.add("drop-hover");
    } else {
      target.classList.remove("drop-hover");
    }
  });
  
  if (!foundValidTarget) {
    dragState.hoveredSide = null;
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
    dragState.originalTile.classList.remove("ghost");
  }
  
  cleanupDrag();
}

/* ────────────────────────────────────────────────────────────────────────
 * Player position and opponent rendering
 * ────────────────────────────────────────────────────────────────────── */
function getRelativePlayerPosition(seat) {
  if (seat === gameState.mySeat) return "self";
  
  const difference = (seat - gameState.mySeat + 4) % 4;
  switch (difference) {
    case 1: return "right";
    case 2: return "top";
    case 3: return "left";
    default: return "self";
  }
}

function renderOpponents() {
  const playerAreas = {
    top: elements.topPlayer,
    left: elements.leftPlayer,
    right: elements.rightPlayer
  };
  
  // Clear all player areas
  Object.values(playerAreas).forEach(area => {
    area.innerHTML = "";
  });
  
  // Render each opponent
  Object.entries(gameState.seatMap).forEach(([seat, playerInfo]) => {
    const seatNumber = Number(seat);
    if (seatNumber === gameState.mySeat) return;
    
    const position = getRelativePlayerPosition(seatNumber);
    const area = playerAreas[position];
    if (!area) return;
    
    renderPlayerInArea(area, playerInfo, seatNumber);
  });
}

function renderPlayerInArea(area, playerInfo, seat) {
  // Player name
  const nameElement = document.createElement("div");
  nameElement.textContent = `${playerInfo.name} (Seat ${seat})`;
  area.appendChild(nameElement);
  
  // Player's hand display
  const handDisplay = document.createElement("div");
  handDisplay.className = "player-area-hand-display";
  
  const tileCount = gameState.handSizes[seat] || 0;
  for (let i = 0; i < tileCount; i++) {
    const dummyTile = document.createElement("div");
    dummyTile.className = "dummy-tile";
    handDisplay.appendChild(dummyTile);
  }
  
  area.appendChild(handDisplay);
}

/* ────────────────────────────────────────────────────────────────────────
 * Score and pip count rendering
 * ────────────────────────────────────────────────────────────────────── */
function renderScores() {
  elements.team0Score.textContent = gameState.scores[0];
  elements.team1Score.textContent = gameState.scores[1];
}

function renderPipCounts(pipCounts) {
  if (!pipCounts) {
    elements.pipCounts.textContent = "";
    return;
  }
  
  const pipCountText = Object.entries(pipCounts)
    .map(([pip, count]) => `${pip}:${count}`)
    .join(" | ");
  
  elements.pipCounts.textContent = pipCountText;
}

/* ────────────────────────────────────────────────────────────────────────
 * Turn indicator management
 * ────────────────────────────────────────────────────────────────────── */
function updateTurnIndicators(currentTurn) {
  // Remove indicators from all areas
  const allAreas = [elements.topPlayer, elements.leftPlayer, elements.rightPlayer, elements.hand];
  allAreas.forEach(area => area.classList.remove("active-turn-indicator"));
  
  // Add indicator to current player's area
  const position = getRelativePlayerPosition(currentTurn);
  const areaMap = {
    top: elements.topPlayer,
    left: elements.leftPlayer,
    right: elements.rightPlayer,
    self: elements.hand
  };
  
  const activeArea = areaMap[position];
  if (activeArea) {
    activeArea.classList.add("active-turn-indicator");
  }
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
  const teamNumber = seat % 2 === 0 ? "0 & 2" : "1 & 3";
  elements.playerInfo.textContent = `You are Seat ${seat} (Team ${teamNumber})`;
}

function handleLobbyUpdate({ players }) {
  elements.lobbyContainer.style.display = "block";
  
  // Update seat map
  gameState.seatMap = Object.fromEntries(
    players.map(player => [player.seat, player])
  );
  
  // Update lobby list
  elements.lobbyList.innerHTML = "";
  players.forEach(player => {
    const listItem = document.createElement("li");
    listItem.textContent = `Seat ${player.seat}: ${player.name}`;
    elements.lobbyList.appendChild(listItem);
  });
}

function handleRoundStart({ yourHand, startingSeat, scores }) {
  elements.lobbyContainer.style.display = "none";
  
  // Update game state
  gameState.myHand = yourHand;
  gameState.boardState = [];
  gameState.scores = scores;
  gameState.currentTurn = startingSeat;
  gameState.handSizes = { 0: HAND_SIZE, 1: HAND_SIZE, 2: HAND_SIZE, 3: HAND_SIZE };
  
  // Clear messages and cleanup
  elements.messages.innerHTML = "";
  cleanupDrag();
  
  // Render everything
  renderScores();
  renderBoard();
  renderHand();
  renderOpponents();
  
  // Update status
  const statusText = gameState.currentTurn === gameState.mySeat ? 
    "Your turn!" : 
    `Waiting for seat ${gameState.currentTurn}`;
  setStatus(statusText);
}

function handleHandUpdate(newHand) {
  gameState.myHand = newHand;
  gameState.handSizes[gameState.mySeat] = newHand.length;
  renderHand();
  renderOpponents();
}

function handleMoveUpdate({ seat, tile, board, pipCounts }) {
  gameState.boardState = board;
  
  // Update hand size for other players
  if (seat !== gameState.mySeat) {
    gameState.handSizes[seat]--;
  }
  
  cleanupDrag();
  renderBoard();
  renderPipCounts(pipCounts);
  renderOpponents();
  
  addMessage(`${seat} played ${tile[0]}|${tile[1]}.`);
}

function handleTurnChange(turn) {
  gameState.currentTurn = turn;
  
  const statusText = turn === gameState.mySeat ? 
    "Your turn!" : 
    `Waiting for seat ${turn}`;
  setStatus(statusText);
  
  cleanupDrag();
  renderHand();
  updateTurnIndicators(turn);
}

function handlePlayerPassed({ seat }) {
  addMessage(`Seat ${seat} passed.`);
}

function handleRoundEnd({ winner, reason, points, scores, board }) {
  gameState.boardState = board;
  gameState.scores = scores;
  
  cleanupDrag();
  renderScores();
  renderBoard();
  
  const statusText = `Seat ${winner} wins (${reason}) +${points} pts.`;
  setStatus(statusText);
  addMessage(statusText);
}

function handleGameOver({ winningTeam, scores }) {
  // Clear session storage
  sessionStorage.removeItem("domino_roomId");
  sessionStorage.removeItem("domino_mySeat");
  
  // Show game over message
  alert(`Game over! Team ${winningTeam} wins.\\nScores: ${scores.join(" / ")}`);
  setStatus("Game over.");
}

function handleReconnectSuccess() {
  console.log("Successfully reconnected to game");
}

function handleBonusAwarded({ seat, type, points, scores }) {
  gameState.scores = scores;
  renderScores();
  addMessage(`Team ${seat % 2} gets +${points} pts for ${type}!`);
}

/* ────────────────────────────────────────────────────────────────────────
 * Initialize the game when page loads
 * ────────────────────────────────────────────────────────────────────── */
initializeGame();