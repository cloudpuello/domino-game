/* public/client.js */

// Create the socket connection
const socket = io();

// Prompt for room and player name
const roomName = prompt('Room name?') || 'room1';
const playerName = prompt('Your player name?') || 'Anonymous';

// State variables
let mySeat;
let currentTurn;
let myHand = [];
let boardState = [];

// DOM elements
const statusEl = document.getElementById('status');
const boardEl = document.getElementById('board');
const handEl = document.getElementById('hand');
const lobbyListEl = document.getElementById('lobbyList');

// Join the room
socket.emit('joinRoom', { roomId: roomName, playerName });

/**
 * Update the status message
 */
function setStatus(msg) {
  statusEl.textContent = msg;
}

/**
 * Render the board tiles in order
 */
function renderBoard() {
  boardEl.innerHTML = '';
  boardState.forEach(tile => {
    const div = document.createElement('div');
    div.className = 'tile disabled';
    div.textContent = `${tile[0]}|${tile[1]}`;
    boardEl.appendChild(div);
  });
}

/**
 * Render your hand with clickable tiles
 */
function renderHand() {
  handEl.innerHTML = '';
  myHand.forEach((tile, index) => {
    const div = document.createElement('div');
    div.className = 'tile';
    div.textContent = `${tile[0]}|${tile[1]}`;

    if (currentTurn === mySeat) {
      // Enable click to play
      div.onclick = () => playTile(index);
    } else {
      div.classList.add('disabled');
    }
    handEl.appendChild(div);
  });
}

/**
 * Send a playTile event
 */
function playTile(index) {
  const tile = myHand[index];
  socket.emit('playTile', { roomId: roomName, seat: mySeat, tile });
}

/**
 * Send a passTurn event
 */
function passTurn() {
  if (currentTurn !== mySeat) return;
  socket.emit('passTurn', { roomId: roomName, seat: mySeat });
}

/* Socket Event Handlers */

// Seat assignment when joining
socket.on('roomJoined', ({ seat }) => {
  mySeat = seat;
});

/**
 * Update lobby when players join
 */
socket.on('lobbyUpdate', ({ players, seatsRemaining }) => {
  lobbyListEl.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `Seat ${p.seat}: ${p.name}`;
    lobbyListEl.appendChild(li);
  });
  setStatus(`Waiting for players (${seatsRemaining} seats left)`);
});

/**
 * When the game starts, receive your hand and starting seat
 */
socket.on('gameStart', ({ yourHand, startingSeat }) => {
  myHand = yourHand;
  boardState = [];
  currentTurn = startingSeat;

  setStatus(
    currentTurn === mySeat
      ? 'Your turn! You must play [6|6].'
      : `Waiting for seat ${currentTurn} to start the game.`
  );
  renderBoard();
  renderHand();
});

/**
 * Board updates after any move
 */
socket.on('broadcastMove', ({ seat, tile, board }) => {
  boardState = board;
  renderBoard();
});

/**
 * Update whose turn it is
 */
socket.on('turnChanged', turn => {
  currentTurn = turn;
  setStatus(
    currentTurn === mySeat
      ? 'Your turn!'
      : `Waiting for seat ${currentTurn}'s turn`
  );
  renderHand();
});

/**
 * Log passes to the console
 */
socket.on('playerPassed', seat => {
  console.log(`Seat ${seat} passed.`);
});

/**
 * Handle round end
 */
socket.on('roundEnded', ({ winner, reason, board }) => {
  boardState = board;
  renderBoard();

  if (winner !== null) {
    setStatus(`Player in seat ${winner} wins the round!`);
  } else {
    setStatus('Round ended in Tranca (blocked).');
  }
});

/**
 * Show any errors
 */
socket.on('errorMessage', msg => {
  alert(msg);
});

