/* =====================================================================
 * server/server.js  –  Socket.IO server using modular engine helpers
 * =================================================================== */
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');

/* ----- pull helpers from one level up -------------------------------- */
const {
  placeTile,
  nextSeat,
  teamOf,
  initNewRound,                  // from /engine
} = require('../engine/game');

// The `dealHands` import is not needed here, as initNewRound handles it.

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = 3000;

app.use(express.static('public'));

/* ---------------------------------------------------------------------
 * Player + Room definitions
 * ------------------------------------------------------------------- */
class Player {
  constructor(socketId, name, seat) {
    this.socketId    = socketId;
    this.name        = name;
    this.seat        = seat;
    this.hand        = [];
    this.isConnected = true;
  }
  handSum() { return this.hand.reduce((s,[a,b]) => s + a + b, 0); }
}

let roomCounter = 1;
const rooms = {};
function createRoom(id) {
  rooms[id] = {
    id,
    players: {},
    isGameStarted: false,
    board: [],
    leftEnd: null,
    rightEnd: null,
    pipCounts: { 0:0,1:0,2:0,3:0,4:0,5:0,6:0 },
    turn: null,
    turnStarter: null,
    lastMoverSeat: null,
    passCount: 0,
    isRoundOver: false,
    isFirstRound: true,
    lastWinnerSeat: null,
    scores: [0,0],
    reconnectTimers: {},
  };
  return rooms[id];
}

/* ---------------------------------------------------------------------
 * advanceToNextTurn  (unchanged)
 * ------------------------------------------------------------------- */
function advanceToNextTurn(room) {
  let nextPlayerSeat = room.turn;
  for (let i=0;i<4;i++) {
    nextPlayerSeat = nextSeat(nextPlayerSeat);
    const player   = room.players[nextPlayerSeat];

    if (!player.isConnected) {
      io.in(room.id).emit('playerPassed',{ seat:nextPlayerSeat, reason:'disconnected' });
      room.passCount++;
      continue;
    }

    const canPlay = player.hand.some(([x,y]) =>
      x===room.leftEnd || y===room.leftEnd || x===room.rightEnd || y===room.rightEnd
    );

    if (canPlay) {
      room.turn      = nextPlayerSeat;
      room.passCount = 0;
      io.in(room.id).emit('turnChanged', room.turn);
      return;
    } else {
      io.in(room.id).emit('playerPassed',{ seat:nextPlayerSeat });
      room.passCount++;
    }
  }
  if (room.passCount >= 4) handleTranca(room);
}

/* ---------------------------------------------------------------------
 * broadcastHands / scoring helpers  (unchanged bodies)
 * ------------------------------------------------------------------- */
function broadcastHands(room) { /* ... unchanged implementation ... */ }
function handleTranca(room)   { /* ... unchanged implementation ... */ }
function handleRoundWin(room,wSeat,endsBefore){ /* ... unchanged ... */ }

/* ---------------------------------------------------------------------
 * maybeStartNextRound now calls engine.initNewRound(room, io)
 * ------------------------------------------------------------------- */
function maybeStartNextRound(room) {
  if (room.scores.some(s=>s>=200)) {
    const winningTeam = room.scores.findIndex(s=>s>=200);
    io.in(room.id).emit('gameOver',{ winningTeam, scores:room.scores });
    delete rooms[room.id];
    return;
  }
  initNewRound(room, io);       // << engine version
}

/* ---------------------------------------------------------------------
 * Socket.IO connection handler
 * ------------------------------------------------------------------- */
io.on('connection', socket => {

  socket.on('findRoom', ({ playerName, roomId, reconnectSeat }) => {
    /* ----- reconnect path (unchanged) ------------------------------ */
    if (roomId && rooms[roomId] && reconnectSeat!==undefined) {
      /* ... your unchanged reconnect logic ... */
      return;
    }

    /* ----- find or create room ------------------------------------ */
    let room = Object.values(rooms).find(r => !r.isGameStarted && Object.keys(r.players).length<4);
    if (!room) room = createRoom(`room${roomCounter++}`);

    const seat = [0,1,2,3].find(s=>!room.players[s]);
    const pl   = new Player(socket.id, playerName||`Player ${seat+1}`, seat);
    room.players[seat] = pl;

    socket.join(room.id);
    socket.emit('roomJoined',{ roomId: room.id, seat });

    io.in(room.id).emit('lobbyUpdate',{
      players: Object.values(room.players).map(p=>({ seat:p.seat,name:p.name })),
      seatsRemaining: 4 - Object.keys(room.players).length,
    });

    /* ----- start game when 4 players ------------------------------ */
    if (Object.keys(room.players).length === 4) {
      room.isGameStarted = true;
      io.in(room.id).emit('allPlayersReady');
      setTimeout(() => initNewRound(room, io), 1500);   // << pass io
    }
  });

  /* ---------- playTile handler (unchanged, uses placeTile) -------- */
  socket.on('playTile', ({ roomId, seat, tile, side }) => {
    /* ... unchanged implementation ... */
  });

  /* ---------- disconnect handler (unchanged) ---------------------- */
  socket.on('disconnect', () => {
    /* ... unchanged implementation ... */
  });

});

/* ------------------------------------------------------------------ */
server.listen(PORT, () =>
  console.log(`✅ Domino server running at http://localhost:${PORT}`)
);