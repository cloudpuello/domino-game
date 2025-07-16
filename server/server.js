/* =====================================================================
 * server/server.js — Dominican Domino Server (FIXED & HARDENED)
 *
 * CRITICAL FIXES APPLIED:
 * - Corrected all file paths assuming server.js is in a /server folder.
 * - Added proper error handling for module loading and runtime events.
 * - Fixed static file serving paths for the new structure.
 * - Added CORS headers to Socket.IO for better compatibility.
 * - Added process-level error handlers for stability.
 * =================================================================== */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// AI NOTE: Paths are corrected to go up one level from /server to the project root.
// A try/catch block ensures the server fails gracefully if modules are missing.
let GameEngine, GC;
try {
  GameEngine = require('../engine/game');
  GC = require('../shared/constants/gameConstants');
  console.log('✓ Game engine and constants loaded successfully.');
} catch (error) {
  console.error('✗ FATAL: Failed to load required game modules.', error.message);
  console.error('Please ensure engine/game.js and shared/constants/gameConstants.js exist.');
  process.exit(1); // Exit if core modules can't be loaded.
}

// ────────────────────────────────────────────────────────────────────────
// Server Setup
// ────────────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow connections from any origin
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3000;

// Serve static files from the /public directory at the root.
app.use(express.static(path.join(__dirname, '../public')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));
app.use('/src', express.static(path.join(__dirname, '../src')));

// ────────────────────────────────────────────────────────────────────────
// Game State Storage
// ────────────────────────────────────────────────────────────────────────
const gameRooms = new Map();

// ────────────────────────────────────────────────────────────────────────
// Game Room Class
// ────────────────────────────────────────────────────────────────────────
class GameRoom {
  constructor(roomId) {
    this.id = roomId;
    this.players = {};
    this.scores = [0, 0];
    this.isGameActive = false;
    this.isFirstRound = true;
    this.lastWinnerSeat = null;

    // Game state properties that will be managed by the engine
    this.board = [];
    this.leftEnd = null;
    this.rightEnd = null;
    this.turn = null;
  }

  addPlayer(player, seat) { this.players[seat] = player; }
  isFull() { return Object.keys(this.players).length === 4 && Object.values(this.players).every(p => p.connected); }
  getConnectedCount() { return Object.values(this.players).filter(p => p.connected).length; }
  getPlayerList() { return Object.values(this.players).map(p => ({ seat: p.seat, name: p.name, connected: p.connected })); }
  findEmptySeat() {
    for (let i = 0; i < 4; i++) { if (!this.players[i]) return i; }
    return -1;
  }
  findPlayerBySocket(socketId) { return Object.values(this.players).find(p => p.socketId === socketId); }
}

