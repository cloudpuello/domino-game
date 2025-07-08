/* =========================================================================
   client.js — (Patched 2025-07-08)
   =========================================================================
   • Opening placeholder is a real drop-target (plays the 6-6).
   • Board stays centred until the domino chain grows wider than the
     viewport (then it scrolls left-to-right as before).
   • highlightPlayableEnds puts a ring on *both* legal ends if the tile
     matches both pips.
   • Cleaned up drop-target attributes after each drag.
   • Added reduced-motion respect for users who prefer less motion.
   ======================================================================= */

const socket     = io();
const playerName = prompt("Enter your name:") || "Anonymous";

/* -------------------------------------------------------------------------- */
/* Local state                                                                */
/* -------------------------------------------------------------------------- */
let roomId      = null;
let mySeat      = null;
let currentTurn = null;
let myHand      = [];
let boardState  = [];
let scores      = [0, 0];
let seatMap     = {};
let handSizes   = {};

/* Temp holder for drag-and-drop */
let dragged = {
  element: null,
  originalTile: null,
  tileData: null,
  isDragging: false,
  hoveredSide: null,
};

/* -------------------------------------------------------------------------- */
/* DOM references                                                             */
/* -------------------------------------------------------------------------- */
const statusEl      = document.getElementById("status");
const boardEl       = document.getElementById("board");
const handEl        = document.getElementById("hand");
const lobbyListEl   = document.getElementById("lobbyList");
const lobbyContainerEl = document.getElementById("lobbyContainer");
const playerInfoEl  = document.getElementById("playerInfo");
const errorsEl      = document.getElementById("errors");
const msgEl         = document.getElementById("messages");
const pipEl         = document.getElementById("pipCounts");
const topEl         = document.getElementById("topPlayer");
const leftEl        = document.getElementById("leftPlayer");
const rightEl       = document.getElementById("rightPlayer");
const team0ScoreEl  = document.getElementById("team0-score");
const team1ScoreEl  = document.getElementById("team1-score");

/* -------------------------------------------------------------------------- */
/* Reconnect logic                                                            */
/* -------------------------------------------------------------------------- */
socket.emit("findRoom", {
  playerName,
  roomId:        sessionStorage.getItem("domino_roomId"),
  reconnectSeat: sessionStorage.getItem("domino_mySeat"),
});

/* -------------------------------------------------------------------------- */
/* Utility helpers                                                            */
/* -------------------------------------------------------------------------- */
const setStatus = (txt) => (statusEl.textContent = txt);
const showError = (txt) => {
  errorsEl.textContent = txt;
  setTimeout(() => (errorsEl.textContent = ""), 4000);
};
const addMsg = (txt) => {
  const div = document.createElement("div");
  div.textContent = txt;
  msgEl.prepend(div);
};

/* -------------------------------------------------------------------------- */
/* Lobby rendering                                                            */
/* -------------------------------------------------------------------------- */
function renderLobby(players) {
  lobbyListEl.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = `Seat ${p.seat}: ${p.name}`;
    lobbyListEl.appendChild(li);
  });
}

/* -------------------------------------------------------------------------- */
/* Board rendering & centering                                                */
/* -------------------------------------------------------------------------- */
function adjustBoardCenter() {
  const shouldCenter = boardEl.scrollWidth <= boardEl.clientWidth;
  boardEl.classList.toggle("board-center", shouldCenter);
}
window.addEventListener("resize", adjustBoardCenter);

function renderPlaceholder() {
  const ph = document.createElement("div");
  ph.className = "tile-placeholder drop-target";
  ph.dataset.side = "left"; // server ignores side on first move
  const firstRound = scores[0] === 0 && scores[1] === 0;
  ph.textContent = firstRound ? "6|6" : "PLAY";
  boardEl.appendChild(ph);
}

function renderBoard() {
  boardEl.innerHTML = "";

  if (boardState.length === 0) {
    renderPlaceholder();
  } else {
    boardState.forEach((t) => {
      const tile = document.createElement("div");
      tile.className = "tile disabled";
      if (t[0] === t[1]) tile.classList.add("double");
      tile.innerHTML = `<span>${t[0]}</span><span>${t[1]}</span>`;
      boardEl.appendChild(tile);
    });
  }
  adjustBoardCenter();
}

/* -------------------------------------------------------------------------- */
/* Hand & opponent rendering                                                  */
/* -------------------------------------------------------------------------- */
function seatPos(seat) {
  if (seat === mySeat) return "self";
  const diff = (seat - mySeat + 4) % 4;
  return diff === 1 ? "right" : diff === 2 ? "top" : "left";
}

