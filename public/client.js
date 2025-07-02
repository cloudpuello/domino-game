/* =========================================================================
   client.js — (Final, Fully Synced Version)
   ========================================================================= */

// ── Socket + basic state ────────────────────────────────────────────────
const socket = io();
const playerName = prompt('Enter your name:') || 'Anonymous';

let roomId        = null;
let mySeat        = null;        // 0-3
let currentTurn   = null;        // whose turn
let myHand        = [];
let boardState    = [];
let scores        = [0, 0];      // [team 0&2, team 1&3]
let seatMap       = {};          // seat → { name }

// ── DOM handles ─────────────────────────────────────────────────────────
const statusEl         = document.getElementById('status');
const boardEl          = document.getElementById('board');
const handEl           = document.getElementById('hand');
const lobbyListEl      = document.getElementById('lobbyList');
const lobbyContainerEl = document.getElementById('lobbyContainer');
const scoresEl         = document.getElementById('scores');
const playerInfoEl     = document.getElementById('playerInfo');
const errorsEl         = document.getElementById('errors');
const msgEl            = document.getElementById('messages');
const pipEl            = document.getElementById('pipCounts');
const topEl            = document.getElementById('topPlayer');
const leftEl           = document.getElementById('leftPlayer');
const rightEl          = document.getElementById('rightPlayer');

// ask server for a room
socket.emit('findRoom', { playerName });

/* ── Helpers ──────────────────────────────────────────────────────────── */
const setStatus = txt => (statusEl.textContent = txt);
const showError = txt => {
  errorsEl.textContent = txt;
  setTimeout(() => (errorsEl.textContent = ''), 4000);
};
const addMsg = txt => {
  const p = document.createElement('div');
  p.textContent = txt;
  msgEl.prepend(p);
};

function renderLobby(players) {
  lobbyListEl.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `Seat ${p.seat}: ${p.name}`;
    lobbyListEl.appendChild(li);
  });
}

function renderBoard() {
  boardEl.innerHTML = '';
  boardState.forEach(t => {
    const d = document.createElement('div');
    d.className = 'tile disabled';
    d.textContent = `${t[0]}|${t[1]}`;
    boardEl.appendChild(d);
  });
}

function renderHand() {
  handEl.innerHTML = '';
  myHand.forEach((t, i) => {
    const d = document.createElement('div');
    d.className = 'tile' + (currentTurn === mySeat ? ' your-turn' : ' disabled');
    d.textContent = `${t[0]}|${t[1]}`;
    if (currentTurn === mySeat) d.onclick = () => playTile(i);
    handEl.appendChild(d);
  });
}

function seatPos(seat) {
  if (seat === mySeat) return 'self';
  const diff = (seat - mySeat + 4) % 4;
  if (diff === 1) return 'right';
  if (diff === 2) return 'top';
  return 'left';
}

function renderOpponents() {
  topEl.textContent = leftEl.textContent = rightEl.textContent = '';
  Object.entries(seatMap).forEach(([s, info]) => {
    const pos = seatPos(+s);
    if (pos === 'top')   topEl.textContent   = `Seat ${s}: ${info.name}`;
    if (pos === 'left')  leftEl.textContent  = `Seat ${s}: ${info.name}`;
    if (pos === 'right') rightEl.textContent = `Seat ${s}: ${info.name}`;
  });
}

function renderScores() {
  scoresEl.textContent = `Team 0&2: ${scores[0]} — Team 1&3: ${scores[1]}`;
}

function renderPips(pipCounts) {
  pipEl.textContent = pipCounts
    ? Object.entries(pipCounts).map(([p, c]) => `${p}:${c}`).join(' | ')
    : '';
}

/* ── Moves ────────────────────────────────────────────────────────────── */
function playTile(idx) {
  if (currentTurn !== mySeat) return;
  const tile = myHand[idx];
  let side = prompt('Side? left / right (blank = auto)');
  if (side !== 'left' && side !== 'right') side = null;
  socket.emit('playTile', { roomId, seat: mySeat, tile, side });
}

/* ── Socket events ────────────────────────────────────────────────────── */
socket.on('roomAssigned', ({ room }) => {
  roomId = room;
  setStatus(`Joined room ${room}. Waiting for others…`);
});

socket.on('roomJoined', ({ seat }) => {
  mySeat = seat;
  playerInfoEl.textContent =
    `You are Seat ${seat} (Team ${seat % 2 === 0 ? '0&2' : '1&3'})`;
});

socket.on('lobbyUpdate', ({ players, seatsRemaining }) => {
  lobbyContainerEl.style.display = 'block';
  seatMap = Object.fromEntries(players.map(p => [p.seat, p]));
  renderLobby(players);
  renderOpponents();
  setStatus(`Waiting for players (${seatsRemaining} seat${seatsRemaining !== 1 ? 's' : ''} left)`);
});

// THIS IS THE CORRECTED LINE
socket.on('roundStart', ({ yourHand, startingSeat, scores: s }) => {
  lobbyContainerEl.style.display = 'none';
  myHand = yourHand;
  boardState = [];
  scores = s;
  currentTurn = startingSeat;
  msgEl.innerHTML = '';
  renderScores();
  renderBoard();
  renderHand();
  setStatus(currentTurn === mySeat ? 'Your turn!' : `Waiting for seat ${currentTurn}`);
});

socket.on('updateHand', hand => {
  myHand = hand;
  renderHand();
});

socket.on('broadcastMove', ({ seat, tile, board, pipCounts }) => {
  boardState = board;
  renderBoard();
  renderPips(pipCounts);
  addMsg(`Seat ${seat} played ${tile[0]}|${tile[1]}.`);
});

socket.on('turnChanged', turn => {
  currentTurn = turn;
  setStatus(turn === mySeat ? 'Your turn!' : `Waiting for seat ${turn}`);
  renderHand();
});

socket.on('playerPassed', ({ seat }) => {
  addMsg(`Seat ${seat} passed.`);
});

socket.on('roundEnded', ({ winner, reason, points, scores: s, board, capicua, paso, pipCounts }) => {
  boardState = board;
  scores = s;
  renderScores();
  renderBoard();
  renderPips(pipCounts);
  let msg = `Seat ${winner} wins (${reason}) +${points} pts.`;
  if (capicua) msg += ' Capicú!';
  if (paso)    msg += ' Paso!';
  setStatus(msg);
  addMsg(msg);
});

socket.on('gameOver', ({ winningTeam, scores }) => {
  alert(`Game over! Team ${winningTeam} wins.\nScores: ${scores.join(' / ')}`);
  setStatus('Game over.');
});

socket.on('errorMessage', showError);
socket.on('message', msg => addMsg(msg));