// ────────────────────────────────────────────────────────────────────────
// Socket.IO Connection Handler
// ────────────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('findRoom', ({ playerName }) => {
    try {
      let targetRoom = [...gameRooms.values()].find(room => !room.isGameActive && room.getConnectedCount() < 4);

      if (!targetRoom) {
        const newRoomId = 'room_' + Date.now();
        targetRoom = new GameRoom(newRoomId);
        gameRooms.set(newRoomId, targetRoom);
      }

      const assignedSeat = targetRoom.findEmptySeat();
      if (assignedSeat === -1) return socket.emit('errorMessage', 'Room is full.');

      const player = { socketId: socket.id, name: playerName, seat: assignedSeat, connected: true, hand: [] };
      targetRoom.addPlayer(player, assignedSeat);
      socket.join(targetRoom.id);

      socket.emit('roomJoined', { roomId: targetRoom.id, seat: assignedSeat });
      io.to(targetRoom.id).emit('lobbyUpdate', { players: targetRoom.getPlayerList() });

      if (targetRoom.isFull()) {
        console.log(`Room ${targetRoom.id} is full, starting game...`);
        startGame(targetRoom);
      }
    } catch (error) {
      console.error('Error in findRoom:', error);
      socket.emit('errorMessage', 'An error occurred while joining a room.');
    }
  });

  socket.on('playTile', ({ roomId, seat, tile, side }) => {
    try {
      const room = gameRooms.get(roomId);
      if (!room || !room.isGameActive || room.turn !== seat) {
        return socket.emit('errorMessage', 'Invalid move: Not your turn or game not active.');
      }

      const player = room.players[seat];
      const tileIndex = player.hand.findIndex(t => t[0] === tile[0] && t[1] === tile[1]);
      if (tileIndex === -1) return socket.emit('errorMessage', 'Tile not in hand.');

      if (GameEngine.placeTile(room, tile, side)) {
        player.hand.splice(tileIndex, 1);
        GameEngine.emitBroadcastMove(io, room, seat, tile);

        if (player.hand.length === 0) {
          endRound(room, seat, 'domino');
        } else {
          room.turn = GameEngine.nextSeat(seat);
          io.to(roomId).emit('turnChanged', room.turn);
        }
      } else {
        socket.emit('errorMessage', 'Invalid move!');
      }
    } catch (error) {
      console.error('Error in playTile:', error);
      socket.emit('errorMessage', 'An error occurred while playing a tile.');
    }
  });

  socket.on('passPlay', ({ roomId, seat }) => {
    const room = gameRooms.get(roomId);
    if (!room || !room.isGameActive || room.turn !== seat) return;
    io.to(roomId).emit('playerPassed', { seat });
    room.turn = GameEngine.nextSeat(seat);
    io.to(roomId).emit('turnChanged', room.turn);
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    for (const room of gameRooms.values()) {
      const player = room.findPlayerBySocket(socket.id);
      if (player) {
        player.connected = false;
        io.to(room.id).emit('lobbyUpdate', { players: room.getPlayerList() });
        break;
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
// Game Lifecycle Functions
// ────────────────────────────────────────────────────────────────────────
function startGame(room) {
  try {
    if (!room.isFull()) return;
    console.log(`Starting game in room ${room.id}`);
    room.isGameActive = true;
    GameEngine.initNewRound(room, io);
  } catch (error) {
    console.error(`Error starting game in room ${room.id}:`, error);
    io.to(room.id).emit('errorMessage', 'A critical error occurred while starting the game.');
  }
}

function endRound(room, winnerSeat, reason) {
    try {
        console.log(`Round ended. Winner: Seat ${winnerSeat}`);
        room.isGameActive = false;
        room.lastWinnerSeat = winnerSeat;

        const points = Object.values(room.players)
            .flatMap(p => p.hand)
            .reduce((sum, tile) => sum + tile[0] + tile[1], 0);

        const winningTeam = GameEngine.teamOf(winnerSeat);
        room.scores[winningTeam] += points;

        io.to(room.id).emit('roundEnded', {
            winner: winnerSeat, reason, points,
            scores: room.scores,
            boardState: room.board,
            finalHandSizes: Object.fromEntries(Object.values(room.players).map(p => [p.seat, p.hand.length]))
        });

        if (room.scores[winningTeam] >= GC.WINNING_SCORE) {
            io.to(room.id).emit('gameOver', { winningTeam, scores: room.scores });
            gameRooms.delete(room.id);
        } else {
            setTimeout(() => startGame(room), 5000);
        }
    } catch(error) {
        console.error(`Error ending round in room ${room.id}:`, error);
        io.to(room.id).emit('errorMessage', 'A critical error occurred while ending the round.');
    }
}

// ────────────────────────────────────────────────────────────────────────
// Start Server
// ────────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`🎮 Dominican Domino Server Started`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`🔗 Open: http://localhost:${PORT}`);
  console.log('='.repeat(60));
}).on('error', (error) => {
  console.error('✗ SERVER FAILED TO START:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please close the other process or choose a different port.`);
  }
  process.exit(1);
});

// Process-level error handlers for stability
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});
