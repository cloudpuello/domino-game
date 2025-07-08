/* =========================================================================
   client.js — (Improved Drag & Drop State Management)
   ========================================================================= */

// ... (keep all code from the top down to the 'Helpers' section) ...
const socket = io(); const playerName = prompt('Enter your name:') || 'Anonymous'; let roomId = null; let mySeat = null; let currentTurn = null; let myHand = []; let boardState = []; let scores = [0, 0]; let seatMap = {}; let handSizes = {};
let dragged = { element: null, originalTile: null, tileData: null, isDragging: false, hoveredSide: null };
const statusEl = document.getElementById('status'); const boardEl = document.getElementById('board'); const handEl = document.getElementById('hand'); const lobbyListEl = document.getElementById('lobbyList'); const lobbyContainerEl = document.getElementById('lobbyContainer'); const playerInfoEl = document.getElementById('playerInfo'); const errorsEl = document.getElementById('errors'); const msgEl = document.getElementById('messages'); const pipEl = document.getElementById('pipCounts'); const topEl = document.getElementById('topPlayer'); const leftEl = document.getElementById('leftPlayer'); const rightEl = document.getElementById('rightPlayer'); const team0ScoreEl = document.getElementById('team0-score'); const team1ScoreEl = document.getElementById('team1-score');
const reconnectData = { roomId: sessionStorage.getItem('domino_roomId'), reconnectSeat: sessionStorage.getItem('domino_mySeat') };
socket.emit('findRoom', { playerName, ...reconnectData });

const setStatus = txt => (statusEl.textContent = txt);
const showError = txt => { errorsEl.textContent = txt; setTimeout(() => (errorsEl.textContent = ''), 4000); };
const addMsg = txt => { const p = document.createElement('div'); p.textContent = txt; msgEl.prepend(p); };
function renderLobby(players) { lobbyListEl.innerHTML = ''; players.forEach(p => { const li = document.createElement('li'); li.textContent = `Seat ${p.seat}: ${p.name}`; lobbyListEl.appendChild(li); }); }

function renderBoard() {
    boardEl.innerHTML = '';
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
        if (boardEl.children.length > 0) {
            boardEl.firstChild.classList.add('drop-target');
            boardEl.firstChild.dataset.side = 'left';
            if (boardEl.children.length > 1 || (boardState[0][0] !== boardState[0][1])) {
                boardEl.lastChild.classList.add('drop-target');
                boardEl.lastChild.dataset.side = 'right';
            }
        }
    }
}

function renderPlaceholder() {
    const placeholder = document.createElement('div');
    placeholder.className = 'tile-placeholder drop-target';
    placeholder.dataset.side = 'right';
    const isFirstGameRound = scores[0] === 0 && scores[1] === 0;
    placeholder.textContent = isFirstGameRound ? '6|6' : 'Play Tile';
    boardEl.appendChild(placeholder);
}

function renderHand() {
    handEl.innerHTML = '';
    myHand.forEach((tileData) => {
        const d = document.createElement('div');
        d.className = 'tile';
        if (currentTurn !== mySeat) d.classList.add('disabled');
        d.innerHTML = `<span>${tileData[0]}</span><span>${tileData[1]}</span>`;
        if (currentTurn === mySeat) {
            d.addEventListener('mousedown', (e) => handleDragStart(e, tileData, d));
            d.addEventListener('touchstart', (e) => handleDragStart(e, tileData, d), { passive: false });
        }
        handEl.appendChild(d);
    });
}

function seatPos(seat) { if (seat === mySeat) return 'self'; const diff = (seat - mySeat + 4) % 4; if (diff === 1) return 'right'; if (diff === 2) return 'top'; return 'left'; }
function renderOpponents() { const playerAreas = { top: topEl, left: leftEl, right: rightEl }; Object.values(playerAreas).forEach(el => el.innerHTML = ''); Object.entries(seatMap).forEach(([s, info]) => { const seat = +s; if (seat === mySeat) return; const pos = seatPos(seat); const areaEl = playerAreas[pos]; if (areaEl) { const nameEl = document.createElement('div'); nameEl.textContent = `${info.name} (Seat ${seat})`; areaEl.appendChild(nameEl); const handDisplayEl = document.createElement('div'); handDisplayEl.className = 'player-area-hand-display'; const count = handSizes[seat] || 0; for (let i = 0; i < count; i++) { const dummy = document.createElement('div'); dummy.className = 'dummy-tile'; handDisplayEl.appendChild(dummy); } areaEl.appendChild(handDisplayEl); } }); }
function renderScores() { team0ScoreEl.textContent = scores[0]; team1ScoreEl.textContent = scores[1]; }
function renderPips(pipCounts) { pipEl.textContent = pipCounts ? Object.entries(pipCounts).map(([p, c]) => `${p}:${c}`).join(' | ') : ''; }

/* ─── Drag and Drop Logic (UPDATED) ────────────────────────────────── */

