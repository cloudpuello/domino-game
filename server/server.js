/* =====================================================================
 * server.js  – Socket.IO server using modular engine helpers
 * =================================================================== */

const express   = require('express');
const http      = require('http');
const { Server} = require('socket.io');

const {
  placeTile,
  nextSeat,
  teamOf,
} = require('./engine/game');        // <-- pulled from /engine

const { newDeck, dealHands } = require('./engine/utils');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = 3000;

app.use(express.static('public'));

/* ------------------------------------------------------------------ */
/* Player class & Room Factory                                        */
/* ------------------------------------------------------------------ */
class Player {
  constructor(socketId, name, seat) {
    this.socketId   = socketId;
    this.name       = name;
    this.seat       = seat;
    this.hand       = [];
    this.isConnected = true;
  }
  handSum() { return this.hand.reduce((s, [a, b]) => s + a + b, 0); }
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

/* ------------------------------------------------------------------ */
/* Turn-advancement helper (unchanged)                                */
/* ------------------------------------------------------------------ */
function advanceToNextTurn(room) {
  let nextPlayerSeat = room.turn;

  for (let i = 0; i < 4; i++) {
    nextPlayerSeat = nextSeat(nextPlayerSeat);
    const player   = room.players[nextPlayerSeat];

    if (!player.isConnected) {
      io.in(room.id).emit('playerPassed', { seat: nextPlayerSeat, reason: 'disconnected' });
      room.passCount++;
      continue;
    }

    const canPlay = player.hand.some(([x, y]) =>
      x === room.leftEnd || y === room.leftEnd ||
      x === room.rightEnd || y === room.rightEnd
    );

    if (canPlay) {
      room.turn      = nextPlayerSeat;
      room.passCount = 0;
      io.in(room.id).emit('turnChanged', room.turn);
      return;
    } else {
      io.in(room.id).emit('playerPassed', { seat: nextPlayerSeat });
      room.passCount++;
    }
  }

  if (room.passCount >= 4) handleTranca(room);
}

/* ------------------------------------------------------------------ */
/* Round / scoring helpers (unchanged)                                */
/* ------------------------------------------------------------------ */
function broadcastHands(room) {
  const hands = Object.values(room.players).map(p => ({
    seat: p.seat,
    hand: p.hand,
  }));
  io.in(room.id).emit('showFinalHands', hands);
}

function handleTranca(room) { /* … unchanged … */ }
function handleRoundWin(room, winnerSeat, endsBefore) { /* … unchanged … */ }

/* ------------------------------------------------------------------ */
/* initNewRound – now uses dealHands from utils                       */
/* ------------------------------------------------------------------ */
function initNewRound(room) {
  Object.assign(room, {
    board: [],
    leftEnd: null,
    rightEnd: null,
    pipCounts: { 0:0,1:0,2:0,3:0,4:0,5:0,6:0 },
    turn: null,
    turnStarter: null,
    lastMoverSeat: null,
    passCount: 0,
    isRoundOver: false,
  });

  dealHands(room);                            // <-- pulled from utils

  let opener;
  if (room.isFirstRound) {
    opener = +Object.keys(room.players).find(s =>
      room.players[s].hand.some(([a, b]) => a === 6 && b === 6)
    );
    if (opener === undefined) opener = 0;
  } else {
    opener = room.lastWinnerSeat;
  }
  room.turn        = opener;
  room.turnStarter = opener;

  Object.values(room.players).forEach(p => {
    io.to(p.socketId).emit('roundStart', {
      yourHand: p.hand,
      startingSeat: opener,
      scores: room.scores,
    });
  });

  io.in(room.id).emit('turnChanged', opener);
}

/* ------------------------------------------------------------------ */
/* Socket.IO main handler (unchanged, except duplicate helpers gone)  */
/* ------------------------------------------------------------------ */
io.on('connection', socket => {
  /* ... entire connection handler stays the same,
       but relies on imported helpers instead of duplicates ... */
});

/* ------------------------------------------------------------------ */
/* Start server                                                       */
/* ------------------------------------------------------------------ */
server.listen(PORT, () =>
  console.log(`✅ Domino server running at http://localhost:${PORT}`)
);
