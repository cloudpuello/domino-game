/* =========================================================================
   client.js — Dominican Domino front-end
   ========================================================================= */

const socket = io();
const playerName = prompt("Enter your name:") || "Anonymous";

/* -------------------------------------------------------------------------- */
/* State                                                                      */
/* -------------------------------------------------------------------------- */
let roomId      = null;
let mySeat      = null;
let currentTurn = null;
let myHand      = [];
let boardState  = [];
let scores      = [0, 0];
let seatMap     = {};
let handSizes   = {};

/* drag helper */
let dragged = {
  element:      null,
  originalTile: null,
  tileData:     null,
  isDragging:   false,
  hoveredSide:  null
};

/* -------------------------------------------------------------------------- */
/* DOM handles                                                                */
/* -------------------------------------------------------------------------- */
const $          = id => document.getElementById(id);
const statusEl   = $("status");
const boardEl    = $("board");
const handEl     = $("hand");
const lobbyListEl= $("lobbyList");
const lobbyContainerEl = $("lobbyContainer");
const playerInfoEl= $("playerInfo");
const errorsEl   = $("errors");
const msgEl      = $("messages");
const pipEl      = $("pipCounts");
const topEl      = $("topPlayer");
const leftEl     = $("leftPlayer");
const rightEl    = $("rightPlayer");
const team0ScoreEl = $("team0-score");
const team1ScoreEl = $("team1-score");

/* -------------------------------------------------------------------------- */
/* Reconnect                                                                  */
/* -------------------------------------------------------------------------- */
socket.emit("findRoom", {
  playerName,
  roomId:        sessionStorage.getItem("domino_roomId"),
  reconnectSeat: sessionStorage.getItem("domino_mySeat")
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */
const setStatus = t => (statusEl.textContent = t);
const showError = t => { errorsEl.textContent = t; setTimeout(() => errorsEl.textContent = "", 4000); };
const addMsg    = t => { const d = document.createElement("div"); d.textContent = t; msgEl.prepend(d); };

function adjustBoardCenter() {
  boardEl.classList.toggle("board-center", boardEl.scrollWidth <= boardEl.clientWidth);
}
window.addEventListener("resize", adjustBoardCenter);

/* -------------------------------------------------------------------------- */
/* Pip layout look-up                                                         */
/* -------------------------------------------------------------------------- */
const pipLayouts = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]]
};

function halfHTML(n) {
  let html = '<div class="half">';
  pipLayouts[n].forEach(([r, c]) => {
    html += `<span class="pip" style="grid-area:${r + 1}/${c + 1}"></span>`;
  });
  html += '</div>';
  return html;
}
const tileHTML = ([a, b]) => halfHTML(a) + '<div class="separator"></div>' + halfHTML(b);

/* -------------------------------------------------------------------------- */
/* Board & placeholders                                                       */
/* -------------------------------------------------------------------------- */
function renderPlaceholder() {
  const ph = document.createElement("div");
  ph.className = "tile-placeholder drop-target";
  ph.dataset.side = "left";
  ph.textContent = boardState.length === 0 ? "6|6" : "PLAY";
  boardEl.appendChild(ph);
}

function renderBoard() {
  boardEl.innerHTML = "";
  if (boardState.length === 0) {
    renderPlaceholder();
  } else {
    boardState.forEach(t => {
      const dom = document.createElement("div");
      dom.className = "tile disabled";
      if (t[0] === t[1]) dom.classList.add("double");
      dom.innerHTML = tileHTML(t);
      boardEl.appendChild(dom);
    });
  }
  adjustBoardCenter();
}

/* -------------------------------------------------------------------------- */
/* Hand rendering                                                             */
/* -------------------------------------------------------------------------- */
function getBoardEnds() {
  if (boardState.length === 0) return null;
  return {
    leftTile:  boardEl.firstChild,
    leftPip:   boardState[0][0],
    rightTile: boardEl.lastChild,
    rightPip:  boardState.at(-1)[1]
  };
}

/* FIXED opener logic – ignore scores; only board emptiness matters */
function isTilePlayable([a, b], ends) {
  const firstMove = boardState.length === 0;
  if (firstMove) return a === 6 && b === 6;
  return ends && (
    a === ends.leftPip  || b === ends.leftPip ||
    a === ends.rightPip || b === ends.rightPip
  );
}

