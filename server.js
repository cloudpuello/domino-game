/* ===== server.js  ======================================================= */
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static('public'));
const PORT = 3000;

/* ───────── game-room helper ───────── */

function initGameRoom(roomId) {
  gameRooms[roomId] = {
    players: {},          // seat → { socketId, hand, name }
    started: false,
    board: [],            // ordered tiles (left → right)
    leftEnd: null,        // open number on left
    rightEnd: null,       // open number on right
    turn: null,
    passes: 0
  };
}

function createDominoSet() {
  const tiles = [];
  for (let i = 0; i <= 6; i++)
    for (let j = i; j <= 6; j++) tiles.push([i, j]);
  for (let i = tiles.length - 1; i; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

function nextSeat(cur) { return (cur + 1) % 4; }

/* placeTile: returns true if legal & placed */
function placeTile(room, tile, sideHint = null) {
  const [a, b] = tile;

  // decide side automatically if no hint given
  let side = sideHint;
  if (!side) {
    if (a === room.rightEnd || b === room.rightEnd) side = 'right';
    else side = 'left';
  }

  if (side === 'left') {
    if (a === room.leftEnd) {
      room.board.unshift(tile);
      room.leftEnd = b;
    } else if (b === room.leftEnd) {
      room.board.unshift([b, a]);
      room.leftEnd = a;
    } else return false;
  } else { // right
    if (a === room.rightEnd) {
      room.board.push(tile);
      room.rightEnd = b;
    } else if (b === room.rightEnd) {
      room.board.push([b, a]);
      room.rightEnd = a;
    } else return false;
  }
  return true;
}

/* ───────── server state ───────── */

const gameRooms = {};

/* ───────── socket.io ───────── */

io.on('connection', socket => {
  console.log('● connected', socket.id);

  /* join room */
  socket.on('joinRoom', ({ roomId, playerName }) => {
    socket.join(roomId);
    if (!gameRooms[roomId]) initGameRoom(roomId);
    const room = gameRooms[roomId];

    const seat = [0,1,2,3].find(s => !room.players[s]);
    if (seat === undefined) { socket.emit('errorMessage','Room full'); return; }

    room.players[seat] = { socketId: socket.id, hand: [], name: playerName||`P${seat}` };
    socket.emit('roomJoined', { seat });

    io.in(roomId).emit('lobbyUpdate', {
      players: Object.entries(room.players).map(([s,p])=>({ seat:+s, name:p.name })),
      seatsRemaining: 4 - Object.keys(room.players).length
    });

    /* start when 4 players present */
    if (Object.keys(room.players).length === 4) {
      room.started = true;
      const deck = createDominoSet();
      for (const s in room.players) room.players[s].hand = deck.splice(0,7);

      let starter = 0;
      for (const s in room.players)
        if (room.players[s].hand.some(t=>t[0]===6&&t[1]===6)) { starter = +s; break; }
      room.turn = starter;

      for (const s in room.players)
        io.to(room.players[s].socketId).emit('gameStart',{
          yourHand: room.players[s].hand,
          startingSeat: starter
        });

      io.in(roomId).emit('turnChanged', starter);
    }
  });

  /* play tile */
  socket.on('playTile', ({ roomId, seat, tile, side }) => {
    const room = gameRooms[roomId];
    if (!room || !room.started) return;
    if (room.turn !== seat) { socket.emit('errorMessage','Not your turn'); return; }

    /* first tile must be double-six */
    if (room.board.length === 0) {
      if (!(tile[0]===6 && tile[1]===6)) {
        socket.emit('errorMessage','First tile must be [6|6]'); return;
      }
      room.board.push([6,6]);
      room.leftEnd = room.rightEnd = 6;
    } else {
      if (!placeTile(room, tile, side)) {
        socket.emit('errorMessage','Tile does not fit on that side'); return;
      }
    }

    /* remove from hand */
    const player = room.players[seat];
    player.hand = player.hand.filter(t=>!(t[0]===tile[0]&&t[1]===tile[1]));
    room.passes = 0;

    /* win? */
    if (player.hand.length === 0) {
      io.in(roomId).emit('roundEnded',{ winner: seat, board: room.board });
      return;
    }

    /* advance turn */
    room.turn = nextSeat(room.turn);
    io.in(roomId).emit('broadcastMove',{ seat, tile, side, board: room.board });
    io.in(roomId).emit('turnChanged', room.turn);
  });

  /* pass */
  socket.on('passTurn', ({ roomId, seat }) => {
    const room = gameRooms[roomId];
    if (!room || !room.started) return;
    if (room.turn !== seat) { socket.emit('errorMessage','Not your turn'); return; }

    room.passes += 1;
    if (room.passes >= 4) {
      io.in(roomId).emit('roundEnded',{ winner:null, reason:'Tranca', board:room.board });
      return;
    }
    room.turn = nextSeat(room.turn);
    io.in(roomId).emit('playerPassed', seat);
    io.in(roomId).emit('turnChanged', room.turn);
  });

  /* disconnect cleanup */
  socket.on('disconnect', () => {
    console.log('○ disconnected', socket.id);
    for (const roomId in gameRooms) {
      const room = gameRooms[roomId];
      for (const s in room.players)
        if (room.players[s].socketId === socket.id) delete room.players[s];
      if (Object.keys(room.players).length === 0) delete gameRooms[roomId];
    }
  });
});

/* start server */
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
/* ======================================================================= */
