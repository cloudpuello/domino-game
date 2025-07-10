/* =====================================================================
 * server/server.js  –  Socket.IO domino server (REWRITTEN)
 * =================================================================== */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

/* -- Core game engine ------------------------------------------------ */
const {
  placeTile,
  nextSeat,
  teamOf,
  initNewRound,
} = require('../engine/game');

/* -- Server setup ---------------------------------------------------- */
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = 3000;

app.use(express.static('public'));

/* ────────────────────────────────────────────────────────────────────────
 * Player class - represents a connected player
 * ────────────────────────────────────────────────────────────────────── */
class Player {
  constructor(socketId, name, seat) {
    this.socketId = socketId;
    this.name = name;
    this.seat = seat;
    this.hand = [];
    this.isConnected = true;
  }

  handSum() {
    return this.hand.reduce((sum, [a, b]) => sum + a + b, 0);
  }

  hasTile(targetTile) {
    const [targetA, targetB] = targetTile;
    return this.hand.some(([a, b]) => 
      (a === targetA && b === targetB) || (a === targetB && b === targetA)
    );
  }

  removeTile(targetTile) {
    const [targetA, targetB] = targetTile;
    const index = this.hand.findIndex(([a, b]) => 
      (a === targetA && b === targetB) || (a === targetB && b === targetA)
    );
    if (index !== -1) {
      return this.hand.splice(index, 1)[0];
    }
    return null;
  }

