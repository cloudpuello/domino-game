/* =====================================================================
 * server/server.js — Dominican Domino Server
 *
 * IMPLEMENTS PROPER DOMINICAN RULES:
 * - Counter-clockwise turn order [0,3,2,1]
 * - First round must start with [6|6]
 * - Proper pass handling (no drawing)
 * - Capicú, Paso, and tranca scoring
 * - Right-hand block bonuses
 * =================================================================== */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Load game engine and constants
let GameEngine, GC;
try {
  GameEngine = require('../engine/game');
  GC = require('../shared/constants/gameConstants');
  console.log('✓ Dominican game engine loaded');
} catch (error) {
  console.error('✗ Failed to load game modules:', error.message);
  process.exit(1);
}

// ────────────────────────────────────────────────────────────────────────
// Server Setup
// ────────────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Static file serving
app.use(express.static(path.join(__dirname, '../public')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rules: 'dominican', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
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
    this.isFirstRound = true;
    this.lastWinnerSeat = null;
    
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
    this.gameState = GC.GAME_STATES.WAITING;
  }

  addPlayer(player, seat) {
    this.players[seat] = player;
    console.log(`[Dominican Room] Added ${player.name} to seat ${seat}`);
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

  findEmptySeat() {
    for (let i = 0; i < 4; i++) {
      if (!this.players[i]) return i;
    }
    return -1;
  }

  findPlayerBySocket(socketId) {
    return Object.values(this.players).find(p => p && p.socketId === socketId);
  }

  // Dominican turn order: counter-clockwise [0,3,2,1]
  nextTurn() {
    this.turn = GC.nextSeat(this.turn);
    this.passCount = 0; // Reset pass count when turn advances normally
  }
}

// ────────────────────────────────────────────────────────────────────────
// Socket.IO Connection Handler
// ────────────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Dominican Server] New connection: ${socket.id}`);

  // Handle room finding/joining
  socket.on('findRoom', ({ playerName, roomId, reconnectSeat }) => {
    console.log(`[Dominican Server] ${playerName} looking for room...`);
    
    try {
      let targetRoom = null;
      
      // Try reconnection or find/create room
      if (roomId && gameRooms.has(roomId)) {
        targetRoom = gameRooms.get(roomId);
      } else {
        targetRoom = [...gameRooms.values()].find(room => 
          !room.isGameActive && room.getConnectedCount() < 4
        );
        
        if (!targetRoom) {
          const newRoomId = 'dominican_' + Date.now();
          targetRoom = new DominicanGameRoom(newRoomId);
          gameRooms.set(newRoomId, targetRoom);
          console.log(`[Dominican Server] Created room: ${newRoomId}`);
        }
      }

      const assignedSeat = reconnectSeat ?? targetRoom.findEmptySeat();
      if (assignedSeat === -1) {
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

      socket.emit('roomJoined', {
        roomId: targetRoom.id,
        seat: assignedSeat,
        playerName: playerName,
        gameRules: 'dominican'
      });

      io.to(targetRoom.id).emit('lobbyUpdate', {
        players: targetRoom.getPlayerList(),
        gameRules: 'dominican'
      });

      console.log(`[Dominican Server] ${playerName} joined room ${targetRoom.id} as seat ${assignedSeat}`);

      // Auto-start when full
      if (targetRoom.isFull()) {
        setTimeout(() => startDominicanGame(targetRoom), 1000);
      }

    } catch (error) {
      console.error('[Dominican Server] Error in findRoom:', error);
      socket.emit('errorMessage', 'Failed to join room');
    }
  });

  // Handle Dominican tile play
  socket.on('playTile', ({ roomId, seat, tile, side }) => {
    console.log(`[Dominican Server] Player ${seat} attempting to play [${tile}] on ${side}`);
    
    try {
      const room = gameRooms.get(roomId);
      if (!room || !room.isGameActive) {
        socket.emit('errorMessage', 'Game not active');
        return;
      }

      // CRITICAL: Verify it's actually this player's turn
      if (room.turn !== seat) {
        console.log(`[Dominican Server] Not player ${seat}'s turn (current turn: ${room.turn})`);
        socket.emit('errorMessage', `Not your turn. Current turn: ${room.turn}`);
        return;
      }

      const player = room.players[seat];
      if (!player || !player.hand) {
        socket.emit('errorMessage', 'Player not found or no hand');
        return;
      }

      // Validate tile in hand
      const tileIndex = player.hand.findIndex(t => 
        t[0] === tile[0] && t[1] === tile[1]
      );
      
      if (tileIndex === -1) {
        console.log(`[Dominican Server] Tile [${tile}] not in player ${seat}'s hand:`, player.hand);
        socket.emit('errorMessage', 'Tile not in your hand');
        return;
      }

      // FIRST MOVE VALIDATION: First round must be [6|6]
      if (room.board.length === 0) {
        console.log(`[Dominican Server] First move validation. Is first round: ${room.isFirstRound}`);
        
        if (room.isFirstRound) {
          if (tile[0] !== 6 || tile[1] !== 6) {
            console.log(`[Dominican Server] First round requires [6|6], got [${tile}]`);
            socket.emit('errorMessage', 'First round must start with [6|6]');
            return;
          }
          
          // CRITICAL: Double-check that this player should actually have [6|6]
          const actuallyHasDoubleSix = player.hand.some(t => t[0] === 6 && t[1] === 6);
          if (!actuallyHasDoubleSix) {
            console.error(`[Dominican Server] CRITICAL ERROR: Player ${seat} trying to play [6|6] but doesn't have it!`);
            console.error(`[Dominican Server] Player ${seat} hand:`, player.hand);
            socket.emit('errorMessage', 'Server error: You don\'t actually have [6|6]');
            return;
          }
          
          console.log(`[Dominican Server] ✓ Valid first move: [6|6] by player ${seat}`);
        }
      }

      // Use Dominican game engine
      if (GameEngine.placeTile(room, tile, side)) {
        // Remove tile from hand
        player.hand.splice(tileIndex, 1);
        
        console.log(`[Dominican Server] ✓ Player ${seat} successfully played [${tile}]`);
        
        // Broadcast move
        GameEngine.emitBroadcastMove(io, room, seat, tile);
        
        // Check if round ended
        const roundResult = GameEngine.checkRoundEnd(room);
        
        if (roundResult.ended) {
          endDominicanRound(room, roundResult);
        } else {
          // Advance turn in Dominican counter-clockwise order
          room.nextTurn();
          io.to(roomId).emit('turnChanged', room.turn);
          console.log(`[Dominican Server] Turn advanced to seat ${room.turn}`);
        }

      } else {
        socket.emit('errorMessage', 'Invalid tile placement');
      }

    } catch (error) {
      console.error('[Dominican Server] Error in playTile:', error);
      socket.emit('errorMessage', 'Failed to play tile');
    }
  });

  // Handle Dominican pass (no drawing)
  socket.on('passPlay', ({ roomId, seat }) => {
    console.log(`[Dominican Server] Player ${seat} passing (Dominican rules)`);
    
    try {
      const room = gameRooms.get(roomId);
      if (!room || !room.isGameActive || room.turn !== seat) {
        socket.emit('errorMessage', 'Invalid pass attempt');
        return;
      }

      // Handle pass with Dominican rules
      const passResult = GameEngine.handlePass(room, seat);
      
      // Notify all players of pass
      io.to(roomId).emit('playerPassed', { 
        seat,
        passCount: room.passCount,
        gameRules: 'dominican'
      });
      
      if (passResult.tranca) {
        // Tranca detected - blocked board
        console.log(`[Dominican Server] Tranca detected in room ${roomId}`);
        
        const roundResult = GameEngine.checkRoundEnd(room);
        endDominicanRound(room, roundResult);
      } else {
        // Continue game - advance turn
        room.nextTurn();
        io.to(roomId).emit('turnChanged', room.turn);
        console.log(`[Dominican Server] Pass processed, turn advanced to seat ${room.turn}`);
      }

    } catch (error) {
      console.error('[Dominican Server] Error in passPlay:', error);
      socket.emit('errorMessage', 'Failed to pass');
    }
  });

  // Handle start game
  socket.on('startGame', ({ roomId }) => {
    const room = gameRooms.get(roomId);
    if (room && room.isFull()) {
      startDominicanGame(room);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`[Dominican Server] Player disconnected: ${socket.id}`);
    
    for (const room of gameRooms.values()) {
      const player = room.findPlayerBySocket(socket.id);
      if (player) {
        player.connected = false;
        player.isConnected = false;
        
        io.to(room.id).emit('lobbyUpdate', {
          players: room.getPlayerList(),
          gameRules: 'dominican'
        });
        
        console.log(`[Dominican Server] ${player.name} disconnected from room ${room.id}`);
        break;
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
// Dominican Game Lifecycle
// ────────────────────────────────────────────────────────────────────────

function startDominicanGame(room) {
  try {
    if (!room.isFull()) return;

    console.log(`[Dominican Server] Starting Dominican game in room ${room.id}`);
    console.log(`[Dominican Server] Is first round: ${room.isFirstRound}`);
    
    room.isGameActive = true;
    room.gameState = GC.GAME_STATES.ACTIVE;
    
    // Initialize round with Dominican rules
    GameEngine.initNewRound(room, io);
    
    console.log(`[Dominican Server] Dominican game started in room ${room.id}`);
    console.log(`[Dominican Server] Current turn: ${room.turn}`);

  } catch (error) {
    console.error('[Dominican Server] Error starting game:', error);
    io.to(room.id).emit('errorMessage', 'Failed to start Dominican game');
  }
}

function endDominicanRound(room, roundResult) {
  try {
    console.log(`[Dominican Server] Dominican round ended:`, roundResult);
    
    room.isGameActive = false;
    room.gameState = GC.GAME_STATES.ROUND_ENDED;
    room.lastWinnerSeat = roundResult.winner;
    
    // Award points to winning team
    const winningTeam = GC.TEAM_OF_SEAT(roundResult.winner);
    room.scores[winningTeam] += roundResult.points;
    
    console.log(`[Dominican Server] Team ${winningTeam} gets ${roundResult.points} points`);
    console.log(`[Dominican Server] Score: Team 0: ${room.scores[0]}, Team 1: ${room.scores[1]}`);
    
    // Create final hand sizes
    const finalHandSizes = {};
    Object.values(room.players).forEach(p => {
      if (p) finalHandSizes[p.seat] = p.hand ? p.hand.length : 0;
    });
    
    // Emit round ended
    io.to(room.id).emit('roundEnded', {
      winner: roundResult.winner,
      reason: roundResult.reason,
      points: roundResult.points,
      scores: [...room.scores],
      boardState: [...room.board],
      finalHandSizes,
      details: roundResult.details,
      gameRules: 'dominican'
    });
    
    // Check for game over
    if (room.scores[winningTeam] >= GC.WINNING_SCORE) {
      setTimeout(() => {
        room.gameState = GC.GAME_STATES.GAME_OVER;
        
        io.to(room.id).emit('gameOver', {
          winningTeam,
          scores: [...room.scores],
          gameRules: 'dominican'
        });
        
        gameRooms.delete(room.id);
        console.log(`[Dominican Server] Dominican game over - Team ${winningTeam} wins!`);
      }, 2000);
    } else {
      // Start new round
      setTimeout(() => {
        if (gameRooms.has(room.id)) {
          startDominicanGame(room);
        }
      }, 5000);
    }

  } catch (error) {
    console.error('[Dominican Server] Error ending round:', error);
    io.to(room.id).emit('errorMessage', 'Error ending Dominican round');
  }
}

// ────────────────────────────────────────────────────────────────────────
// Start Server
// ────────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('='.repeat(70));
  console.log(`🇩🇴 DOMINICAN DOMINO SERVER STARTED`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`🎮 Game Rules: Dominican (Counter-clockwise)`);
  console.log(`🎯 Turn Order: [0,3,2,1]`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log('='.repeat(70));
  
  console.log('📋 Dominican Rules Active:');
  console.log('   • First round: Must start with [6|6]');
  console.log('   • Subsequent rounds: Winner opens with any tile');
  console.log('   • Turn order: Counter-clockwise [0,3,2,1]');
  console.log('   • Scoring: Capicú (+30), Paso (+30), Tranca');
  console.log('   • No drawing - pass if cannot play');
  console.log('');
  console.log('🎮 Ready for Dominican Domino!');
}).on('error', (error) => {
  console.error('Failed to start Dominican server:', error);
  process.exit(1);
});