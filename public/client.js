/* =========================================================================
   client.js — (Patched: Opening Drop Target & Dual‑Side Play)
   ========================================================================= */

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

let dragged = {
    element: null, originalTile: null, tileData: null,
    isDragging: false, hoveredSide: null
};

// DOM handles
const statusEl      = document.getElementById('status');
const boardEl       = document.getElementById('board');
const handEl        = document.getElementById('hand');
const lobbyListEl   = document.getElementById('lobbyList');
const lobbyContainerEl = document.getElementById('lobbyContainer');
const playerInfoEl  = document.getElementById('playerInfo');
const errorsEl      = document.getElementById('errors');
const msgEl         = document.getElementById('messages');
const pipEl         = document.getElementById('pipCounts');
const topEl         = document.getElementById('topPlayer');
const leftEl        = document.getElementById('leftPlayer');
const rightEl       = document.getElementById('rightPlayer');
const team0ScoreEl  = document.getElementById('team0-score');
const team1ScoreEl  = document.getElementById('team1-score');

// Reconnect logic
const reconnectData = {
    roomId: sessionStorage.getItem('domino_roomId'),
    reconnectSeat: sessionStorage.getItem('domino_mySeat')
};
socket.emit('findRoom', { playerName, ...reconnectData });

/* ── Helpers ──────────────────────────────────────────────────────────── */
const setStatus = txt => (statusEl.textContent = txt);
const showError = txt => { errorsEl.textContent = txt; setTimeout(() => (errorsEl.textContent = ''), 4000); };
const addMsg = txt => { const p = document.createElement('div'); p.textContent = txt; msgEl.prepend(p); };
function renderLobby(players) { lobbyListEl.innerHTML = ''; players.forEach(p => { const li = document.createElement('li'); li.textContent = `Seat ${p.seat}: ${p.name}`; lobbyListEl.appendChild(li); }); }

function renderBoard() {
    boardEl.innerHTML = '';
    boardEl.classList.toggle('board-center', boardState.length <= 1); // keep first tile centred

    if (boardState.length === 0) {
        renderPlaceholder();
    } else {
        boardState.forEach(t => {
            const d = document.createElement('div');
            d.className = 'tile disabled';
            if (t[0] === t[1]) d.classList.add('double');
            d.innerHTML = `<span>${t[0]}</span><span>${t[1]}</span>`;
            boardEl.appendChild(d);
        });
    }
}

function renderPlaceholder() {
    const placeholder = document.createElement('div');
    placeholder.className = 'tile-placeholder';

    const isFirstGameRound = scores[0] === 0 && scores[1] === 0;
    placeholder.textContent = isFirstGameRound ? '6|6' : 'PLAY';

    // PATCH: make it an active drop zone for the opening move
    placeholder.classList.add('drop-target');
    placeholder.dataset.side = 'left'; // any truthy side; server ignores side on first move

    boardEl.appendChild(placeholder);
}

