/* =======================================================================
   server.js  – multiplayer domino server
   -----------------------------------------------------------------------
   Key points in this version
   • room.leftEnd  / room.rightEnd = current open pips
   • placeTile()   = single source of truth for move validation + flipping
   • Tiles added on the LEFT are flipped so the outer pip prints first.
   • Tiles added on the RIGHT are flipped if needed so outer pip prints last.
   ======================================================================= */

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static('public'));
const PORT = 3000;

/* ───────── in-memory state ───────── */
const gameRooms = {};

/* ───────── helpers ───────── */

function initGameRoom(roomId) {
  gameRooms[roomId] = {
    players  : {},   // seat -> { socketId, hand, name }
    started  : false,
    board    : [],   // ordered tiles, left → right
    leftEnd  : null,
    rightEnd : null,
    turn     : null,
    passes   : 0
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

const nextSeat = s => (s + 1) % 4;

/**
 * placeTile(room, tile [, sideHint])
 * ----------------------------------
 * • Validates that tile fits on chosen side.
 * • Flips when necessary so "outer pip faces outward".
 * • Updates room.board / room.leftEnd / room.rightEnd.
 * • Returns true if placed, false if illegal.
 */
function placeTile(room, tile, sideHint = null) {
  let [a, b] = tile;        // a|b

  // decide side automatically (simple heuristic) if client gave no hint
  let side = sideHint;
  if (!side) {
    if (a === room.rightEnd || b === room.rightEnd) side = 'right';
    else side = 'left';
  }

  if (side === 'left') {
    /* We are prepending.  After insertion the board will read:
       [outer|matching] existingTiles…   so outer pip should be tile[1] */
    if (a === room.leftEnd) {            // matches as tile[a|b] with a=leftEnd
      room.board.unshift([b, a]);        // flip to b|a so "b" faces out
      room.leftEnd = b;
    } else if (b === room.leftEnd) {     // matches as tile[b|a] already correct
      room.board.unshift([a, b]);        // keep orientation
      room.leftEnd = a;
    } else return false;
  } else { /* side === 'right' */
    /* Appending. We want existingTiles… [matching|outer] */
    if (a === room.rightEnd) {           // matches as a|b already correct
      room.board.push([a, b]);           // keep orientation
      room.rightEnd = b;
    } else if (b === room.rightEnd) {    // matches as b|a, must flip
      room.board.push([b, a]);           // flip so matching on left, outer on right
      room.rightEnd = a;
    } else return false;
  }
  return true;
}

/* ───────── socket.io handlers ───────── */

io.on('connection', socket => {
  console.log('● connected', socket.id);

  /* join room */
  socket.on('joinRoom', ({ roomId, playerName }) => {
    socket.join(roomId);
    if (!gameRooms[roomId]) initGameRoom(roomId);
    const room = gameRooms[roomId];

    // first empty seat
    const seat = [0,1,2,3].find(s => !room.players[s]);
    if (seat === undefined) { socket.emit('errorMessage', 'Room full'); return; }

    room.players[seat] = { socketId: socket.id, hand: [], name: playerName || `P${seat}` };
    socket.emit('roomJoined', { seat });

    io.in(roomId).emit('lobbyUpdate', {
      players: Object.entries(room.players).map(([s,p]) => ({ seat:+s, name:p.name })),
      seatsRemaining: 4 - Object.keys(room.players).length
    });

    /* start when 4 players present */
    if (Object.keys(room.players).length === 4) {
      room.started = true;
      const deck = createDominoSet();
      for (const s in room.players) room.players[s].hand = deck.splice(0,7);

      let starter = 0;
      for (const s in room.players)
        if (room.players[s].hand.some(t => t[0] === 6 && t[1] === 6)) { starter = +s; break; }
      room.turn = starter;

      for (const s in room.players)
        io.to(room.players[s].socketId).emit('gameStart', {
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

    // first move must be [6|6]
    if (room.board.length === 0) {
      if (!(tile[0] === 6 && tile[1] === 6)) {
        socket.emit('errorMessage', 'First tile must be [6|6]'); return;
      }
      room.board.push([6,6]);
      room.leftEnd = room.rightEnd = 6;
    } else {
      if (!placeTile(room, tile, side)) {
        socket.emit('errorMessage', 'Tile does not fit on that side'); return;
      }
    }

    // remove from hand
    const player = room.players[seat];
    player.hand = player.hand.filter(t => !(t[0] === tile[0] && t[1] === tile[1]));
    room.passes = 0;

    // win?
    if (player.hand.length === 0) {
      io.in(roomId).emit('roundEnded', { winner: seat, board: room.board });
      return;
    }

    // advance turn
    room.turn = nextSeat(room.turn);
    io.in(roomId).emit('broadcastMove', { seat, tile, side, board: room.board });
    io.in(roomId).emit('turnChanged', room.turn);
  });

  /* pass */
  socket.on('passTurn', ({ roomId, seat }) => {
    const room = gameRooms[roomId];
    if (!room || !room.started) return;
    if (room.turn !== seat) { socket.emit('errorMessage','Not your turn'); return; }

    room.passes += 1;
    if (room.passes >= 4) {
      io.in(roomId).emit('roundEnded', { winner:null, reason:'Tranca', board:room.board });
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

/* ───────── start server ───────── */
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
/* ======================================================================= */
