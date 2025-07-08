/* =========================================================================
   client.js — (Drag & Drop Implementation)
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

// NEW: State for tracking the tile being dragged
let dragged = {
    element: null,      // The HTML element being dragged (a clone)
    originalTile: null, // The original element in the hand
    tileData: null,     // The tile data e.g., [6,5]
    isDragging: false,
    hoveredSide: null   // 'left' or 'right' if hovering a valid spot
};

// (All DOM handles are the same)
const statusEl = document.getElementById('status'); const boardEl = document.getElementById('board'); const handEl = document.getElementById('hand'); const lobbyListEl = document.getElementById('lobbyList'); const lobbyContainerEl = document.getElementById('lobbyContainer'); const playerInfoEl = document.getElementById('playerInfo'); const errorsEl = document.getElementById('errors'); const msgEl = document.getElementById('messages'); const pipEl = document.getElementById('pipCounts'); const topEl = document.getElementById('topPlayer'); const leftEl = document.getElementById('leftPlayer'); const rightEl = document.getElementById('rightPlayer'); const team0ScoreEl = document.getElementById('team0-score'); const team1ScoreEl = document.getElementById('team1-score');

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

// --- MODIFIED: renderBoard now identifies drop targets ---
function renderBoard() {
    boardEl.innerHTML = '';
    if (boardState.length === 0) {
        renderPlaceholder();
    } else {
        boardState.forEach(t => {
            const d = document.createElement('div');
            d.className = 'tile disabled';
            d.textContent = `${t[0]}|${t[1]}`;
            boardEl.appendChild(d);
        });

        // After rendering, mark the ends as drop targets
        if (boardEl.children.length > 0) {
            boardEl.firstChild.classList.add('drop-target');
            boardEl.firstChild.dataset.side = 'left';
            if (boardEl.children.length > 1) {
                boardEl.lastChild.classList.add('drop-target');
                boardEl.lastChild.dataset.side = 'right';
            }
        }
    }
}

function renderPlaceholder() {
    const placeholder = document.createElement('div');
    placeholder.className = 'tile-placeholder';
    const isFirstGameRound = scores[0] === 0 && scores[1] === 0;
    if (isFirstGameRound) {
        placeholder.textContent = '6|6';
        placeholder.classList.add('drop-target'); // Make the placeholder a drop target
        placeholder.dataset.side = 'right';     // Default side for the first move
    } else {
        placeholder.textContent = 'Play Tile';
    }
    boardEl.appendChild(placeholder);
}

// --- MODIFIED: renderHand now sets up dragging ---
function renderHand() {
    handEl.innerHTML = '';
    myHand.forEach((tileData) => {
        const d = document.createElement('div');
        d.className = 'tile' + (currentTurn === mySeat ? '' : ' disabled');
        d.textContent = `${tileData[0]}|${tileData[1]}`;
        if (currentTurn === mySeat) {
            d.addEventListener('mousedown', (e) => handleDragStart(e, tileData, d));
            d.addEventListener('touchstart', (e) => handleDragStart(e, tileData, d), { passive: false });
        }
        handEl.appendChild(d);
    });
}

// (seatPos, renderOpponents, renderScores, renderPips are the same)
function seatPos(seat) { if (seat === mySeat) return 'self'; const diff = (seat - mySeat + 4) % 4; if (diff === 1) return 'right'; if (diff === 2) return 'top'; return 'left'; }
function renderOpponents() { const playerAreas = { top: topEl, left: leftEl, right: rightEl }; Object.values(playerAreas).forEach(el => el.innerHTML = ''); Object.entries(seatMap).forEach(([s, info]) => { const seat = +s; if (seat === mySeat) return; const pos = seatPos(seat); const areaEl = playerAreas[pos]; if (areaEl) { const nameEl = document.createElement('div'); nameEl.textContent = `${info.name} (Seat ${seat})`; areaEl.appendChild(nameEl); const handDisplayEl = document.createElement('div'); handDisplayEl.className = 'player-area-hand-display'; const count = handSizes[seat] || 0; for (let i = 0; i < count; i++) { const dummy = document.createElement('div'); dummy.className = 'dummy-tile'; handDisplayEl.appendChild(dummy); } areaEl.appendChild(handDisplayEl); } }); }
function renderScores() { team0ScoreEl.textContent = scores[0]; team1ScoreEl.textContent = scores[1]; }
function renderPips(pipCounts) { pipEl.textContent = pipCounts ? Object.entries(pipCounts).map(([p, c]) => `${p}:${c}`).join(' | ') : ''; }


/* ─── NEW: Drag and Drop Logic ────────────────────────────────────────── */

