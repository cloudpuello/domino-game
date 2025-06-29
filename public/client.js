/* =========================================================================
   client.js — Dominican Domino with Auto-Room Join
   ========================================================================= */

// Create socket connection
const socket = io();

// Prompt for player name only
const playerName = prompt('Enter your name:') || 'Anonymous';

// State
let roomId = null;
let mySeat = null;
let currentTurn = null;
let myHand = [];
let boardState = [];
let scores = [0, 0]; // [team0&2, team1&3]

// DOM elements
const statusEl = document.getElementById('status');
const boardEl = document.getElementById('board');
const handEl = document.getElementById('hand');
const lobbyListEl = document.getElementById('lobbyList');
const scoresEl = document.getElementById('scores');

// Ask server to assign a room
socket.emit('findRoom', { playerName });

/* Helpers */

// Update status text
function setStatus(msg) {
  statusEl.textContent = msg;
}

// Render lobby player list
function renderLobby(players) {
  lobbyListEl.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `Seat ${p.seat}: ${p.name}`;
    lobbyListEl.appendChild(li);
  });
}

// Render the board horizontally
function renderBoard() {
  boardEl.innerHTML = '';
  boardState.forEach(tile => {
    const div = document.createElement('div');
    div.className = 'tile disabled';
    div.textContent = `${tile[0]}|${tile[1]}`;
    boardEl.appendChild(div);
  });
}

// Render your hand
function renderHand() {
  handEl.innerHTML = '';
  myHand.forEach((tile, index) => {
    const div = document.createElement('div');
    div.className = 'tile' + (currentTurn === mySeat ? '' : ' disabled');
    div.textContent = `${tile[0]}|${tile[1]}`;
    if (currentTurn === mySeat) {
      div.onclick = () => playTile(index);
    }
    handEl.appendChild(div);
  });
}

// Play a tile
function playTile(index) {
  const tile = myHand[index];
  let side = prompt('Side to play? (left/right) — leave blank for auto:');
  if (side !== 'left' && side !== 'right') side = null;
  socket.emit('playTile', { roomId, seat: mySeat, tile, side });
}

// Pass turn
function passTurn() {
  if (currentTurn !== mySeat) return;
  socket.emit('passTurn', { roomId, seat: mySeat });
}

/* Socket events */

// Server assigns you a room
socket.on('roomAssigned', ({ room }) => {
  roomId = room;
  console.log(`Joined room: ${roomId}`);
  setStatus(`Joined room: ${roomId}. Waiting for others...`);
});

// After joining, receive your seat
socket.on('roomJoined', ({ seat }) => {
  mySeat = seat;
});

// Lobby updates
socket.on('lobbyUpdate', ({ players, seatsRemaining }) => {
  renderLobby(players);
  setStatus(`Waiting for players (${seatsRemaining} seat${seatsRemaining !== 1 ? 's' : ''} left)`);
});

// Game starts
socket.on('gameStart', ({ yourHand, startingSeat, scores: s }) => {
  myHand = yourHand;
  boardState = [];
  scores = s;
  currentTurn = startingSeat;
  scoresEl.textContent = `Team 0&2: ${scores[0]} — Team 1&3: ${scores[1]}`;
  setStatus(currentTurn === mySeat ? 'Your turn!' : `Waiting for seat ${currentTurn}`);
  renderBoard();
  renderHand();
});

// A move was played
socket.on('broadcastMove', ({ seat, tile, side, board }) => {
  boardState = board;
  renderBoard();
});

// Turn changed
socket.on('turnChanged', turn => {
  currentTurn = turn;
  setStatus(currentTurn === mySeat ? 'Your turn!' : `Waiting for seat ${currentTurn}`);
  renderHand();
});

// A player passed
socket.on('playerPassed', seat => {
  console.log(`Seat ${seat} passed.`);
});

// Round ended
socket.on('roundEnded', ({ winner, reason, points, scores: s, board }) => {
  boardState = board;
  scores = s;
  scoresEl.textContent = `Team 0&2: ${scores[0]} — Team 1&3: ${scores[1]}`;
  renderBoard();
  if (winner !== null) {
    setStatus(`Seat ${winner} wins (${reason}) — +${points} points.`);
  } else {
    setStatus(`Round ended (${reason}).`);
  }
});

// Game over
socket.on('gameOver', ({ winningTeam, scores }) => {
  alert(`Game over! Team ${winningTeam} wins.\nScores: ${scores.join(' / ')}`);
  setStatus('Game over.');
});

// Error messages
socket.on('errorMessage', msg => {
  alert(msg);
});

// General server messages
socket.on('message', msg => {
  console.log('Server:', msg);
});
