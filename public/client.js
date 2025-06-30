/* =========================================================================
   client.js — Dominican Domino with Auto-Pass + UI Updates
   ========================================================================= */

// ——— Socket & basic state ————————————————————————————
const socket = io();
const playerName = prompt('Enter your name:') || 'Anonymous';

let roomId      = null;
let mySeat      = null;
let currentTurn = null;
let myHand      = [];
let boardState  = [];
let scores      = [0, 0];   // [team0&2, team1&3]

// ——— DOM handles ————————————————————————————————
const statusEl     = document.getElementById('status');
const boardEl      = document.getElementById('board');
const handEl       = document.getElementById('hand');
const lobbyListEl  = document.getElementById('lobbyList');
const scoresEl     = document.getElementById('scores');
const playerInfoEl = document.getElementById('playerInfo');
const errorsEl     = document.getElementById('errors');
const passBtn      = document.getElementById('passBtn');

// Hide pass button by default
if (passBtn) passBtn.style.display = 'none';

// Ask server for a room
socket.emit('findRoom', { playerName });

/* ---------- Helpers ---------- */
const setStatus = msg => statusEl.textContent = msg;

function showError(msg) {
  errorsEl.textContent = msg;
  setTimeout(() => { errorsEl.textContent = ''; }, 4000);
}

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
  boardState.forEach(tile => {
    const d = document.createElement('div');
    d.className = 'tile disabled';
    d.textContent = `${tile[0]}|${tile[1]}`;
    boardEl.appendChild(d);
  });
}

function renderHand() {
  handEl.innerHTML = '';
  myHand.forEach((tile, idx) => {
    const d = document.createElement('div');
    d.className = 'tile' + (currentTurn === mySeat ? ' your-turn' : ' disabled');
    d.textContent = `${tile[0]}|${tile[1]}`;
    if (currentTurn === mySeat) d.onclick = () => playTile(idx);
    handEl.appendChild(d);
  });
}

/* ---------- Moves ---------- */
function playTile(idx) {
  if (currentTurn !== mySeat) return;
  const tile = myHand[idx];
  let side = prompt('Side to play? (left/right) (blank=auto):');
  if (side !== 'left' && side !== 'right') side = null;
  socket.emit('playTile', { roomId, seat: mySeat, tile, side });
}

function passTurn() {
  if (currentTurn !== mySeat) return;
  socket.emit('passTurn', { roomId, seat: mySeat });
}
if (passBtn) passBtn.onclick = passTurn;

/* ---------- Socket events ---------- */
socket.on('roomAssigned', ({ room }) => {
  roomId = room;
  setStatus(`Joined room: ${roomId}. Waiting for others…`);
});

socket.on('roomJoined', ({ seat }) => {
  mySeat = seat;
  playerInfoEl.textContent =
    `You are Seat ${mySeat} (Team ${mySeat % 2 === 0 ? '0&2' : '1&3'})`;
});

socket.on('lobbyUpdate', ({ players, seatsRemaining }) => {
  renderLobby(players);
  setStatus(`Waiting for players (${seatsRemaining} seat${seatsRemaining!==1?'s':''} left)`);
});

socket.on('gameStart', ({ yourHand, startingSeat, scores: s }) => {
  myHand      = yourHand;
  boardState  = [];
  scores      = s;
  currentTurn = startingSeat;

  scoresEl.textContent = `Team 0&2: ${scores[0]} — Team 1&3: ${scores[1]}`;
  setStatus(currentTurn === mySeat ? 'Your turn!' : `Waiting for seat ${currentTurn}`);
  renderBoard();  
  renderHand();
  if (passBtn) passBtn.style.display = 'none';
});

/* --- live updates --- */
socket.on('broadcastMove', ({ board }) => {
  boardState = board;
  renderBoard();
});

socket.on('turnChanged', (turn) => {
  currentTurn = turn;
  errorsEl.textContent = '';
  setStatus(currentTurn === mySeat ? 'Your turn!' : `Waiting for seat ${currentTurn}`);
  renderHand();
  if (passBtn) passBtn.style.display = 'none';
});

socket.on('playerPassed', seat => {
  console.log(`Seat ${seat} passed.`);
  if (seat === mySeat && passBtn) passBtn.style.display = 'none';
});

socket.on('roundEnded', ({ winner, reason, points, scores: s, board, capicua, paso }) => {
  boardState = board;
  scores     = s;
  renderBoard();
  scoresEl.textContent = `Team 0&2: ${scores[0]} — Team 1&3: ${scores[1]}`;
  let msg = `Seat ${winner} wins (${reason}) — +${points} pts.`;
  if (capicua) msg += ' Capicú!';
  if (paso)    msg += ' Paso!';
  setStatus(msg);
  if (passBtn) passBtn.style.display = 'none';
});

socket.on('gameOver', ({ winningTeam, scores }) => {
  alert(`Game over! Team ${winningTeam} wins.\nScores: ${scores.join(' / ')}`);
  setStatus('Game over.');
});

socket.on('errorMessage', showError);
socket.on('message',     msg => console.log('Server:', msg));

/* --- NEW: Server tells you you must pass --- */
socket.on('allowPass', () => {
  if (passBtn && currentTurn === mySeat) {
    passBtn.style.display = 'inline-block';
    setStatus('No playable tiles — you must pass.');
  }
});