function renderHand() {
  handEl.innerHTML = "";
  const ends = getBoardEnds();
  myHand.forEach(tile => {
    const d = document.createElement("div");
    d.className = "tile";
    d.innerHTML = tileHTML(tile);

    const playable = isTilePlayable(tile, ends);
    if (currentTurn === mySeat && playable) {
      d.classList.add("playable");
      d.addEventListener("mousedown", e => handleDragStart(e, tile, d));
      d.addEventListener("touchstart", e => handleDragStart(e, tile, d), { passive: false });
      d.addEventListener("dragstart", e => e.preventDefault());
    } else {
      d.classList.add("disabled");
    }
    handEl.appendChild(d);
  });
}

/* -------------------------------------------------------------------------- */
/* Drag helpers (unchanged)                                                   */
/* -------------------------------------------------------------------------- */
const HIT_PADDING = 25;
const getPos = e => e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
const insideExpand = (p, r) =>
  p.x > r.left - HIT_PADDING && p.x < r.right + HIT_PADDING &&
  p.y > r.top  - HIT_PADDING && p.y < r.bottom + HIT_PADDING;

function markEnds([a, b]) {
  const e = getBoardEnds();
  if (!e) return;
  if (a === e.leftPip  || b === e.leftPip)  { e.leftTile.classList.add("drop-target");  e.leftTile.dataset.side  = "left"; }
  if (a === e.rightPip || b === e.rightPip) { e.rightTile.classList.add("drop-target"); e.rightTile.dataset.side = "right"; }
}

function cleanupDrag() {
  if (dragged.element) dragged.element.remove();
  document.querySelectorAll(".drop-target").forEach(el => {
    el.classList.remove("drop-target", "drop-hover");
    el.removeAttribute("data-side");
  });
  if (dragged.originalTile) dragged.originalTile.classList.remove("ghost");
  document.removeEventListener("mousemove", move);
  document.removeEventListener("mouseup", end);
  document.removeEventListener("touchmove", move);
  document.removeEventListener("touchend", end);
  dragged = { element: null, originalTile: null, tileData: null, isDragging: false, hoveredSide: null };
}

function start(e, tile, tEl) {
  if (e.type === "touchstart") e.preventDefault();
  if (dragged.isDragging) return;

  dragged = { tileData: tile, originalTile: tEl, isDragging: true, hoveredSide: null };
  dragged.element = tEl.cloneNode(true);
  dragged.element.classList.add("dragging");
  document.body.appendChild(dragged.element);
  tEl.classList.add("ghost");

  markEnds(tile);

  const p = getPos(e);
  dragged.element.style.left = p.x + "px";
  dragged.element.style.top  = p.y + "px";

  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", end);
  document.addEventListener("touchmove", move, { passive: false });
  document.addEventListener("touchend", end);
}

function move(e) {
  if (!dragged.isDragging) return;
  e.preventDefault();
  const p = getPos(e);
  dragged.element.style.left = p.x + "px";
  dragged.element.style.top  = p.y + "px";

  let ok = false;
  document.querySelectorAll(".drop-target").forEach(t => {
    const r = t.getBoundingClientRect();
    if (insideExpand(p, r)) {
      ok = true;
      dragged.hoveredSide = t.dataset.side;
      t.classList.add("drop-hover");
    } else {
      t.classList.remove("drop-hover");
    }
  });
  if (!ok) dragged.hoveredSide = null;
}

function end() {
  if (!dragged.isDragging) return;
  const side = dragged.hoveredSide || (boardState.length === 0 ? "left" : null);
  if (side) socket.emit("playTile", { roomId, seat: mySeat, tile: dragged.tileData, side });
  else dragged.originalTile.classList.remove("ghost");
  cleanupDrag();
}

/* -------------------------------------------------------------------------- */
/* Graphics helpers                                                           */
/* -------------------------------------------------------------------------- */
function seatPos(s) {
  if (s === mySeat) return "self";
  const d = (s - mySeat + 4) % 4;
  return d === 1 ? "right" : d === 2 ? "top" : "left";
}

