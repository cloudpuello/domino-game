/* =========================================================================
   client.js — (Drag & Drop Update)
   ========================================================================= */

// ── Socket + basic state ────────────────────────────────────────────────
const socket = io();
const playerName = prompt('Enter your name:') || 'Anonymous';

let roomId = null;
let mySeat = null;
let currentTurn = null;
let myHand = [];
let boardState = [];
let scores = [0, 0];
let seatMap = {};
let handSizes = {};

// --- NEW: State for tracking the tile being dragged ---
let dragged = {
    element: null,      // The HTML element being dragged (the clone)
    originalTile: null, // The original element in the hand
    tileData: null,     // The tile data e.g., [6,5]
    isDragging: false,
    hoveredSide: null   // Will be 'left' or 'right' if hovering a valid spot
};

// ── DOM handles ─────────────────────────────────────────────────────────
const statusEl = document.getElementById('status');
const boardEl = document.getElementById('board');
const handEl = document.getElementById('hand');
const lobbyListEl = document.getElementById('lobbyList');
const lobbyContainerEl = document.getElementById('lobbyContainer');
const playerInfoEl = document.getElementById('playerInfo');
const errorsEl = document.getElementById('errors');
const msgEl = document.getElementById('messages');
const pipEl = document.getElementById('pipCounts');
const topEl = document.getElementById('topPlayer');
const leftEl = document.getElementById('leftPlayer');
const rightEl = document.getElementById('rightPlayer');
const team0ScoreEl = document.getElementById('team0-score');
const team1ScoreEl = document.getElementById('team1-score');
const passButton = document.getElementById('pass-button');


// Check if we are reconnecting to a game stored in the session
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

// --- MODIFIED: `renderBoard` now identifies drop targets ---
function renderBoard() {
    boardEl.innerHTML = '';
    boardState.forEach(t => {
        const d = document.createElement('div');
        d.className = 'tile disabled';
        d.textContent = `${t[0]}|${t[1]}`;
        boardEl.appendChild(d);
    });

    // After rendering, mark the ends of the board as drop targets
    if (boardEl.children.length > 0) {
        boardEl.firstChild.classList.add('drop-target');
        boardEl.firstChild.dataset.side = 'left';

        // Only add to last child if there is more than one tile
        if (boardEl.children.length > 1) {
            boardEl.lastChild.classList.add('drop-target');
            boardEl.lastChild.dataset.side = 'right';
        }
    }
}

// --- MODIFIED: `renderHand` now sets up dragging instead of clicking ---
function renderHand() {
    handEl.innerHTML = '';
    myHand.forEach(tileData => {
        const d = document.createElement('div');
        const canPlay = currentTurn === mySeat;
        d.className = 'tile' + (canPlay ? '' : ' disabled');
        d.textContent = `${tileData[0]}|${tileData[1]}`;

        if (canPlay) {
            // Use `mousedown` to start the drag process
            d.onmousedown = (event) => handleTileMouseDown(event, tileData, d);
        }
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


/* ─── NEW: Drag and Drop Handlers ──────────────────────────────────────── */

function handleTileMouseDown(event, tileData, tileElement) {
    if (event.button !== 0) return; // Only react to left-clicks

    event.preventDefault();

    dragged.isDragging = true;
    dragged.tileData = tileData;
    dragged.originalTile = tileElement;

    // Create a clone of the tile to drag around
    dragged.element = tileElement.cloneNode(true);
    dragged.element.classList.add('dragging');
    document.body.appendChild(dragged.element);

    // Hide the original tile in the hand
    tileElement.style.visibility = 'hidden';

    // Position the dragged element at the mouse cursor
    moveDraggedElement(event.clientX, event.clientY);

    // Add listeners to the whole document to track mouse movement
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
}

function handleDocumentMouseMove(event) {
    if (!dragged.isDragging) return;

    // Move the tile clone with the cursor
    moveDraggedElement(event.clientX, event.clientY);

    // Check if we are hovering over a valid drop zone
    const dropTargets = document.querySelectorAll('.drop-target');
    let onTarget = false;

    dropTargets.forEach(target => {
        const rect = target.getBoundingClientRect();
        if (event.clientX > rect.left && event.clientX < rect.right &&
            event.clientY > rect.top && event.clientY < rect.bottom) {
            target.classList.add('drop-hover');
            dragged.hoveredSide = target.dataset.side;
            onTarget = true;
        } else {
            target.classList.remove('drop-hover');
        }
    });

    if (!onTarget) {
        dragged.hoveredSide = null;
    }
}

function handleDocumentMouseUp(event) {
    if (!dragged.isDragging) return;

    // If we dropped on a valid, hovered side, play the tile
    if (dragged.hoveredSide) {
        socket.emit('playTile', {
            roomId,
            seat: mySeat,
            tile: dragged.tileData,
            side: dragged.hoveredSide
        });
    } else {
        // If the drop was invalid, make the original tile visible again
        dragged.originalTile.style.visibility = 'visible';
    }

    // Cleanup: remove the dragged clone and all event listeners
    document.body.removeChild(dragged.element);
    document.querySelectorAll('.drop-target').forEach(t => t.classList.remove('drop-hover'));
    document.removeEventListener('mousemove', handleDocumentMouseMove);
    document.removeEventListener('mouseup', handleDocumentMouseUp);

    // Reset the dragged state object
    dragged = { element: null, originalTile: null, tileData: null, isDragging: false, hoveredSide: null };
}

function moveDraggedElement(x, y) {
    if (!dragged.element) return;
    // Center the tile on the cursor
    dragged.element.style.left = `${x - (dragged.element.offsetWidth / 2)}px`;
    dragged.element.style.top = `${y - (dragged.element.offsetHeight / 2)}px`;
}


/* ─── REMOVED: Old playTile and Pass Button Logic ──────────────────────── */
// The old `playTile` function with the prompt is no longer needed.
// The pass button listener is still good.
passButton.addEventListener('click', () => {
    socket.emit('passTurn', { roomId, seat: mySeat });
    passButton.style.display = 'none';
});


/* ── Socket events ────────────────────────────────────────────────────── */
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
    renderBoard();
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
    setStatus(turn === mySeat ? "It's your turn!" : `Waiting for seat ${turn}`);

    passButton.style.display = 'none';
    renderHand(); // Re-render to enable/disable dragging

    [topEl, leftEl, rightEl, handEl].forEach(el => {
        el.classList.remove('active-turn-indicator');
    });

    const pos = seatPos(turn);
    if (pos === 'top') topEl.classList.add('active-turn-indicator');
    else if (pos === 'left') leftEl.classList.add('active-turn-indicator');
    else if (pos === 'right') rightEl.classList.add('active-turn-indicator');
    else if (pos === 'self') handEl.classList.add('active-turn-indicator');
});

socket.on('mustPass', () => {
    if (currentTurn === mySeat) {
        passButton.style.display = 'block';
    }
});

socket.on('playerPassed', ({ seat }) => {
    addMsg(`Seat ${seat} passed.`);
});

socket.on('roundEnded', ({ winner, reason, points, scores: s }) => {
    scores = s;
    renderScores();
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
    // You would add logic here to restore the full game state
    // For now, it just logs a message.
});

socket.on('errorMessage', showError);

socket.on('bonusAwarded', ({ seat, type, points, scores: s }) => {
    scores = s;
    renderScores();
    addMsg(`Team ${seat % 2} gets +${points} pts for ${type}!`);
});