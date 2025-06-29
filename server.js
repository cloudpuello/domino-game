const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
const PORT = 3000;

// Store active game rooms
const gameRooms = {};

/**
 * Create and shuffle a double-six domino set
 */
function createDominoSet() {
  const tiles = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      tiles.push([i, j]);
    }
  }
  // Shuffle tiles
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

/**
 * Create a new game room
 */
function initGameRoom(roomId) {
  gameRooms[roomId] = {
    players: {},   // seat => { socketId, hand, name }
    started: false,
    board: [],
    turn: null,
    passes: 0
  };
}

/**
 * Get the next player's seat number
 */
function nextSeat(current) {
  return (current + 1) % 4;
}

/**
 * Handle Socket.IO connections
 */
io.on('connection', socket => {
  console.log(`● connected ${socket.id}`);

  /**
   * Player joins a room
   */
  socket.on('joinRoom', ({ roomId, playerName }) => {
    socket.join(roomId);

    if (!gameRooms[roomId]) initGameRoom(roomId);
    const room = gameRooms[roomId];

    // Find the first empty seat
    const seat = [0, 1, 2, 3].find(s => !room.players[s]);
    if (seat === undefined) {
      socket.emit('errorMessage', 'Room is full');
      return;
    }

    room.players[seat] = {
      socketId: socket.id,
      hand: [],
      name: playerName || `Player${seat}`
    };

    socket.emit('roomJoined', { seat });

    // Broadcast updated lobby info
    io.in(roomId).emit('lobbyUpdate', {
      players: Object.entries(room.players).map(([s, p]) => ({
        seat: Number(s),
        name: p.name
      })),
      seatsRemaining: 4 - Object.keys(room.players).length
    });

    // If all 4 players joined, start the game
    if (Object.keys(room.players).length === 4) {
      room.started = true;
      const deck = createDominoSet();

      for (const s in room.players) {
        room.players[s].hand = deck.splice(0, 7);
      }

      // First player with [6|6] starts
      let startingSeat = 0;
      for (const s in room.players) {
        if (room.players[s].hand.some(t => t[0] === 6 && t[1] === 6)) {
          startingSeat = Number(s);
          break;
        }
      }
      room.turn = startingSeat;

      // Send each player their hand
      for (const s in room.players) {
        const player = room.players[s];
        io.to(player.socketId).emit('gameStart', {
          yourHand: player.hand,
          startingSeat
        });
      }

      io.in(roomId).emit('turnChanged', startingSeat);
    }
  });

  /**
   * Player plays a tile
   */
  socket.on('playTile', ({ roomId, seat, tile }) => {
    const room = gameRooms[roomId];
    if (!room || !room.started) return;

    if (room.turn !== seat) {
      socket.emit('errorMessage', 'Not your turn');
      return;
    }

    // Validate first tile
    if (room.board.length === 0) {
      if (!(tile[0] === 6 && tile[1] === 6)) {
        socket.emit('errorMessage', 'First tile must be [6|6]');
        return;
      }
      room.board.push(tile);
    } else {
      const L = room.board[0][0];
      const R = room.board[room.board.length - 1][1];

      if (!(tile[0] === L || tile[1] === L || tile[0] === R || tile[1] === R)) {
        socket.emit('errorMessage', 'Invalid move');
        return;
      }

      // Append to the appropriate end
      const [a, b] = tile;
      if (b === L) room.board.unshift([b, a]);
      else if (a === L) room.board.unshift(tile);
      else if (a === R) room.board.push(tile);
      else if (b === R) room.board.push([b, a]);
    }

    // Remove tile from player's hand
    const player = room.players[seat];
    player.hand = player.hand.filter(t => !(t[0] === tile[0] && t[1] === tile[1]));
    room.passes = 0;

    // If player won
    if (player.hand.length === 0) {
      io.in(roomId).emit('roundEnded', {
        winner: seat,
        board: room.board
      });
      return;
    }

    // Next player's turn
    room.turn = nextSeat(room.turn);
    io.in(roomId).emit('broadcastMove', {
      seat,
      tile,
      board: room.board
    });
    io.in(roomId).emit('turnChanged', room.turn);
  });

  /**
   * Player passes turn
   */
  socket.on('passTurn', ({ roomId, seat }) => {
    const room = gameRooms[roomId];
    if (!room || !room.started) return;

    if (room.turn !== seat) {
      socket.emit('errorMessage', 'Not your turn');
      return;
    }

    room.passes += 1;

    if (room.passes >= 4) {
      io.in(roomId).emit('roundEnded', {
        winner: null,
        reason: 'Tranca',
        board: room.board
      });
      return;
    }

    room.turn = nextSeat(room.turn);
    io.in(roomId).emit('playerPassed', seat);
    io.in(roomId).emit('turnChanged', room.turn);
  });

  /**
   * Handle disconnects
   */
  socket.on('disconnect', () => {
    console.log(`○ disconnected ${socket.id}`);
    for (const roomId in gameRooms) {
      const room = gameRooms[roomId];
      for (const s in room.players) {
        if (room.players[s].socketId === socket.id) {
          delete room.players[s];
          console.log(`Seat ${s} in room ${roomId} freed.`);
        }
      }
      if (Object.keys(room.players).length === 0) {
        delete gameRooms[roomId];
        console.log(`Room ${roomId} deleted because it is now empty.`);
      }
    }
  });
});

/**
 * Start the server
 */
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