function renderOpponents() {
  const areas = { top: topEl, left: leftEl, right: rightEl };
  Object.values(areas).forEach(el => el.innerHTML = "");
  Object.entries(seatMap).forEach(([s, info]) => {
    s = +s;
    if (s === mySeat) return;
    const a = areas[seatPos(s)];
    if (!a) return;
    const n = document.createElement("div");
    n.textContent = `${info.name} (Seat ${s})`;
    a.appendChild(n);
    const hd = document.createElement("div");
    hd.className = "player-area-hand-display";
    const cnt = handSizes[s] || 0;
    for (let i = 0; i < cnt; i++) {
      const d = document.createElement("div");
      d.className = "dummy-tile";
      hd.appendChild(d);
    }
    a.appendChild(hd);
  });
}

const renderScores = () => {
  team0ScoreEl.textContent = scores[0];
  team1ScoreEl.textContent = scores[1];
};

const renderPips = c => {
  pipEl.textContent = c ? Object.entries(c).map(([p, n]) => `${p}:${n}`).join(" | ") : "";
};

/* -------------------------------------------------------------------------- */
/* Socket events                                                              */
/* -------------------------------------------------------------------------- */
socket.on("roomJoined", ({ roomId: id, seat }) => {
  roomId = id;
  mySeat = seat;
  sessionStorage.setItem("domino_roomId", roomId);
  sessionStorage.setItem("domino_mySeat", mySeat);
  playerInfoEl.textContent = `You are Seat ${seat} (Team ${seat % 2 === 0 ? "0 & 2" : "1 & 3"})`;
});

socket.on("lobbyUpdate", ({ players }) => {
  lobbyContainerEl.style.display = "block";
  seatMap = Object.fromEntries(players.map(p => [p.seat, p]));
  lobbyListEl.innerHTML = "";
  players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `Seat ${p.seat}: ${p.name}`;
    lobbyListEl.appendChild(li);
  });
});

socket.on("roundStart", ({ yourHand, startingSeat, scores: s }) => {
  lobbyContainerEl.style.display = "none";
  myHand = yourHand;
  boardState = [];
  scores = s;
  currentTurn = startingSeat;
  msgEl.innerHTML = "";
  handSizes = { 0: 7, 1: 7, 2: 7, 3: 7 };
  cleanupDrag();
  renderScores();
  renderBoard();
  renderHand();
  renderOpponents();
  setStatus(currentTurn === mySeat ? "Your turn!" : `Waiting for seat ${currentTurn}`);
});

socket.on("updateHand", h => {
  myHand = h;
  handSizes[mySeat] = h.length;
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

socket.on("turnChanged", turn => {
  currentTurn = turn;
  setStatus(turn === mySeat ? "Your turn!" : `Waiting for seat ${turn}`);
  cleanupDrag();
  renderHand();
  [topEl, leftEl, rightEl, handEl].forEach(el => el.classList.remove("active-turn-indicator"));
  const pos = seatPos(turn);
  (pos === "top" ? topEl : pos === "left" ? leftEl : pos === "right" ? rightEl : handEl)
    .classList.add("active-turn-indicator");
});

socket.on("playerPassed", ({ seat }) => addMsg(`Seat ${seat} passed.`));

socket.on("roundEnded", ({ winner, reason, points, scores: s, board }) => {
  boardState = board;
  scores = s;
  cleanupDrag();
  renderScores();
  renderBoard();
  setStatus(`Seat ${winner} wins (${reason}) +${points} pts.`);
  addMsg(`Seat ${winner} wins (${reason}) +${points} pts.`);
});

socket.on("gameOver", ({ winningTeam, scores: s }) => {
  sessionStorage.removeItem("domino_roomId");
  sessionStorage.removeItem("domino_mySeat");
  alert(`Game over! Team ${winningTeam} wins.\nScores: ${s.join(" / ")}`);
  setStatus("Game over.");
});

socket.on("reconnectSuccess", () => console.log("Reconnected"));
socket.on("errorMessage", showError);
socket.on("bonusAwarded", ({ seat, type, points, scores: s }) => {
  scores = s;
  renderScores();
  addMsg(`Team ${seat % 2} gets +${points} pts for ${type}!`);
});

/* -------------------------------------------------------------------------- */
/* Event bindings                                                             */
/* -------------------------------------------------------------------------- */
function handleDragStart(e, tile, tEl) { start(e, tile, tEl); }