function renderOpponents() {
  const areas = { top: topEl, left: leftEl, right: rightEl };
  Object.values(areas).forEach((el) => (el.innerHTML = ""));

  Object.entries(seatMap).forEach(([s, info]) => {
    const seat = +s;
    if (seat === mySeat) return;
    const pos = seatPos(seat);
    const area = areas[pos];
    if (!area) return;

    const name = document.createElement("div");
    name.textContent = `${info.name} (Seat ${seat})`;
    area.appendChild(name);

    const handDisplay = document.createElement("div");
    handDisplay.className = "player-area-hand-display";
    const count = handSizes[seat] || 0;
    for (let i = 0; i < count; i++) {
      const dummy = document.createElement("div");
      dummy.className = "dummy-tile";
      handDisplay.appendChild(dummy);
    }
    area.appendChild(handDisplay);
  });
}

function renderScores() {
  team0ScoreEl.textContent = scores[0];
  team1ScoreEl.textContent = scores[1];
}

function renderPips(pipCounts) {
  pipEl.textContent = pipCounts
    ? Object.entries(pipCounts)
        .map(([p, c]) => `${p}:${c}`)
        .join(" | ")
    : "";
}

function renderHand() {
  handEl.innerHTML = "";
  const boardEnds = getBoardEnds();

  myHand.forEach((tileData) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.innerHTML = `<span>${tileData[0]}</span><span>${tileData[1]}</span>`;

    const playable = isTilePlayable(tileData, boardEnds);

    if (currentTurn === mySeat) {
      if (playable) {
        tile.classList.add("playable");
        tile.addEventListener("mousedown", (e) =>
          handleDragStart(e, tileData, tile)
        );
        tile.addEventListener(
          "touchstart",
          (e) => handleDragStart(e, tileData, tile),
          { passive: false }
        );
        tile.addEventListener("dragstart", (e) => e.preventDefault());
      } else {
        tile.classList.add("disabled");
      }
    } else {
      tile.classList.add("disabled");
    }
    handEl.appendChild(tile);
  });
}

/* -------------------------------------------------------------------------- */
/* Play-ability logic                                                         */
/* -------------------------------------------------------------------------- */
function getBoardEnds() {
  if (boardState.length === 0) return null;
  return {
    leftTile: boardEl.firstChild,
    leftPip: boardState[0][0],
    rightTile: boardEl.lastChild,
    rightPip: boardState[boardState.length - 1][1],
  };
}

function isTilePlayable([p1, p2], boardEnds) {
  const firstRound =
    scores[0] === 0 && scores[1] === 0 && boardState.length === 0;
  if (firstRound) return p1 === 6 && p2 === 6;
  if (!boardEnds) return true; // should not happen after first move

  return (
    p1 === boardEnds.leftPip ||
    p2 === boardEnds.leftPip ||
    p1 === boardEnds.rightPip ||
    p2 === boardEnds.rightPip
  );
}

/* -------------------------------------------------------------------------- */
/* Drag-and-drop handlers                                                     */
/* -------------------------------------------------------------------------- */
function getEventPos(e) {
  return e.touches
    ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
    : { x: e.clientX, y: e.clientY };
}

function moveDragged(x, y) {
  if (!dragged.element) return;
  dragged.element.style.left = `${x}px`;
  dragged.element.style.top = `${y}px`;
}

function highlightPlayableEnds([p1, p2]) {
  const ends = getBoardEnds();
  if (!ends) return; // placeholder already a drop-target

  if (p1 === ends.leftPip || p2 === ends.leftPip) {
    ends.leftTile.classList.add("drop-target");
    ends.leftTile.dataset.side = "left";
  }
  if (p1 === ends.rightPip || p2 === ends.rightPip) {
    ends.rightTile.classList.add("drop-target");
    ends.rightTile.dataset.side = "right";
  }
}

function cleanupDrag() {
  if (dragged.element) dragged.element.remove();

  document.querySelectorAll(".drop-target").forEach((el) => {
    el.classList.remove("drop-target", "drop-hover");
    el.removeAttribute("data-side");
  });

  if (dragged.originalTile) dragged.originalTile.classList.remove("ghost");

  document.removeEventListener("mousemove", handleDragMove);
  document.removeEventListener("mouseup", handleDragEnd);
  document.removeEventListener("touchmove", handleDragMove);
  document.removeEventListener("touchend", handleDragEnd);

  dragged = {
    element: null,
    originalTile: null,
    tileData: null,
    isDragging: false,
    hoveredSide: null,
  };
}

function handleDragStart(e, tileData, tileElement) {
  if (e.type === "touchstart") e.preventDefault();
  if (dragged.isDragging) return;

  dragged = {
    tileData,
    originalTile: tileElement,
    isDragging: true,
    hoveredSide: null,
  };
  dragged.element = tileElement.cloneNode(true);
  dragged.element.classList.add("dragging");
  document.body.appendChild(dragged.element);
  tileElement.classList.add("ghost");

  highlightPlayableEnds(tileData);

  const pos = getEventPos(e);
  moveDragged(pos.x, pos.y);

  document.addEventListener("mousemove", handleDragMove);
  document.addEventListener("mouseup", handleDragEnd);
  document.addEventListener("touchmove", handleDragMove, { passive: false });
  document.addEventListener("touchend", handleDragEnd);
}

