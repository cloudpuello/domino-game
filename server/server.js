/* =====================================================================
 * server/server.js  –  Socket.IO domino server
 * =================================================================== */
const express   = require('express');
const http      = require('http');
const { Server} = require('socket.io');

/* -- core helpers ---------------------------------------------------- */
const {
  placeTile,
  nextSeat,
  teamOf,
  initNewRound,               // from /engine
} = require('../engine/game');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = 3000;

app.use(express.static('public'));

/* ---------------------------------------------------------------------
 *  Player / Room models
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
    players: {},                 // seat → Player | undefined
    isGameStarted: false,

    /* round state */
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
 *  Turn helper (unchanged)
 * ------------------------------------------------------------------- */
function advanceToNextTurn(room) {
  let nextPlayerSeat = room.turn;

  for (let i = 0; i < 4; i++) {
    nextPlayerSeat = nextSeat(nextPlayerSeat);
    const player   = room.players[nextPlayerSeat];

    if (!player || !player.isConnected) {
      io.in(room.id).emit('playerPassed', { seat: nextPlayerSeat, reason:'disconnected' });
      room.passCount++;
      continue;
    }

    const canPlay = player.hand.some(([x,y]) =>
      x === room.leftEnd || y === room.leftEnd ||
      x === room.rightEnd || y === room.rightEnd
    );

    if (canPlay) {
      room.turn      = nextPlayerSeat;
      room.passCount = 0;
      io.in(room.id).emit('turnChanged', room.turn);
      return;
    }
    io.in(room.id).emit('playerPassed', { seat: nextPlayerSeat });
    room.passCount++;
  }
  if (room.passCount >= 4) handleTranca(room);
}

/* ---------------------------------------------------------------------
 *  Scoring helpers  (bodies unchanged placeholders)
 * ------------------------------------------------------------------- */
function broadcastHands(room)            { /* … */ }
function handleTranca(room)              { /* … */ }
function handleRoundWin(room, wSeat, eB) { /* … */ }

/* ---------------------------------------------------------------------
 *  Round / game control
 * ------------------------------------------------------------------- */
function maybeStartNextRound(room) {
  if (room.scores.some(s => s >= 200)) {
    const winningTeam = room.scores.findIndex(s => s >= 200);
    io.in(room.id).emit('gameOver', { winningTeam, scores: room.scores });
    delete rooms[room.id];
    return;
  }
  initNewRound(room, io);
}

/* ---------------------------------------------------------------------
 *  Socket handlers
 * ------------------------------------------------------------------- */
io.on('connection', socket => {

  /* -------- findRoom / lobby join ---------------------------------- */
  socket.on('findRoom', ({ playerName, roomId, reconnectSeat }) => {

    /* Reconnect path ------------------------------------------------- */
    if (roomId && rooms[roomId] && reconnectSeat !== undefined) {
      // (reconnect logic unchanged – fill in if you had it earlier)
      return;
    }

    /* Find or create lobby ------------------------------------------ */
    let room = Object.values(rooms)
              .find(r => !r.isGameStarted &&
                         Object.values(r.players).filter(p => p && p.isConnected).length < 4);

    if (!room) room = createRoom(`room${roomCounter++}`);

    const seat = [0,1,2,3].find(s => !room.players[s]);
    const pl   = new Player(socket.id, playerName || `Player ${seat+1}`, seat);
    room.players[seat] = pl;

    socket.join(room.id);
    socket.emit('roomJoined', { roomId: room.id, seat });

    io.in(room.id).emit('lobbyUpdate', {
      players: Object.values(room.players).map(p => ({
        seat: p.seat,
        name: p.name,
        connected: p.isConnected
      })),
      seatsRemaining: 4 - Object.values(room.players)
                                 .filter(p => p && p.isConnected).length,
    });

    /* Start game only when 4 *connected* players -------------------- */
    const connectedCount = Object.values(room.players)
                                 .filter(p => p && p.isConnected).length;
    if (connectedCount === 4) {
      room.isGameStarted = true;
      io.in(room.id).emit('allPlayersReady');
      setTimeout(() => initNewRound(room, io), 1500);
    }
  });

  /* -------- playTile ---------------------------------------------- */
  socket.on('playTile', ({ roomId, seat, tile, side }) => {
    // (your existing playTile logic here, unchanged)
  });

  /* -------- disconnect -------------------------------------------- */
  socket.on('disconnect', () => {
    const room = Object.values(rooms).find(r =>
      Object.values(r.players).some(p => p.socketId === socket.id)
    );
    if (!room) return;

    const seat = Object.keys(room.players).find(s =>
      room.players[s].socketId === socket.id
    );

    /* mark seat as offline, keep for possible reconnect */
    room.players[seat].isConnected = false;

    /* Update lobby if the game hasn’t started yet */
    if (!room.isGameStarted) {
      io.in(room.id).emit('lobbyUpdate', {
        players: Object.values(room.players).map(p => ({
          seat: p.seat,
          name: p.name,
          connected: p.isConnected
        })),
        seatsRemaining: 4 - Object.values(room.players)
                                   .filter(p => p && p.isConnected).length,
      });
    }
  });
});

/* ------------------------------------------------------------------ */
server.listen(PORT, () =>
  console.log(`✅ Domino server running at http://localhost:${PORT}`)
);
