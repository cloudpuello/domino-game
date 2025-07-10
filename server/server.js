/* =====================================================================
 * server.js — Dominican Domino Server
 * 
 * AI DEVELOPMENT NOTES:
 * - This server handles 4-player domino games with team scoring
 * - Players sit in seats 0-3, with 0&2 vs 1&3 as teams
 * - First to 200 points wins
 * - Uses Socket.IO for real-time communication
 * - All game state is stored in memory (add database for persistence)
 * =================================================================== */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// ────────────────────────────────────────────────────────────────────────
// Server Setup
// ────────────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

// ────────────────────────────────────────────────────────────────────────
// Static Files - IMPORTANT: This serves your game files
// ────────────────────────────────────────────────────────────────────────
app.use(express.static('public'));
app.use('/shared', express.static(path.join(__dirname, 'shared')));

// ────────────────────────────────────────────────────────────────────────
// Game Constants
// ────────────────────────────────────────────────────────────────────────
const HAND_SIZE = 7;
const WINNING_SCORE = 200;
const OPENING_TILE = [6, 6];

// ────────────────────────────────────────────────────────────────────────
// Game State Storage
// AI NOTE: In production, use Redis or a database instead
// ────────────────────────────────────────────────────────────────────────
const gameRooms = new Map(); // roomId -> GameRoom object

// ────────────────────────────────────────────────────────────────────────
// Game Room Class - Manages a single game
// ────────────────────────────────────────────────────────────────────────
class GameRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [null, null, null, null]; // 4 seats
    this.gameState = null;
    this.scores = [0, 0]; // Team scores
    this.isGameActive = false;
  }

  // Add a player to the room
  addPlayer(player, seat) {
    this.players[seat] = player;
    return true;
  }

  // Check if room is full
  isFull() {
    return this.players.every(p => p !== null);
  }

  // Get connected players
  getPlayerList() {
    return this.players
      .map((player, seat) => player ? {
        seat: seat,
        name: player.name,
        connected: player.connected
      } : null)
      .filter(p => p !== null);
  }
}

// ────────────────────────────────────────────────────────────────────────
// Domino Game State - Handles game logic
// ────────────────────────────────────────────────────────────────────────
class DominoGameState {
  constructor() {
    this.tiles = [];
    this.playerHands = [[], [], [], []];
    this.board = [];
    this.currentTurn = null;
    this.consecutivePasses = 0;
  }

