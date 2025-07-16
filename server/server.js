/* =====================================================================
 * server.js — Dominican Domino Server (REFACTORED)
 *
 * FIXES APPLIED:
 * - Removed internal DominoGameState class.
 * - Now uses the modular engine/game.js and engine/utils.js.
 * - Correctly constructs and emits all socket payloads.
 * - Aligns with the modern, modular architecture.
 * =================================================================== */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// AI NOTE: Require the refactored game engine and constants.
const GameEngine = require('./engine/game');
const GC = require('./shared/constants/gameConstants');

// ────────────────────────────────────────────────────────────────────────
// Server Setup
// ────────────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));
app.use('/shared', express.static(path.join(__dirname, 'shared')));
app.use('/src', express.static(path.join(__dirname, 'src'))); // Serve client-side JS

// ────────────────────────────────────────────────────────────────────────
// Game State Storage
// ────────────────────────────────────────────────────────────────────────
const gameRooms = new Map();

// ────────────────────────────────────────────────────────────────────────
// Game Room Class (Player Management)
// ────────────────────────────────────────────────────────────────────────
class GameRoom {
  constructor(roomId) {
    this.id = roomId;
    this.players = {}; // Use an object for easier seat management
    this.scores = [0, 0];
    this.isGameActive = false;
    this.isFirstRound = true;
    this.lastWinnerSeat = null;

    // AI NOTE: Game state logic is now managed by the engine, not by a class here.
    this.board = [];
    this.leftEnd = null;
    this.rightEnd = null;
    this.turn = null;
  }

  addPlayer(player, seat) {
    this.players[seat] = player;
  }

  isFull() {
    return Object.keys(this.players).length === 4 &&
           Object.values(this.players).every(p => p.connected);
  }

  getConnectedCount() {
    return Object.values(this.players).filter(p => p.connected).length;
  }

  getPlayerList() {
    return Object.values(this.players).map(p => ({
      seat: p.seat,
      name: p.name,
      connected: p.connected
    }));
  }

  findEmptySeat() {
    for (let i = 0; i < 4; i++) {
      if (!this.players[i]) {
        return i;
      }
    }
    return -1;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Socket.IO Connection Handler
// ────────────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  socket.on('findRoom', ({ playerName }) => {
    let targetRoom = [...gameRooms.values()].find(room => !room.isGameActive && room.getConnectedCount() < 4);

    if (!targetRoom) {
      const newRoomId = 'room_' + Date.now();
      targetRoom = new GameRoom(newRoomId);
      gameRooms.set(newRoomId, targetRoom);
    }

    const assignedSeat = targetRoom.findEmptySeat();
    const player = { socketId: socket.id, name: playerName, seat: assignedSeat, connected: true, hand: [] };

    targetRoom.addPlayer(player, assignedSeat);
    socket.join(targetRoom.id);

    socket.emit('roomJoined', { roomId: targetRoom.id, seat: assignedSeat });
    io.to(targetRoom.id).emit('lobbyUpdate', { players: targetRoom.getPlayerList() });

    console.log(`Player ${playerName} joined room ${targetRoom.id} as seat ${assignedSeat}`);

    if (targetRoom.isFull()) {
      console.log('Room is full, starting game...');
      startGame(targetRoom);
    }
  });

  socket.on('playTile', ({ roomId, seat, tile, side }) => {
    const room = gameRooms.get(roomId);
    if (!room || !room.isGameActive || room.turn !== seat) {
      return socket.emit('errorMessage', 'Invalid move: Not your turn or game not active.');
    }

    // AI NOTE: Use the game engine to validate and place the tile.
    if (GameEngine.placeTile(room, tile, side)) {
      // Remove tile from player's hand
      const player = room.players[seat];
      const tileIndex = player.hand.findIndex(t => t[0] === tile[0] && t[1] === tile[1]);
      if (tileIndex > -1) player.hand.splice(tileIndex, 1);

      // AI NOTE: Use the engine to broadcast the move with the correct payload.
      GameEngine.emitBroadcastMove(io, room, seat, tile);

      // Check for a winner
      if (player.hand.length === 0) {
        endRound(room, seat, 'domino');
      } else {
        // Advance turn
        room.turn = GameEngine.nextSeat(seat);
        io.to(roomId).emit('turnChanged', room.turn);
      }
    } else {
      socket.emit('errorMessage', 'Invalid move!');
    }
  });

  socket.on('passPlay', ({ roomId, seat }) => {
    const room = gameRooms.get(roomId);
    if (!room || !room.isGameActive || room.turn !== seat) return;

    // Logic for handling passes and checking for a blocked game would go here.
    // For now, we just advance the turn.
    io.to(roomId).emit('playerPassed', { seat });
    room.turn = GameEngine.nextSeat(seat);
    io.to(roomId).emit('turnChanged', room.turn);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    for (const room of gameRooms.values()) {
        const player = Object.values(room.players).find(p => p.socketId === socket.id);
        if (player) {
            player.connected = false;
            io.to(room.id).emit('lobbyUpdate', { players: room.getPlayerList() });
            // Additional logic to handle players leaving mid-game can be added here.
            break;
        }
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
// Game Lifecycle Functions
// ────────────────────────────────────────────────────────────────────────
function startGame(room) {
  if (!room.isFull()) return;

  console.log(`Starting game in room ${room.id}`);
  room.isGameActive = true;

  // AI NOTE: Use the engine to initialize the round.
  // This function deals hands and emits the 'roundStart' event with the correct payload.
  GameEngine.initNewRound(room, io);
}

function endRound(room, winnerSeat, reason) {
    console.log(`Round ended. Winner: Seat ${winnerSeat}`);
    room.isGameActive = false;
    room.lastWinnerSeat = winnerSeat;

    // Calculate points (simplified for this example)
    const points = Object.values(room.players)
        .flatMap(p => p.hand)
        .reduce((sum, tile) => sum + tile[0] + tile[1], 0);

    const winningTeam = GameEngine.teamOf(winnerSeat);
    room.scores[winningTeam] += points;

    // AI NOTE: Construct the roundEnded payload with the correct keys.
    io.to(room.id).emit('roundEnded', {
        winner: winnerSeat,
        reason: reason,
        points: points,
        scores: room.scores,
        boardState: room.board,
        finalHandSizes: Object.fromEntries(
            Object.values(room.players).map(p => [p.seat, p.hand.length])
        )
    });

    // Check for game over
    if (room.scores[winningTeam] >= GC.WINNING_SCORE) {
        io.to(room.id).emit('gameOver', { winningTeam, scores: room.scores });
        gameRooms.delete(room.id);
    } else {
        // Start a new round after a delay
        setTimeout(() => startGame(room), 5000);
    }
}

// ────────────────────────────────────────────────────────────────────────
// Start Server
// ────────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Dominican Domino server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in 4 browser windows to play!`);
});