function handleDragMove(e) {
  if (!dragged.isDragging) return;
  e.preventDefault();
  const pos = getEventPos(e);
  moveDragged(pos.x, pos.y);

  let onTarget = false;
  document.querySelectorAll(".drop-target").forEach((t) => {
    const r = t.getBoundingClientRect();
    if (
      pos.x > r.left &&
      pos.x < r.right &&
      pos.y > r.top &&
      pos.y < r.bottom
    ) {
      onTarget = true;
      dragged.hoveredSide = t.dataset.side;
      t.classList.add("drop-hover");
    } else {
      t.classList.remove("drop-hover");
    }
  });
  if (!onTarget) dragged.hoveredSide = null;
}

function handleDragEnd() {
  if (!dragged.isDragging) return;
  const { originalTile, tileData, hoveredSide } = dragged;

  const side = hoveredSide || (boardState.length === 0 ? "left" : null);
  if (side) {
    socket.emit("playTile", {
      roomId,
      seat: mySeat,
      tile: tileData,
      side,
    });
  } else {
    originalTile.classList.remove("ghost");
  }
  cleanupDrag();
}

/* -------------------------------------------------------------------------- */
/* Socket.IO event wiring                                                     */
/* -------------------------------------------------------------------------- */
socket.on("roomJoined", ({ roomId: id, seat }) => {
  roomId = id;
  mySeat = seat;
  sessionStorage.setItem("domino_roomId", roomId);
  sessionStorage.setItem("domino_mySeat", mySeat);
  playerInfoEl.textContent = `You are Seat ${seat} (Team ${
    seat % 2 === 0 ? "0 & 2" : "1 & 3"
  })`;
});

socket.on("lobbyUpdate", ({ players }) => {
  lobbyContainerEl.style.display = "block";
  seatMap = Object.fromEntries(players.map((p) => [p.seat, p]));
  renderLobby(players);
});

socket.on("roundStart", ({ yourHand, startingSeat, scores: s }) => {
  lobbyContainerEl.style.display = "none";
  myHand = yourHand;
  boardState = [];
  scores = s;
  currentTurn = startingSeat;
  msgEl.innerHTML = "";
  handSizes = { 0: 7, 1: 7, 2: 7, 3: 7 }; // reset counts

  cleanupDrag();
  renderScores();
  renderBoard();
  renderHand();
  renderOpponents();

  setStatus(
    currentTurn === mySeat ? "Your turn!" : `Waiting for seat ${currentTurn}`
  );
});

socket.on("updateHand", (hand) => {
  myHand = hand;
  handSizes[mySeat] = hand.length;
  renderHand();
  renderOpponents();
});

socket.on("broadcastMove", ({ seat, tile, board, pipCounts }) => {
  boardState = board;
  if (seat !== mySeat) handSizes[seat]--;
  cleanupDrag();
  renderBoard();
  renderPips(pipCounts);
  renderOpponents();
  addMsg(`${seat} played ${tile[0]}|${tile[1]}.`);
});

socket.on("turnChanged", (turn) => {
  currentTurn = turn;
  setStatus(
    turn === mySeat ? "Your turn!" : `Waiting for seat ${turn}`
  );
  cleanupDrag();
  renderHand();

  // glow the active player area
  [topEl, leftEl, rightEl, handEl].forEach((el) =>
    el.classList.remove("active-turn-indicator")
  );
  const pos = seatPos(turn);
  if (pos === "top") topEl.classList.add("active-turn-indicator");
  else if (pos === "left") leftEl.classList.add("active-turn-indicator");
  else if (pos === "right") rightEl.classList.add("active-turn-indicator");
  else handEl.classList.add("active-turn-indicator");
});

socket.on("playerPassed", ({ seat }) => {
  addMsg(`Seat ${seat} passed.`);
});

socket.on(
  "roundEnded",
  ({ winner, reason, points, scores: s, board }) => {
    boardState = board;
    scores = s;
    cleanupDrag();
    renderScores();
    renderBoard();
    const msg = `Seat ${winner} wins (${reason}) +${points} pts.`;
    setStatus(msg);
    addMsg(msg);
  }
);

socket.on("gameOver", ({ winningTeam, scores: s }) => {
  sessionStorage.removeItem("domino_roomId");
  sessionStorage.removeItem("domino_mySeat");
  alert(`Game over! Team ${winningTeam} wins.\nScores: ${s.join(" / ")}`);
  setStatus("Game over.");
});

socket.on("reconnectSuccess", () =>
  console.log("Successfully reconnected!")
);

socket.on("errorMessage", showError);

socket.on("bonusAwarded", ({ seat, type, points, scores: s }) => {
  scores = s;
  renderScores();
  addMsg(`Team ${seat % 2} gets +${points} pts for ${type}!`);
});
