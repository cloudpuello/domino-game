/* =====================================================================
 * server/server.js — Dominican Domino Server (FIXED CONNECTION ISSUES)
 * =================================================================== */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

console.log('🚀 Starting Dominican Domino Server...');
console.log('📂 Current directory:', __dirname);

// ────────────────────────────────────────────────────────────────────────
// Enhanced Module Loading with Better Error Handling
// ────────────────────────────────────────────────────────────────────────
let GameEngine, GC;

try {
  console.log('📦 Loading game modules...');
  
  // ────────────────────────────────────────────────────────────────────────
// Temporary Module Loading - Get Server Running
// ────────────────────────────────────────────────────────────────────────
let GameEngine, GC;

console.log('📦 Loading game modules...');

// Create a minimal game engine stub for now
GameEngine = {
  games: new Map(),
  
  createRoom(roomId) {
    const room = {
      id: roomId,
      players: {},
      board: [],
      scores: [0, 0],
      currentTurn: null,
      isGameActive: false
    };
    this.games.set(roomId, room);
    return room;
  },
  
  getRoom(roomId) {
    return this.games.get(roomId);
  },
  
  startGame(room) {
    console.log(`[GameEngine Stub] Starting game in room ${room.id}`);
    room.isGameActive = true;
    
    // For now, just return basic info
    return {
      success: true,
      startingSeat: 0,
      gamePhase: 'firstGame',
      isFirstGame: true
    };
  }
};

console.log('✓ GameEngine stub loaded');

// Try to load constants
try {
  GC = require('../shared/constants/gameConstants');
  console.log('✓ GameConstants loaded successfully');
} catch (e) {
  console.log('⚠️  GameConstants not found, using defaults');
  GC = { 
    MAX_PIPS: 6, 
    HAND_SIZE: 7,
    DOMINO_SET: [] // Will be populated if needed
  };
}

console.log('✓ Modules ready for connection testing');

// ────────────────────────────────────────────────────────────────────────
// Server Setup with Enhanced Error Handling
// ────────────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// Enhanced Socket.IO setup
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false
  },
  allowEIO3: true,  // Better compatibility
  transports: ['websocket', 'polling']  // Fallback transports
});

const PORT = process.env.PORT || 3000;

// ────────────────────────────────────────────────────────────────────────
// Enhanced Static File Serving
// ────────────────────────────────────────────────────────────────────────

// Log static file attempts for debugging
app.use((req, res, next) => {
  if (req.url.includes('.js') || req.url.includes('.css') || req.url.includes('.html')) {
    console.log(`📁 Static file request: ${req.method} ${req.url}`);
  }
  next();
});

// Serve static files with proper error handling
try {
  const publicPath = path.join(__dirname, '../public');
  const sharedPath = path.join(__dirname, '../shared');
  
  console.log('📂 Setting up static file serving:');
  console.log('   - Public files from:', publicPath);
  console.log('   - Shared files from:', sharedPath);
  
  app.use(express.static(publicPath));
  app.use('/shared', express.static(sharedPath));
  
  // Add explicit routes for critical files
  app.get('/client.js', (req, res) => {
    res.sendFile(path.join(publicPath, 'client.js'));
  });
  
  app.get('/shared/constants/gameConstants.js', (req, res) => {
    res.sendFile(path.join(sharedPath, 'constants/gameConstants.js'));
  });
  
} catch (error) {
  console.error('❌ Error setting up static file serving:', error);
  process.exit(1);
}