function handleDragStart(e, tileData, tileElement) {
    if (e.type === 'touchstart') e.preventDefault();
    if (dragged.isDragging) return;

    dragged = { tileData, originalTile: tileElement, isDragging: true, hoveredSide: null };
    
    dragged.element = tileElement.cloneNode(true);
    dragged.element.classList.add('dragging');
    document.body.appendChild(dragged.element);
    
    tileElement.classList.add('ghost'); // Make original tile see-through

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

function handleDragEnd(e) {
    if (!dragged.isDragging) return;

    const { originalTile, tileData, hoveredSide } = dragged;

    if (hoveredSide) {
        // A valid move was made, let the server handle it
        socket.emit('playTile', { roomId, seat: mySeat, tile: tileData, side: hoveredSide });
    } else {
        // Invalid drop, return the tile to the hand
        originalTile.classList.remove('ghost');
    }
    
    cleanupDrag();
}

// NEW: Central cleanup function
function cleanupDrag() {
    if (dragged.element) {
        dragged.element.remove();
    }
    document.querySelectorAll('.drop-hover').forEach(el => el.classList.remove('drop-hover'));
    
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('touchend', handleDragEnd);
    
    // Reset state object
    dragged = { element: null, originalTile: null, tileData: null, isDragging: false, hoveredSide: null };
}

function moveDraggedElement(x, y) {
    if (!dragged.element) return;
    dragged.element.style.left = `${x}px`;
    dragged.element.style.top = `${y}px`;
}

function getEventPosition(e) {
    return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
}

// ... (All socket.on event handlers from roomJoined to the end are the same)
// I've added cleanupDrag() calls to reset state after the turn changes or a move is broadcast.
socket.on('roomJoined', ({ roomId: id, seat }) => { roomId = id; mySeat = seat; sessionStorage.setItem('domino_roomId', roomId); sessionStorage.setItem('domino_mySeat', mySeat); playerInfoEl.textContent = `You are Seat ${seat} (Team ${seat % 2 === 0 ? '0&2' : '1&3'})`; });
socket.on('lobbyUpdate', ({ players }) => { lobbyContainerEl.style.display = 'block'; seatMap = Object.fromEntries(players.map(p => [p.seat, p])); renderLobby(players); });
socket.on('roundStart', ({ yourHand, startingSeat, scores: s }) => { lobbyContainerEl.style.display = 'none'; myHand = yourHand; boardState = []; scores = s; currentTurn = startingSeat; msgEl.innerHTML = ''; handSizes = { 0: 7, 1: 7, 2: 7, 3: 7 }; cleanupDrag(); renderScores(); renderBoard(); renderHand(); renderOpponents(); setStatus(currentTurn === mySeat ? 'Your turn!' : `Waiting for seat ${currentTurn}`); });
socket.on('updateHand', hand => { myHand = hand; handSizes[mySeat] = hand.length; renderHand(); renderOpponents(); });
socket.on('broadcastMove', ({ seat, tile, board, pipCounts }) => { boardState = board; if (seat !== mySeat) { handSizes[seat]--; } cleanupDrag(); renderBoard(); renderPips(pipCounts); renderOpponents(); addMsg(`${seat} played ${tile[0]}|${tile[1]}.`); });
socket.on('turnChanged', turn => { currentTurn = turn; setStatus(turn === mySeat ? 'Your turn!' : `Waiting for seat ${turn}`); cleanupDrag(); renderHand(); [topEl, leftEl, rightEl, handEl].forEach(el => { el.classList.remove('active-turn-indicator'); }); const pos = seatPos(turn); if (pos === 'top') topEl.classList.add('active-turn-indicator'); else if (pos === 'left') leftEl.classList.add('active-turn-indicator'); else if (pos === 'right') rightEl.classList.add('active-turn-indicator'); else if (pos === 'self') handEl.classList.add('active-turn-indicator'); });
socket.on('playerPassed', ({ seat }) => { addMsg(`Seat ${seat} passed.`); });
socket.on('roundEnded', ({ winner, reason, points, scores: s, board }) => { boardState = board; scores = s; renderScores(); renderBoard(); let msg = `Seat ${winner} wins (${reason}) +${points} pts.`; setStatus(msg); addMsg(msg); });
socket.on('gameOver', ({ winningTeam, scores: s }) => { sessionStorage.removeItem('domino_roomId'); sessionStorage.removeItem('domino_mySeat'); alert(`Game over! Team ${winningTeam} wins.\nScores: ${s.join(' / ')}`); setStatus('Game over.'); });
socket.on('reconnectSuccess', ({ roomState }) => { console.log('Successfully reconnected!'); });
socket.on('errorMessage', showError);
socket.on('bonusAwarded', ({ seat, type, points, scores: s }) => { scores = s; renderScores(); addMsg(`Team ${seat % 2} gets +${points} pts for ${type}!`); });