// --- UPDATED: highlights & playable check ---
function renderHand() {
    handEl.innerHTML = '';
    const boardEnds = getBoardEnds();

    myHand.forEach(tileData => {
        const d = document.createElement('div');
        d.className = 'tile';
        d.innerHTML = `<span>${tileData[0]}</span><span>${tileData[1]}</span>`;

        const isPlayable = isTilePlayable(tileData, boardEnds);

        if (currentTurn === mySeat) {
            if (isPlayable) {
                d.classList.add('playable');
                d.addEventListener('mousedown', e => handleDragStart(e, tileData, d));
                d.addEventListener('touchstart', e => handleDragStart(e, tileData, d), { passive: false });
                d.addEventListener('dragstart', e => e.preventDefault());
            } else {
                d.classList.add('disabled');
            }
        } else {
            d.classList.add('disabled');
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
        if (!areaEl) return;

        const nameEl = document.createElement('div');
        nameEl.textContent = `${info.name} (Seat ${seat})`;
        areaEl.appendChild(nameEl);

        const handDisplay = document.createElement('div');
        handDisplay.className = 'player-area-hand-display';
        const count = handSizes[seat] || 0;
        for (let i = 0; i < count; i++) {
            const dummy = document.createElement('div');
            dummy.className = 'dummy-tile';
            handDisplay.appendChild(dummy);
        }
        areaEl.appendChild(handDisplay);
    });
}

function renderScores() {
    team0ScoreEl.textContent = scores[0];
    team1ScoreEl.textContent = scores[1];
}

function renderPips(pipCounts) {
    pipEl.textContent = pipCounts ? Object.entries(pipCounts).map(([p, c]) => `${p}:${c}`).join(' | ') : '';
}

/* ─── Drag and Drop Logic ────────────────────── */
function handleDragStart(e, tileData, tileElement) {
    if (e.type === 'touchstart') e.preventDefault();
    if (dragged.isDragging) return;

    dragged = { tileData, originalTile: tileElement, isDragging: true, hoveredSide: null };
    dragged.element = tileElement.cloneNode(true);
    dragged.element.classList.add('dragging');
    document.body.appendChild(dragged.element);
    tileElement.classList.add('ghost');

    highlightPlayableEnds(tileData);
    const pos = getEventPosition(e);
    moveDraggedElement(pos.x, pos.y);

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
}

function handleDragMove(e) {
    if (!dragged.isDragging) return;
    e.preventDefault();
    const pos = getEventPosition(e);
    moveDraggedElement(pos.x, pos.y);

    let onTarget = false;
    document.querySelectorAll('.drop-target').forEach(target => {
        const rect = target.getBoundingClientRect();
        if (pos.x > rect.left && pos.x < rect.right && pos.y > rect.top && pos.y < rect.bottom) {
            onTarget = true;
            dragged.hoveredSide = target.dataset.side;
            target.classList.add('drop-hover');
        } else {
            target.classList.remove('drop-hover');
        }
    });
    if (!onTarget) dragged.hoveredSide = null;
}

function handleDragEnd() {
    if (!dragged.isDragging) return;
    const { originalTile, tileData, hoveredSide } = dragged;

    // PATCH: if board empty, treat side as 'left' by default
    const sideToSend = hoveredSide || (boardState.length === 0 ? 'left' : null);

    if (sideToSend) {
        socket.emit('playTile', { roomId, seat: mySeat, tile: tileData, side: sideToSend });
    } else {
        originalTile.classList.remove('ghost');
    }
    cleanupDrag();
}

function cleanupDrag() {
    if (dragged.element) dragged.element.remove();

    document.querySelectorAll('.drop-target').forEach(el => {
        el.classList.remove('drop-target', 'drop-hover');
        el.removeAttribute('data-side');
    });

    if (dragged.originalTile) dragged.originalTile.classList.remove('ghost');

    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('touchend', handleDragEnd);

    dragged = { element: null, originalTile: null, tileData: null, isDragging: false, hoveredSide: null };
}

function highlightPlayableEnds(tileData) {
    const boardEnds = getBoardEnds();
    const [p1, p2] = tileData;

    // If board is empty, the placeholder is already a drop‑target.
    if (!boardEnds) return;

    if (p1 === boardEnds.leftPip || p2 === boardEnds.leftPip) {
        boardEnds.leftTile.classList.add('drop-target');
        boardEnds.leftTile.dataset.side = 'left';
    }
    if (boardEnds.rightTile !== boardEnds.leftTile) {
        if (p1 === boardEnds.rightPip || p2 === boardEnds.rightPip) {
            boardEnds.rightTile.classList.add('drop-target');
            boardEnds.rightTile.dataset.side = 'right';
        }
    }
}

function isTilePlayable(tileData, boardEnds) {
    const [p1, p2] = tileData;
    const isFirstGameRound = scores[0] === 0 && scores[1] === 0;

    if (isFirstGameRound && boardState.length === 0) {
        return p1 === 6 && p2 === 6;
    }
    if (!boardEnds) return true; // Shouldn’t occur, but safe

    return (
        p1 === boardEnds.leftPip || p2 === boardEnds.leftPip ||
        p1 === boardEnds.rightPip || p2 === boardEnds.rightPip
    );
}

function moveDraggedElement(x, y) {
    if (!dragged.element) return;
    dragged.element.style.left = `${x}px`;
    dragged.element.style.top  = `${y}px`;
}
function getEventPosition(e) {
    return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
}
function getBoardEnds() {
    if (boardState.length === 0) return null;
    return {
        leftTile: boardEl.firstChild,
        leftPip : boardState[0][0],
        rightTile: boardEl.lastChild,
        rightPip : boardState[boardState.length - 1][1]
    };
}

/* ─── Socket.IO Event Handlers ────────────────────── */
socket.on('roomJoined', ({ roomId: id, seat }) => {
    roomId = id;
    mySeat = seat;
    sessionStorage.setItem('domino_roomId', roomId);
    sessionStorage.setItem('domino_mySeat', mySeat);
    playerInfoEl.textContent = `You are Seat ${seat} (Team ${seat % 2 === 0 ? '0 & 2' : '1 & 3'})`;
});

socket.on('lobbyUpdate', ({ players }) => {
    lobbyContainerEl.style.display = 'block';
    seatMap = Object.fromEntries(players.map(p => [p.seat, p]));
    renderLobby(players);
});

socket.on('roundStart', ({ yourHand, startingSeat, scores: s }) => {
    lobbyContainerEl.style.display = 'none';
    myHand      = yourHand;
    boardState  = [];
    scores      = s;
    currentTurn = startingSeat;
    msgEl.innerHTML = '';
    handSizes   = { 0: 7, 1: 7, 2: 7, 3: 7 };

    cleanupDrag();
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
    if (seat !== mySeat) handSizes[seat]--;
    cleanupDrag();
    renderBoard();
    renderPips(pipCounts);
    renderOpponents();
    addMsg(`${seat} played ${tile[0]}|${tile[1]}.`);
});

socket.on('turnChanged', turn => {
    currentTurn = turn;
    setStatus(turn === mySeat ? 'Your turn!' : `Waiting for seat ${turn}`);
    cleanupDrag();
    renderHand();

    [topEl, leftEl, rightEl, handEl].forEach(el => el.classList.remove('active-turn-indicator'));
    const pos = seatPos(turn);
    if      (pos === 'top')   topEl.classList.add('active-turn-indicator');
    else if (pos === 'left')  leftEl.classList.add('active-turn-indicator');
    else if (pos === 'right') rightEl.classList.add('active-turn-indicator');
    else if (pos === 'self')  handEl.classList.add('active-turn-indicator');
});

socket.on('playerPassed', ({ seat }) => addMsg(`Seat ${seat} passed.`));

socket.on('roundEnded', ({ winner, reason, points, scores: s, board }) => {
    boardState = board;
    scores     = s;
    cleanupDrag();
    renderScores();
    renderBoard();
    const msg = `Seat ${winner} wins (${reason}) +${points} pts.`;
    setStatus(msg);
    addMsg(msg);
});

socket.on('gameOver', ({ winningTeam, scores: s }) => {
    sessionStorage.removeItem('domino_roomId');
    sessionStorage.removeItem('domino_mySeat');
    alert(`Game over! Team ${winningTeam} wins.\nScores: ${s.join(' / ')}`);
    setStatus('Game over.');
});

socket.on('reconnectSuccess', () => {
    console.log('Successfully reconnected!');
});

socket.on('errorMessage', showError);

socket.on('bonusAwarded', ({ seat, type, points, scores: s }) => {
    scores = s;
    renderScores();
    addMsg(`Team ${seat % 2} gets +${points} pts for ${type}!`);
});