  canPlayOnBoard(leftEnd, rightEnd) {
    if (leftEnd === null && rightEnd === null) {
      // First move - must have [6,6]
      return this.hand.some(([a, b]) => a === 6 && b === 6);
    }
    return this.hand.some(([a, b]) => 
      a === leftEnd || b === leftEnd || a === rightEnd || b === rightEnd
    );
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * Room management
 * ────────────────────────────────────────────────────────────────────── */
let roomCounter = 1;
const rooms = {};

function createRoom(id) {
  rooms[id] = {
    id,
    players: {},                 // seat → Player | undefined
    isGameStarted: false,

    /* Round state */
    board: [],
    leftEnd: null,
    rightEnd: null,
    pipCounts: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    turn: null,
    turnStarter: null,
    lastMoverSeat: null,
    passCount: 0,
    isRoundOver: false,

    /* Game state */
    isFirstRound: true,
    lastWinnerSeat: null,
    scores: [0, 0],
    reconnectTimers: {},
  };
  return rooms[id];
}

function findAvailableRoom() {
  return Object.values(rooms).find(room => 
    !room.isGameStarted && 
    getConnectedPlayerCount(room) < 4
  );
}

function getConnectedPlayerCount(room) {
  return Object.values(room.players)
    .filter(player => player && player.isConnected)
    .length;
}

function findPlayerRoom(socketId) {
  return Object.values(rooms).find(room =>
    Object.values(room.players).some(player => 
      player && player.socketId === socketId
    )
  );
}

function findPlayerSeat(room, socketId) {
  return Object.keys(room.players).find(seat =>
    room.players[seat] && room.players[seat].socketId === socketId
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Turn management
 * ────────────────────────────────────────────────────────────────────── */
function advanceToNextTurn(room) {
  let nextPlayerSeat = room.turn;
  let passedPlayers = 0;

  for (let i = 0; i < 4; i++) {
    nextPlayerSeat = nextSeat(nextPlayerSeat);
    const player = room.players[nextPlayerSeat];

    if (!player || !player.isConnected) {
      io.in(room.id).emit('playerPassed', { 
        seat: nextPlayerSeat, 
        reason: 'disconnected' 
      });
      passedPlayers++;
      continue;
    }

    if (player.canPlayOnBoard(room.leftEnd, room.rightEnd)) {
      room.turn = nextPlayerSeat;
      room.passCount = 0;
      io.in(room.id).emit('turnChanged', room.turn);
      return;
    }

    io.in(room.id).emit('playerPassed', { seat: nextPlayerSeat });
    passedPlayers++;
  }

  // All players passed - handle tranca
  if (passedPlayers >= 4) {
    handleTranca(room);
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * Scoring and round ending
 * ────────────────────────────────────────────────────────────────────── */
function calculateAllPips(room) {
  return Object.values(room.players)
    .filter(player => player && player.isConnected)
    .reduce((total, player) => total + player.handSum(), 0);
}

function handleRoundWin(room, winnerSeat, reason) {
  if (room.isRoundOver) return;
  
  room.isRoundOver = true;
  room.lastWinnerSeat = winnerSeat;
  
  const totalPips = calculateAllPips(room);
  const winnerTeam = teamOf(winnerSeat);
  let points = totalPips;
  
  // Add bonuses based on reason
  if (reason.includes('capicu')) points += 30;
  if (reason.includes('paso')) points += 30;
  
  room.scores[winnerTeam] += points;
  
  io.in(room.id).emit('roundEnded', {
    winner: winnerSeat,
    reason,
    points,
    scores: room.scores,
    board: room.board
  });

  // Check for game over or start next round
  setTimeout(() => maybeStartNextRound(room), 3000);
}

function handleTranca(room) {
  if (room.isRoundOver) return;
  
  const lastMover = room.lastMoverSeat;
  if (lastMover === null) return;
  
  const nextPlayer = nextSeat(lastMover);
  const lastMoverPips = room.players[lastMover]?.handSum() || 0;
  const nextPlayerPips = room.players[nextPlayer]?.handSum() || 0;
  
  const winnerSeat = lastMoverPips <= nextPlayerPips ? lastMover : nextPlayer;
  handleRoundWin(room, winnerSeat, 'tranca');
}

function maybeStartNextRound(room) {
  // Check for game over (200 points)
  if (room.scores.some(score => score >= 200)) {
    const winningTeam = room.scores.findIndex(score => score >= 200);
    io.in(room.id).emit('gameOver', { 
      winningTeam, 
      scores: room.scores 
    });
    delete rooms[room.id];
    return;
  }
  
  // Start next round
  initNewRound(room, io);
}

/* ────────────────────────────────────────────────────────────────────────
 * Lobby management
 * ────────────────────────────────────────────────────────────────────── */
function broadcastLobbyUpdate(room) {
  const playersList = Object.values(room.players)
    .filter(player => player)
    .map(player => ({
      seat: player.seat,
      name: player.name,
      connected: player.isConnected
    }));

  io.in(room.id).emit('lobbyUpdate', {
    players: playersList,
    seatsRemaining: 4 - getConnectedPlayerCount(room),
  });
}

function tryStartGame(room) {
  const connectedCount = getConnectedPlayerCount(room);
  if (connectedCount === 4 && !room.isGameStarted) {
    room.isGameStarted = true;
    io.in(room.id).emit('allPlayersReady');
    setTimeout(() => initNewRound(room, io), 1500);
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * Socket event handlers
 * ────────────────────────────────────────────────────────────────────── */
io.on('connection', socket => {

  /* -------- findRoom / lobby join ---------------------------------- */
  socket.on('findRoom', ({ playerName, roomId, reconnectSeat }) => {
    
    // TODO: Handle reconnection logic here if needed
    if (roomId && rooms[roomId] && reconnectSeat !== undefined) {
      // Reconnection logic would go here
      return;
    }

    /* Find or create lobby */
    let room = findAvailableRoom();
    if (!room) {
      room = createRoom(`room${roomCounter++}`);
    }

    /* Find available seat */
    const availableSeat = [0, 1, 2, 3].find(seat => !room.players[seat]);
    if (availableSeat === undefined) {
      socket.emit('errorMessage', 'Room is full');
      return;
    }

    /* Create and add player */
    const player = new Player(
      socket.id, 
      playerName || `Player ${availableSeat + 1}`, 
      availableSeat
    );
    room.players[availableSeat] = player;

    socket.join(room.id);
    socket.emit('roomJoined', { 
      roomId: room.id, 
      seat: availableSeat 
    });

    broadcastLobbyUpdate(room);
    tryStartGame(room);
  });

  /* -------- playTile ---------------------------------------------- */
  socket.on('playTile', ({ roomId, seat, tile, side }) => {
    const room = rooms[roomId];
    if (!room) {
      return socket.emit('errorMessage', 'Room not found');
    }

    if (room.isRoundOver) {
      return socket.emit('errorMessage', 'Round is over');
    }

    if (room.turn !== seat) {
      return socket.emit('errorMessage', 'Not your turn');
    }

    const player = room.players[seat];
    if (!player || !player.isConnected) {
      return socket.emit('errorMessage', 'Player not found');
    }

    if (!player.hasTile(tile)) {
      return socket.emit('errorMessage', 'You do not have that tile');
    }

    /* Try to place the tile */
    if (!placeTile(room, tile, side)) {
      return socket.emit('errorMessage', 'Invalid tile placement');
    }

    /* Remove tile from player's hand */
    player.removeTile(tile);
    room.lastMoverSeat = seat;

    /* Update pip counts */
    const [a, b] = tile;
    room.pipCounts[a]++;
    room.pipCounts[b]++;

    /* Send updated hand to player */
    socket.emit('updateHand', player.hand);

    /* Broadcast move to all players */
    io.in(room.id).emit('broadcastMove', {
      seat,
      tile,
      board: room.board,
      pipCounts: room.pipCounts
    });

    /* Check for round win */
    if (player.hand.length === 0) {
      handleRoundWin(room, seat, 'emptied hand');
      return;
    }

    /* Advance to next turn */
    advanceToNextTurn(room);
  });

  /* -------- disconnect -------------------------------------------- */
  socket.on('disconnect', () => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;

    const seat = findPlayerSeat(room, socket.id);
    if (seat === undefined) return;

    /* Mark player as disconnected */
    room.players[seat].isConnected = false;

    /* Update lobby if game hasn't started */
    if (!room.isGameStarted) {
      broadcastLobbyUpdate(room);
    }

    console.log(`Player ${room.players[seat].name} (Seat ${seat}) disconnected from ${room.id}`);
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * Start server
 * ────────────────────────────────────────────────────────────────────── */
server.listen(PORT, () =>
  console.log(`✅ Domino server running at http://localhost:${PORT}`)
);