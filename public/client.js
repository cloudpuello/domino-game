/* =========================================================================
   client.js — (Hover Fix & Start-of-Round Placeholder)
   ========================================================================= */

// ── Socket + basic state ────────────────────────────────────────────────
const socket = io();
const playerName = prompt('Enter your name:') || 'Anonymous';

let roomId        = null;
let mySeat        = null;
let currentTurn   = null;
let myHand        = [];
let boardState    = [];
let scores        = [0, 0];
let seatMap       = {};
let handSizes     = {};

// ── DOM handles ─────────────────────────────────────────────────────────
const statusEl         = document.getElementById('status');
const boardEl          = document.getElementById('board');
const handEl           = document.getElementById('hand');
const lobbyListEl      = document.getElementById('lobbyList');
const lobbyContainerEl = document.getElementById('lobbyContainer');
const playerInfoEl     = document.getElementById('playerInfo');
const errorsEl         = document.getElementById('errors');
const msgEl            = document.getElementById('messages');
const pipEl            = document.getElementById('pipCounts');
const topEl            = document.getElementById('topPlayer');
const leftEl           = document.getElementById('leftPlayer');
const rightEl          = document.getElementById('rightPlayer');
const team0ScoreEl     = document.getElementById('team0-score');
const team1ScoreEl     = document.getElementById('team1-score');

const reconnectData = {
    roomId: sessionStorage.getItem('domino_roomId'),
    reconnectSeat: sessionStorage.getItem('domino_mySeat')
};
socket.emit('findRoom', { playerName, ...reconnectData });


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
  // If the board is empty, render the placeholder first
  if (boardState.length === 0) {
      renderPlaceholder();
  } else {
      boardState.forEach(t => {
          const d = document.createElement('div');
          d.className = 'tile disabled';
          d.textContent = `${t[0]}|${t[1]}`;
          boardEl.appendChild(d);
      });
  }
}

// --- NEW: Function to render the placeholder for the first move ---
function renderPlaceholder() {
    const placeholder = document.createElement('div');
    placeholder.className = 'tile-placeholder';

    // Check if it's the very first round of the game by looking at the scores
    const isFirstGameRound = scores[0] === 0 && scores[1] === 0;

    if (isFirstGameRound) {
        placeholder.textContent = '6|6';
    } else {
        placeholder.textContent = 'Play Tile';
    }
    boardEl.appendChild(placeholder);
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
    const playerAreas = { top: topEl, left: leftEl, right: rightEl };
    Object.values(playerAreas).forEach(el => el.innerHTML = '');

    Object.entries(seatMap).forEach(([s, info]) => {
        const seat = +s;
        if (seat === mySeat) return;
        const pos = seatPos(seat);
        const areaEl = playerAreas[pos];
        if (areaEl) {
            const nameEl = document.createElement('div');
            nameEl.textContent = `${info.name} (Seat ${seat})`;
            areaEl.appendChild(nameEl);
            const handDisplayEl = document.createElement('div');
            handDisplayEl.className = 'player-area-hand-display';
            const count = handSizes[seat] || 0;
            for (let i = 0; i < count; i++) {
                const dummy = document.createElement('div');
                dummy.className = 'dummy-tile';
                handDisplayEl.appendChild(dummy);
            }
            areaEl.appendChild(handDisplayEl);
        }
    });
}

function renderScores() {
    team0ScoreEl.textContent = scores[0];
    team1ScoreEl.textContent = scores[1];
}

function renderPips(pipCounts) {
  pipEl.textContent = pipCounts
    ? Object.entries(pipCounts).map(([p, c]) => `${p}:${c}`).join(' | ')
    : '';
}

function playTile(idx) {
    if (currentTurn !== mySeat) return;
    const tile = myHand[idx];
    const userInput = prompt('Side? left / right (blank = auto)');
    if (userInput === null) return;
    const cleanInput = userInput.trim().toLowerCase();
    let side = (cleanInput === 'left' || cleanInput === 'right') ? cleanInput : null;
    socket.emit('playTile', { roomId, seat: mySeat, tile, side });
}

socket.on('roomJoined', ({ roomId: id, seat }) => {
    roomId = id;
    mySeat = seat;
    sessionStorage.setItem('domino_roomId', roomId);
    sessionStorage.setItem('domino_mySeat', mySeat);
    playerInfoEl.textContent = `You are Seat ${seat} (Team ${seat % 2 === 0 ? '0&2' : '1&3'})`;
});

socket.on('lobbyUpdate', ({ players }) => {
  lobbyContainerEl.style.display = 'block';
  seatMap = Object.fromEntries(players.map(p => [p.seat, p]));
  renderLobby(players);
});

socket.on('roundStart', ({ yourHand, startingSeat, scores: s }) => {
  lobbyContainerEl.style.display = 'none';
  myHand = yourHand;
  boardState = [];
  scores = s;
  currentTurn = startingSeat;
  msgEl.innerHTML = '';
  handSizes = { 0: 7, 1: 7, 2: 7, 3: 7 };
  renderScores();
  renderBoard(); // This will now render the placeholder
  renderHand();
  renderOpponents();
  setStatus(currentTurn === mySeat ? 'Your turn!' : `Waiting for seat ${currentTurn}`);
});

socket.on('updateHand', hand => {
  myHand = hand;
  handSizes[mySeat] = hand.length;
  renderHand();
  renderOpponents();
});

socket.on('broadcastMove', ({ seat, tile, board, pipCounts }) => {
  boardState = board;
  if (seat !== mySeat) {
      handSizes[seat]--;
  }
  renderBoard();
  renderPips(pipCounts);
  renderOpponents();
  addMsg(`Seat ${seat} played ${tile[0]}|${tile[1]}.`);
});

socket.on('turnChanged', turn => {
    currentTurn = turn;
    setStatus(turn === mySeat ? 'Your turn!' : `Waiting for seat ${turn}`);
    renderHand();
    [topEl, leftEl, rightEl, handEl].forEach(el => {
        el.classList.remove('active-turn-indicator');
    });
    const pos = seatPos(turn);
    if (pos === 'top') topEl.classList.add('active-turn-indicator');
    else if (pos === 'left') leftEl.classList.add('active-turn-indicator');
    else if (pos === 'right') rightEl.classList.add('active-turn-indicator');
    else if (pos === 'self') handEl.classList.add('active-turn-indicator');
});

socket.on('playerPassed', ({ seat }) => {
  addMsg(`Seat ${seat} passed.`);
});

socket.on('roundEnded', ({ winner, reason, points, scores: s, board }) => {
  boardState = board;
  scores = s;
  renderScores();
  renderBoard();
  let msg = `Seat ${winner} wins (${reason}) +${points} pts.`;
  setStatus(msg);
  addMsg(msg);
});

socket.on('gameOver', ({ winningTeam, scores: s }) => {
  sessionStorage.removeItem('domino_roomId');
  sessionStorage.removeItem('domino_mySeat');
  alert(`Game over! Team ${winningTeam} wins.\nScores: ${s.join(' / ')}`);
  setStatus('Game over.');
});

socket.on('reconnectSuccess', ({ roomState }) => {
    console.log('Successfully reconnected!');
});

socket.on('errorMessage', showError);

socket.on('bonusAwarded', ({ seat, type, points, scores: s }) => {
    scores = s;
    renderScores();
    addMsg(`Team ${seat % 2} gets +${points} pts for ${type}!`);
});