function handleDragStart(e, tileData, tileElement) {
    if (e.type === 'touchstart') e.preventDefault();
    if (dragged.isDragging) return;

    dragged = { tileData, originalTile: tileElement, isDragging: true, hoveredSide: null };
    
    // Create a clone to drag
    dragged.element = tileElement.cloneNode(true);
    dragged.element.classList.add('dragging');
    document.body.appendChild(dragged.element);
    
    // Hide original tile
    tileElement.style.visibility = 'hidden';

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

    // Check for drop targets
    let onTarget = false;
    const dropTargets = document.querySelectorAll('.drop-target');
    dropTargets.forEach(target => {
        const rect = target.getBoundingClientRect();
        if (pos.x > rect.left && pos.x < rect.right && pos.y > rect.top && pos.y < rect.bottom) {
            onTarget = true;
            dragged.hoveredSide = target.dataset.side;
            target.classList.add('drop-hover');
        } else {
            target.classList.remove('drop-hover');
        }
    });

    if (!onTarget) {
        dragged.hoveredSide = null;
    }
}

function handleDragEnd(e) {
    if (!dragged.isDragging) return;

    if (dragged.hoveredSide) {
        socket.emit('playTile', {
            roomId,
            seat: mySeat,
            tile: dragged.tileData,
            side: dragged.hoveredSide,
        });
    } else {
        dragged.originalTile.style.visibility = 'visible';
    }

    // Cleanup
    if (dragged.element) document.body.removeChild(dragged.element);
    document.querySelectorAll('.drop-hover').forEach(el => el.classList.remove('drop-hover'));
    
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('touchend', handleDragEnd);
    
    dragged = { element: null, originalTile: null, tileData: null, isDragging: false, hoveredSide: null };
}

function moveDraggedElement(x, y) {
    if (!dragged.element) return;
    dragged.element.style.left = `${x - (dragged.element.offsetWidth / 2)}px`;
    dragged.element.style.top = `${y - (dragged.element.offsetHeight / 2)}px`;
}

function getEventPosition(e) {
    return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
}

/* ─── REMOVED: Old playTile function with prompt is no longer needed. ─── */

// ... (All socket.on event handlers remain the same) ...
socket.on('roomJoined', ({ roomId: id, seat }) => { roomId = id; mySeat = seat; sessionStorage.setItem('domino_roomId', roomId); sessionStorage.setItem('domino_mySeat', mySeat); playerInfoEl.textContent = `You are Seat ${seat} (Team ${seat % 2 === 0 ? '0&2' : '1&3'})`; });
socket.on('lobbyUpdate', ({ players }) => { lobbyContainerEl.style.display = 'block'; seatMap = Object.fromEntries(players.map(p => [p.seat, p])); renderLobby(players); });
socket.on('roundStart', ({ yourHand, startingSeat, scores: s }) => { lobbyContainerEl.style.display = 'none'; myHand = yourHand; boardState = []; scores = s; currentTurn = startingSeat; msgEl.innerHTML = ''; handSizes = { 0: 7, 1: 7, 2: 7, 3: 7 }; renderScores(); renderBoard(); renderHand(); renderOpponents(); setStatus(currentTurn === mySeat ? 'Your turn!' : `Waiting for seat ${currentTurn}`); });
socket.on('updateHand', hand => { myHand = hand; handSizes[mySeat] = hand.length; renderHand(); renderOpponents(); });
socket.on('broadcastMove', ({ seat, tile, board, pipCounts }) => { boardState = board; if (seat !== mySeat) { handSizes[seat]--; } renderBoard(); renderPips(pipCounts); renderOpponents(); addMsg(`Seat ${seat} played ${tile[0]}|${tile[1]}.`); });
socket.on('turnChanged', turn => { currentTurn = turn; setStatus(turn === mySeat ? 'Your turn!' : `Waiting for seat ${turn}`); renderHand(); [topEl, leftEl, rightEl, handEl].forEach(el => { el.classList.remove('active-turn-indicator'); }); const pos = seatPos(turn); if (pos === 'top') topEl.classList.add('active-turn-indicator'); else if (pos === 'left') leftEl.classList.add('active-turn-indicator'); else if (pos === 'right') rightEl.classList.add('active-turn-indicator'); else if (pos === 'self') handEl.classList.add('active-turn-indicator'); });
socket.on('playerPassed', ({ seat }) => { addMsg(`Seat ${seat} passed.`); });
socket.on('roundEnded', ({ winner, reason, points, scores: s, board }) => { boardState = board; scores = s; renderScores(); renderBoard(); let msg = `Seat ${winner} wins (${reason}) +${points} pts.`; setStatus(msg); addMsg(msg); });
socket.on('gameOver', ({ winningTeam, scores: s }) => { sessionStorage.removeItem('domino_roomId'); sessionStorage.removeItem('domino_mySeat'); alert(`Game over! Team ${winningTeam} wins.\nScores: ${s.join(' / ')}`); setStatus('Game over.'); });
socket.on('reconnectSuccess', ({ roomState }) => { console.log('Successfully reconnected!'); });
socket.on('errorMessage', showError);
socket.on('bonusAwarded', ({ seat, type, points, scores: s }) => { scores = s; renderScores(); addMsg(`Team ${seat % 2} gets +${points} pts for ${type}!`); });