// ────────────────────────────────────────────────────────────────────────
// Health Check & Root Routes
// ────────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  console.log('🔍 Health check requested');
  
  try {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      rules: 'dominican-correct', 
      turnOrder: 'counter-clockwise',
      userSeat: 'always-bottom',
      gameEngine: !!GameEngine,
      gameConstants: !!GC,
      rooms: gameRooms.size,
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('/', (req, res) => {
  console.log('🏠 Root page requested');
  try {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  } catch (error) {
    console.error('❌ Error serving index.html:', error);
    res.status(500).send('Error loading game page');
  }
});

// ────────────────────────────────────────────────────────────────────────
// Game State Storage
// ────────────────────────────────────────────────────────────────────────
const gameRooms = new Map();

// ────────────────────────────────────────────────────────────────────────
// Dominican Game Room Class
// ────────────────────────────────────────────────────────────────────────
class DominicanGameRoom {
  constructor(roomId) {
    this.id = roomId;
    this.players = {};
    this.scores = [0, 0];
    this.isGameActive = false;
    this.gamePhase = 'firstGame';  // Start with first game
    this.lastWinnerSeat = null;
    this.gamesPlayed = 0;
    
    // Dominican game state
    this.board = [];
    this.leftEnd = null;
    this.rightEnd = null;
    this.turn = null;
    this.turnStarter = null;
    this.lastPlayedTile = null;
    this.lastPlayedSeat = null;
    this.lastPassSeat = null;
    this.passCount = 0;
    this.isRoundOver = false;
    this.gameState = 'waiting';
  }

  addPlayer(player, seat) {
    this.players[seat] = player;
    console.log(`[Room ${this.id}] Added ${player.name} to seat ${seat}`);
  }

  isFull() {
    return Object.keys(this.players).length === 4 &&
           Object.values(this.players).every(p => p && p.connected);
  }

  getConnectedCount() {
    return Object.values(this.players).filter(p => p && p.connected).length;
  }

  getPlayerList() {
    return Object.values(this.players)
      .filter(p => p)
      .map(p => ({
        seat: p.seat,
        name: p.name,
        connected: p.connected
      }));
  }

  findSeatForNewPlayer() {
    // Always try to give new players seat 0 first (bottom/user position)
    if (!this.players[0]) return 0;
    
    // Then fill other seats in order
    for (let i = 1; i < 4; i++) {
      if (!this.players[i]) return i;
    }
    
    return -1; // Room full
  }

  findPlayerBySocket(socketId) {
    return Object.values(this.players).find(p => p && p.socketId === socketId);
  }

  nextTurn() {
    // Counter-clockwise: 0->3->2->1->0
    const order = [0, 3, 2, 1];
    const currentIndex = order.indexOf(this.turn);
    const nextIndex = (currentIndex + 1) % order.length;
    this.turn = order[nextIndex];
    this.passCount = 0;
  }

  isFirstGame() {
    return this.gamePhase === 'firstGame';
  }

  nextGamePhase() {
    if (this.gamePhase === 'firstGame') {
      this.gamePhase = 'normalRound';
      this.gamesPlayed++;
      console.log(`[Room ${this.id}] Moving to normal rounds after first game`);
    } else {
      this.gamesPlayed++;
      console.log(`[Room ${this.id}] Game ${this.gamesPlayed} completed`);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────
// Enhanced Socket.IO Connection Handler
// ────────────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔗 New client connected: ${socket.id}`);
  
  // Send immediate connection confirmation
  socket.emit('connected', { 
    socketId: socket.id, 
    serverTime: new Date().toISOString(),
    gameRules: 'dominican-correct'
  });

  // Handle room finding/joining
  socket.on('findRoom', ({ playerName, roomId, reconnectSeat }) => {
    console.log(`🔍 ${playerName} looking for room (${socket.id})`);
    
    try {
      let targetRoom = null;
      
      // Try reconnection or find/create room
      if (roomId && gameRooms.has(roomId)) {
        targetRoom = gameRooms.get(roomId);
        console.log(`♻️  Attempting reconnection to room ${roomId}`);
      } else {
        targetRoom = [...gameRooms.values()].find(room => 
          !room.isGameActive && room.getConnectedCount() < 4
        );
        
        if (!targetRoom) {
          const newRoomId = 'dominican_' + Date.now();
          targetRoom = new DominicanGameRoom(newRoomId);
          gameRooms.set(newRoomId, targetRoom);
          console.log(`🆕 Created new room: ${newRoomId}`);
        } else {
          console.log(`🔄 Joining existing room: ${targetRoom.id}`);
        }
      }

      // Assign seat
      let assignedSeat = reconnectSeat;
      if (assignedSeat === null || assignedSeat === undefined) {
        assignedSeat = targetRoom.findSeatForNewPlayer();
      }
      
      if (assignedSeat === -1) {
        console.log(`❌ Room ${targetRoom.id} is full, rejecting ${playerName}`);
        socket.emit('errorMessage', 'Room is full');
        return;
      }

      const player = {
        socketId: socket.id,
        name: playerName,
        seat: assignedSeat,
        connected: true,
        hand: [],
        isConnected: true
      };

      targetRoom.addPlayer(player, assignedSeat);
      socket.join(targetRoom.id);

      console.log(`✅ ${playerName} joined room ${targetRoom.id} as seat ${assignedSeat}`);

      socket.emit('roomJoined', {
        roomId: targetRoom.id,
        seat: assignedSeat,
        playerName: playerName,
        gameRules: 'dominican-correct',
        turnOrder: 'counter-clockwise'
      });

      io.to(targetRoom.id).emit('lobbyUpdate', {
        players: targetRoom.getPlayerList(),
        gameRules: 'dominican-correct',
        turnOrder: 'counter-clockwise'
      });

      // Auto-start when full
      if (targetRoom.isFull()) {
        console.log(`🎮 Room ${targetRoom.id} is full, starting game in 1 second...`);
        setTimeout(() => startDominicanGame(targetRoom), 1000);
      }

    } catch (error) {
      console.error('❌ Error in findRoom:', error);
      socket.emit('errorMessage', 'Failed to join room: ' + error.message);
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`📴 Client disconnected: ${socket.id} (${reason})`);
    
    for (const room of gameRooms.values()) {
      const player = room.findPlayerBySocket(socket.id);
      if (player) {
        player.connected = false;
        player.isConnected = false;
        
        io.to(room.id).emit('lobbyUpdate', {
          players: room.getPlayerList(),
          gameRules: 'dominican-correct'
        });
        
        console.log(`👋 ${player.name} disconnected from room ${room.id}`);
        break;
      }
    }
  });

  // Handle socket errors
  socket.on('error', (error) => {
    console.error(`⚠️  Socket error for ${socket.id}:`, error);
  });
});

// Basic game functions (simplified for connection testing)
function startDominicanGame(room) {
  console.log(`🎲 Starting Dominican game in room ${room.id}`);
  // Basic implementation - extend with full game logic
  room.isGameActive = true;
  io.to(room.id).emit('gameStarted', { message: 'Dominican game started!' });
}

// ────────────────────────────────────────────────────────────────────────
// Enhanced Server Startup with Better Error Handling
// ────────────────────────────────────────────────────────────────────────
server.listen(PORT, (error) => {
  if (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
  
  console.log('🎉 DOMINICAN DOMINO SERVER STARTED SUCCESSFULLY!');
  console.log('='.repeat(60));
  console.log(`🌐 Server running on port: ${PORT}`);
  console.log(`🔗 Local URL: http://localhost:${PORT}`);
  console.log(`🎮 Game Rules: Dominican (Corrected)`);
  console.log(`🎯 Turn Order: Counter-clockwise [0,3,2,1]`);
  console.log(`👤 User Seat: Always bottom (seat 0)`);
  console.log('='.repeat(60));
  console.log('✅ Server is ready for connections!');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    console.log('💡 Try these solutions:');
    console.log('   - Kill existing process: pkill -f node');
    console.log('   - Use different port: PORT=3001 node server.js');
    console.log('   - Check running processes: netstat -tlnp | grep :3000');
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Dominican Domino server...');
  server.close(() => {
    console.log('✅ Server shut down gracefully');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});