  // Initialize and shuffle tiles
  initTiles() {
    this.tiles = [];
    // Create all 28 dominoes
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        this.tiles.push([i, j]);
      }
    }
    // Shuffle
    for (let i = this.tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
    }
  }

  // Deal tiles to players
  dealTiles() {
    this.initTiles();
    // Deal 7 tiles to each player
    for (let seat = 0; seat < 4; seat++) {
      for (let i = 0; i < HAND_SIZE; i++) {
        this.playerHands[seat].push(this.tiles.pop());
      }
    }
  }

  // Find who has double-six
  findStartingPlayer() {
    for (let seat = 0; seat < 4; seat++) {
      const hasDoubleSix = this.playerHands[seat].some(
        tile => tile[0] === 6 && tile[1] === 6
      );
      if (hasDoubleSix) {
        this.currentTurn = seat;
        return seat;
      }
    }
    // Fallback - shouldn't happen with full deck
    this.currentTurn = 0;
    return 0;
  }

  // Get board ends for matching
  getBoardEnds() {
    if (this.board.length === 0) return null;
    return {
      left: this.board[0][0],
      right: this.board[this.board.length - 1][1]
    };
  }

  // Check if a move is valid
  isValidMove(tile, side) {
    // First move must be double-six
    if (this.board.length === 0) {
      return tile[0] === 6 && tile[1] === 6;
    }

    const ends = this.getBoardEnds();
    const [a, b] = tile;

    if (side === 'left') {
      return a === ends.left || b === ends.left;
    } else {
      return a === ends.right || b === ends.right;
    }
  }

  // Play a tile
  playTile(seat, tile, side) {
    // Remove from hand
    const handIndex = this.playerHands[seat].findIndex(
      t => t[0] === tile[0] && t[1] === tile[1]
    );
    if (handIndex === -1) return false;
    
    this.playerHands[seat].splice(handIndex, 1);

    // Add to board
    if (this.board.length === 0) {
      this.board.push(tile);
    } else {
      const ends = this.getBoardEnds();
      let orientedTile = [...tile];

      if (side === 'left') {
        // Make sure tile connects properly
        if (orientedTile[1] !== ends.left) {
          orientedTile.reverse();
        }
        this.board.unshift(orientedTile);
      } else {
        // Make sure tile connects properly
        if (orientedTile[0] !== ends.right) {
          orientedTile.reverse();
        }
        this.board.push(orientedTile);
      }
    }

    this.consecutivePasses = 0;
    this.advanceTurn();
    return true;
  }

  // Move to next player
  advanceTurn() {
    this.currentTurn = (this.currentTurn + 1) % 4;
  }

  // Check if round is over
  checkRoundEnd() {
    // Check for domino (empty hand)
    for (let seat = 0; seat < 4; seat++) {
      if (this.playerHands[seat].length === 0) {
        return { ended: true, winner: seat, reason: 'domino' };
      }
    }

    // Check for blocked game (all passed)
    if (this.consecutivePasses >= 4) {
      // Find winner by lowest pip count
      let lowestSum = Infinity;
      let winner = -1;
      
      for (let seat = 0; seat < 4; seat++) {
        const sum = this.playerHands[seat].reduce((total, tile) => {
          return total + tile[0] + tile[1];
        }, 0);
        if (sum < lowestSum) {
          lowestSum = sum;
          winner = seat;
        }
      }
      
      return { ended: true, winner: winner, reason: 'blocked' };
    }

    return { ended: false };
  }

  // Calculate points for the round
  calculatePoints() {
    let points = 0;
    for (let seat = 0; seat < 4; seat++) {
      for (const tile of this.playerHands[seat]) {
        points += tile[0] + tile[1];
      }
    }
    return points;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Socket.IO Connection Handler
// ────────────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // ──────────────────────────────────────────────────────────────────────
  // Find or Create Room
  // ──────────────────────────────────────────────────────────────────────
  socket.on('findRoom', ({ playerName, roomId, reconnectSeat }) => {
    // Try to reconnect to existing room
    if (roomId && reconnectSeat !== null) {
      const room = gameRooms.get(roomId);
      if (room && room.players[reconnectSeat]) {
        // Reconnect player
        room.players[reconnectSeat].socket = socket;
        room.players[reconnectSeat].connected = true;
        
        socket.join(roomId);
        socket.emit('roomJoined', { roomId, seat: parseInt(reconnectSeat) });
        
        // Send current game state if active
        if (room.isGameActive && room.gameState) {
          socket.emit('roundStart', {
            yourHand: room.gameState.playerHands[reconnectSeat],
            startingSeat: room.gameState.currentTurn,
            scores: room.scores
          });
          
          // Send board state
          socket.emit('broadcastMove', {
            seat: -1,
            tile: null,
            board: room.gameState.board
          });
        }
        
        io.to(roomId).emit('lobbyUpdate', { players: room.getPlayerList() });
        return;
      }
    }

    // Find room with space or create new one
    let targetRoom = null;
    let assignedSeat = null;

    // Look for existing room with space
    for (const [id, room] of gameRooms) {
      if (!room.isGameActive) {
        for (let seat = 0; seat < 4; seat++) {
          if (room.players[seat] === null) {
            targetRoom = room;
            assignedSeat = seat;
            break;
          }
        }
        if (targetRoom) break;
      }
    }

    // Create new room if needed
    if (!targetRoom) {
      const newRoomId = 'room_' + Date.now();
      targetRoom = new GameRoom(newRoomId);
      gameRooms.set(newRoomId, targetRoom);
      assignedSeat = 0;
    }

    // Add player
    const player = {
      socket: socket,
      name: playerName,
      seat: assignedSeat,
      connected: true
    };

    targetRoom.addPlayer(player, assignedSeat);
    socket.join(targetRoom.roomId);

    // Send room info
    socket.emit('roomJoined', { 
      roomId: targetRoom.roomId, 
      seat: assignedSeat 
    });

    // Update all players in room
    io.to(targetRoom.roomId).emit('lobbyUpdate', { 
      players: targetRoom.getPlayerList() 
    });

    // Start game if room is full
    if (targetRoom.isFull() && !targetRoom.isGameActive) {
      startGame(targetRoom);
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // Play Tile
  // ──────────────────────────────────────────────────────────────────────
  socket.on('playTile', ({ roomId, seat, tile, side }) => {
    const room = gameRooms.get(roomId);
    if (!room || !room.isGameActive) return;

    // Validate turn
    if (room.gameState.currentTurn !== seat) {
      socket.emit('errorMessage', 'Not your turn!');
      return;
    }

    // Validate move
    if (!room.gameState.isValidMove(tile, side)) {
      socket.emit('errorMessage', 'Invalid move!');
      return;
    }

    // Make move
    if (room.gameState.playTile(seat, tile, side)) {
      // Broadcast to all players
      io.to(roomId).emit('broadcastMove', {
        seat: seat,
        tile: tile,
        board: room.gameState.board
      });

      // Update player's hand
      socket.emit('updateHand', room.gameState.playerHands[seat]);

      // Check for round end
      const result = room.gameState.checkRoundEnd();
      if (result.ended) {
        endRound(room, result);
      } else {
        // Continue game
        io.to(roomId).emit('turnChanged', room.gameState.currentTurn);
      }
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // Handle Disconnect
  // ──────────────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    
    // Find and mark player as disconnected
    for (const [roomId, room] of gameRooms) {
      for (let seat = 0; seat < 4; seat++) {
        if (room.players[seat] && room.players[seat].socket === socket) {
          room.players[seat].connected = false;
          io.to(roomId).emit('lobbyUpdate', { 
            players: room.getPlayerList() 
          });
          return;
        }
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
// Game Functions
// ────────────────────────────────────────────────────────────────────────
function startGame(room) {
  room.isGameActive = true;
  room.gameState = new DominoGameState();
  
  // Deal tiles
  room.gameState.dealTiles();
  
  // Find starting player
  const startingSeat = room.gameState.findStartingPlayer();
  
  // Send game start to all players
  for (let seat = 0; seat < 4; seat++) {
    const player = room.players[seat];
    if (player && player.connected) {
      player.socket.emit('roundStart', {
        yourHand: room.gameState.playerHands[seat],
        startingSeat: startingSeat,
        scores: room.scores
      });
    }
  }
}

function endRound(room, result) {
  const points = room.gameState.calculatePoints();
  const winningTeam = result.winner % 2;
  
  // Update scores
  room.scores[winningTeam] += points;
  
  // Notify players
  io.to(room.roomId).emit('roundEnded', {
    winner: result.winner,
    reason: result.reason,
    points: points,
    scores: room.scores,
    board: room.gameState.board
  });
  
  // Check for game over
  if (room.scores[0] >= WINNING_SCORE || room.scores[1] >= WINNING_SCORE) {
    const winningTeam = room.scores[0] >= WINNING_SCORE ? 0 : 1;
    io.to(room.roomId).emit('gameOver', {
      winningTeam: winningTeam,
      scores: room.scores
    });
    
    // Clean up room after delay
    setTimeout(() => {
      gameRooms.delete(room.roomId);
    }, 30000);
  } else {
    // Start new round after delay
    setTimeout(() => {
      startGame(room);
    }, 5000);
  }
}

// ────────────────────────────────────────────────────────────────────────
// Start Server
// ────────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Dominican Domino server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in 4 browser windows to play!`);
});