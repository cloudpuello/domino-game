/* =====================================================================
 * server.js — Dominican Domino Server (COMPLETELY FIXED)
 * 
 * FIXES APPLIED:
 * - Game only starts when exactly 4 players are connected and ready
 * - Better player state tracking
 * - Improved move validation
 * - Fixed board ends calculation
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
// Static Files
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
// ────────────────────────────────────────────────────────────────────────
const gameRooms = new Map();

// ────────────────────────────────────────────────────────────────────────
// Game Room Class - FIXED: Better player tracking
// ────────────────────────────────────────────────────────────────────────
class GameRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [null, null, null, null];
    this.gameState = null;
    this.scores = [0, 0];
    this.isGameActive = false;
    this.roundInProgress = false;
  }

  addPlayer(player, seat) {
    this.players[seat] = player;
    return true;
  }

  // FIXED: More strict full room check
  isFull() {
    return this.players.every(p => p !== null && p.connected);
  }

  // FIXED: Better connected player count
  getConnectedCount() {
    return this.players.filter(p => p !== null && p.connected).length;
  }

  getPlayerList() {
    return this.players
      .map((player, seat) => player ? {
        seat: seat,
        name: player.name,
        connected: player.connected
      } : null)
      .filter(p => p !== null);
  }

  // FIXED: Find empty seat more reliably
  findEmptySeat() {
    for (let seat = 0; seat < 4; seat++) {
      if (this.players[seat] === null) {
        return seat;
      }
    }
    return -1;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Domino Game State - FIXED: Better validation and board tracking
// ────────────────────────────────────────────────────────────────────────
class DominoGameState {
  constructor() {
    this.tiles = [];
    this.playerHands = [[], [], [], []];
    this.board = [];
    this.leftEnd = null;
    this.rightEnd = null;
    this.currentTurn = null;
    this.consecutivePasses = 0;
    this.isFirstMove = true;
  }

  initTiles() {
    this.tiles = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        this.tiles.push([i, j]);
      }
    }
    // Fisher-Yates shuffle
    for (let i = this.tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
    }
  }

  dealTiles() {
    this.initTiles();
    this.playerHands = [[], [], [], []];
    
    for (let seat = 0; seat < 4; seat++) {
      for (let i = 0; i < HAND_SIZE; i++) {
        if (this.tiles.length > 0) {
          this.playerHands[seat].push(this.tiles.pop());
        }
      }
    }
  }

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
    this.currentTurn = 0;
    return 0;
  }

  // FIXED: Proper board ends tracking
  getBoardEnds() {
    if (this.board.length === 0) {
      return { left: null, right: null };
    }
    return {
      left: this.leftEnd,
      right: this.rightEnd
    };
  }

  // FIXED: Better move validation
  isValidMove(seat, tile, side) {
    // Validate player has the tile
    const hasThisTile = this.playerHands[seat].some(
      t => t[0] === tile[0] && t[1] === tile[1]
    );
    if (!hasThisTile) return false;

    // First move must be double-six
    if (this.isFirstMove) {
      return tile[0] === 6 && tile[1] === 6;
    }

    const [a, b] = tile;
    const ends = this.getBoardEnds();

    if (side === 'left') {
      return a === ends.left || b === ends.left;
    } else if (side === 'right') {
      return a === ends.right || b === ends.right;
    }

    return false;
  }

  // FIXED: Proper tile placement with end tracking
  playTile(seat, tile, side) {
    if (!this.isValidMove(seat, tile, side)) {
      return false;
    }

    // Remove from hand
    const handIndex = this.playerHands[seat].findIndex(
      t => t[0] === tile[0] && t[1] === tile[1]
    );
    if (handIndex === -1) return false;
    
    this.playerHands[seat].splice(handIndex, 1);

    // Add to board
    if (this.isFirstMove) {
      // First move - place double-six
      this.board = [tile];
      this.leftEnd = tile[0];
      this.rightEnd = tile[1];
      this.isFirstMove = false;
    } else {
      const [a, b] = tile;
      
      if (side === 'left') {
        if (a === this.leftEnd) {
          this.board.unshift([b, a]);
          this.leftEnd = b;
        } else {
          this.board.unshift([a, b]);
          this.leftEnd = a;
        }
      } else {
        if (a === this.rightEnd) {
          this.board.push([a, b]);
          this.rightEnd = b;
        } else {
          this.board.push([b, a]);
          this.rightEnd = a;
        }
      }
    }

    this.consecutivePasses = 0;
    this.advanceTurn();
    return true;
  }

  advanceTurn() {
    this.currentTurn = (this.currentTurn + 1) % 4;
  }

  // Handle player pass
  playerPass() {
    this.consecutivePasses++;
    this.advanceTurn();
  }

  checkRoundEnd() {
    // Check for domino (empty hand)
    for (let seat = 0; seat < 4; seat++) {
      if (this.playerHands[seat].length === 0) {
        return { ended: true, winner: seat, reason: 'domino' };
      }
    }

    // Check for blocked game
    if (this.consecutivePasses >= 4) {
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

  socket.on('findRoom', ({ playerName, roomId, reconnectSeat }) => {
    // Try to reconnect
    if (roomId && reconnectSeat !== null) {
      const room = gameRooms.get(roomId);
      if (room && room.players[reconnectSeat] && room.players[reconnectSeat].name === playerName) {
        room.players[reconnectSeat].socket = socket;
        room.players[reconnectSeat].connected = true;
        
        socket.join(roomId);
        socket.emit('roomJoined', { roomId, seat: parseInt(reconnectSeat) });
        
        if (room.isGameActive && room.gameState) {
          socket.emit('roundStart', {
            yourHand: room.gameState.playerHands[reconnectSeat],
            startingSeat: room.gameState.currentTurn,
            scores: room.scores
          });
          
          socket.emit('broadcastMove', {
            seat: -1,
            tile: null,
            board: room.gameState.board,
            leftEnd: room.gameState.leftEnd,
            rightEnd: room.gameState.rightEnd
          });
        }
        
        io.to(roomId).emit('lobbyUpdate', { players: room.getPlayerList() });
        
        // FIXED: Check if we can start game after reconnection
        if (!room.isGameActive && room.isFull()) {
          console.log('Starting game after reconnection');
          startGame(room);
        }
        
        return;
      }
    }

    // Find room with space
    let targetRoom = null;
    let assignedSeat = null;

    for (const [id, room] of gameRooms) {
      if (!room.isGameActive && room.getConnectedCount() < 4) {
        const emptySeat = room.findEmptySeat();
        if (emptySeat !== -1) {
          targetRoom = room;
          assignedSeat = emptySeat;
          break;
        }
      }
    }

    // Create new room if needed
    if (!targetRoom) {
      const newRoomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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

    socket.emit('roomJoined', { 
      roomId: targetRoom.roomId, 
      seat: assignedSeat 
    });

    io.to(targetRoom.roomId).emit('lobbyUpdate', { 
      players: targetRoom.getPlayerList() 
    });

    console.log(`Player ${playerName} joined room ${targetRoom.roomId} as seat ${assignedSeat}`);
    console.log(`Room now has ${targetRoom.getConnectedCount()}/4 players`);

    // FIXED: Only start when exactly 4 players are connected
    if (targetRoom.isFull() && !targetRoom.isGameActive) {
      console.log('Room is full, starting game...');
      setTimeout(() => startGame(targetRoom), 1000); // Small delay for UI
    }
  });

  socket.on('playTile', ({ roomId, seat, tile, side }) => {
    const room = gameRooms.get(roomId);
    if (!room || !room.isGameActive || !room.gameState) {
      socket.emit('errorMessage', 'Game not active');
      return;
    }

    if (room.gameState.currentTurn !== seat) {
      socket.emit('errorMessage', 'Not your turn!');
      return;
    }

    if (!room.gameState.isValidMove(seat, tile, side)) {
      socket.emit('errorMessage', 'Invalid move!');
      return;
    }

    if (room.gameState.playTile(seat, tile, side)) {
      // Broadcast move
      io.to(roomId).emit('broadcastMove', {
        seat: seat,
        tile: tile,
        board: room.gameState.board,
        leftEnd: room.gameState.leftEnd,
        rightEnd: room.gameState.rightEnd
      });

      // Update player's hand
      room.players[seat].socket.emit('updateHand', room.gameState.playerHands[seat]);

      // Check for round end
      const result = room.gameState.checkRoundEnd();
      if (result.ended) {
        endRound(room, result);
      } else {
        io.to(roomId).emit('turnChanged', room.gameState.currentTurn);
      }
    }
  });

  socket.on('passPlay', ({ roomId, seat }) => {
    const room = gameRooms.get(roomId);
    if (!room || !room.isGameActive || !room.gameState) return;

    if (room.gameState.currentTurn !== seat) {
      socket.emit('errorMessage', 'Not your turn!');
      return;
    }

    room.gameState.playerPass();
    
    io.to(roomId).emit('playerPassed', { seat });
    
    const result = room.gameState.checkRoundEnd();
    if (result.ended) {
      endRound(room, result);
    } else {
      io.to(roomId).emit('turnChanged', room.gameState.currentTurn);
    }
  });

  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    
    for (const [roomId, room] of gameRooms) {
      for (let seat = 0; seat < 4; seat++) {
        if (room.players[seat] && room.players[seat].socket === socket) {
          room.players[seat].connected = false;
          io.to(roomId).emit('lobbyUpdate', { 
            players: room.getPlayerList() 
          });
          
          // If game was waiting for players, clean up empty rooms
          if (!room.isGameActive && room.getConnectedCount() === 0) {
            gameRooms.delete(roomId);
          }
          return;
        }
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
// Game Functions - FIXED
// ────────────────────────────────────────────────────────────────────────
function startGame(room) {
  if (!room.isFull()) {
    console.log('Cannot start game - not enough players');
    return;
  }

  console.log(`Starting game in room ${room.roomId}`);
  
  room.isGameActive = true;
  room.roundInProgress = true;
  room.gameState = new DominoGameState();
  
  room.gameState.dealTiles();
  const startingSeat = room.gameState.findStartingPlayer();
  
  console.log(`Starting player: seat ${startingSeat}`);
  
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

  // Send turn change
  io.to(room.roomId).emit('turnChanged', startingSeat);
}

function endRound(room, result) {
  const points = room.gameState.calculatePoints();
  const winningTeam = result.winner % 2;
  
  room.scores[winningTeam] += points;
  room.roundInProgress = false;
  
  io.to(room.roomId).emit('roundEnded', {
    winner: result.winner,
    reason: result.reason,
    points: points,
    scores: room.scores,
    board: room.gameState.board
  });
  
  if (room.scores[0] >= WINNING_SCORE || room.scores[1] >= WINNING_SCORE) {
    const winningTeam = room.scores[0] >= WINNING_SCORE ? 0 : 1;
    io.to(room.roomId).emit('gameOver', {
      winningTeam: winningTeam,
      scores: room.scores
    });
    
    setTimeout(() => {
      gameRooms.delete(room.roomId);
    }, 30000);
  } else {
    setTimeout(() => {
      if (room.isFull()) {
        startGame(room);
      }
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