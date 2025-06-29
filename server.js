/* ========================================================================
   server.js — Dominican Domino with Auto-Room Assignment
   ======================================================================= */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

app.use(express.static('public'));

const rooms = Object.create(null);
let roomCounter = 1;

function createRoom(id) {
  rooms[id] = {
    players   : {},                 // seat -> { socketId, hand, name }
    started   : false,
    board     : [],
    leftEnd   : null,
    rightEnd  : null,
    pipCounts : {0:0,1:0,2:0,3:0,4:0,5:0,6:0},
    turn      : null,
    lastPlayer: null,
    passes    : 0,
    isFirst   : true,
    lastWinner: null,
    scores    : [0,0]
  };
}

const nextSeat = s => (s + 1) % 4;

function newDeck() {
  const t = [];
  for (let i = 0; i <= 6; i++)
    for (let j = i; j <= 6; j++) t.push([i, j]);
  for (let i = t.length - 1; i; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

function handSum(h) {
  return h.reduce((a, [x, y]) => a + x + y, 0);
}

function placeTile(room, tile, sideHint = null) {
  let [a, b] = tile, side = sideHint;
  if (!side) {
    side = (a === room.rightEnd || b === room.rightEnd) ? 'right' : 'left';
  }

  if (side === 'left') {
    if (a === room.leftEnd) { room.board.unshift([b, a]); room.leftEnd = b; }
    else if (b === room.leftEnd) { room.board.unshift([a, b]); room.leftEnd = a; }
    else return false;
  } else {
    if (a === room.rightEnd) { room.board.push([a, b]); room.rightEnd = b; }
    else if (b === room.rightEnd) { room.board.push([b, a]); room.rightEnd = a; }
    else return false;
  }
  return true;
}

function resetRound(roomId, room) {
  const deck = newDeck();
  for (const s in room.players) room.players[s].hand = deck.splice(0, 7);
  room.board = [];
  room.leftEnd = null;
  room.rightEnd = null;
  room.pipCounts = {0:0,1:0,2:0,3:0,4:0,5:0,6:0};
  room.passes = 0;
  room.lastPlayer = null;
  room.turn = room.lastWinner ?? 0;
  room.isFirst = false;

  for (const s in room.players) {
    io.to(room.players[s].socketId).emit('gameStart', {
      yourHand: room.players[s].hand,
      startingSeat: room.turn,
      scores: room.scores
    });
  }
  io.in(roomId).emit('turnChanged', room.turn);
}

/* ───────── SOCKET.IO ───────── */
io.on('connection', socket => {

  /* Auto-room assignment */
  socket.on('findRoom', ({ playerName }) => {
    let roomId = null;

    // Find room with <4 players
    for (const id in rooms) {
      if (Object.keys(rooms[id].players).length < 4) {
        roomId = id;
        break;
      }
    }

    // Or create new room
    if (!roomId) {
      roomId = `room${roomCounter++}`;
      createRoom(roomId);
    }

    const room = rooms[roomId];
    socket.join(roomId);

    const seat = [0,1,2,3].find(s => !room.players[s]);
    room.players[seat] = { socketId: socket.id, hand: [], name: playerName || `P${seat}` };
    socket.emit('roomAssigned', { room: roomId });
    socket.emit('roomJoined', { seat });

    io.in(roomId).emit('lobbyUpdate', {
      players: Object.entries(room.players).map(([s, p]) => ({ seat: +s, name: p.name })),
      seatsRemaining: 4 - Object.keys(room.players).length
    });

    if (Object.keys(room.players).length === 4) {
      room.started = true;
      const deck = newDeck();
      for (const s in room.players) room.players[s].hand = deck.splice(0, 7);

      let starter = room.isFirst
        ? +Object.keys(room.players).find(s =>
            room.players[s].hand.some(t => t[0] === 6 && t[1] === 6))
        : room.lastWinner;

      room.turn = starter;

      for (const s in room.players) {
        io.to(room.players[s].socketId).emit('gameStart', {
          yourHand: room.players[s].hand,
          startingSeat: starter,
          scores: room.scores
        });
      }
      io.in(roomId).emit('turnChanged', starter);
    }
  });

  /* Play tile */
  socket.on('playTile', ({ roomId, seat, tile, side }) => {
    const room = rooms[roomId]; if (!room || !room.started) return;
    if (room.turn !== seat) { socket.emit('errorMessage', 'Not your turn'); return; }

    if (room.board.length === 0) {
      if (room.isFirst && !(tile[0] === 6 && tile[1] === 6)) {
        socket.emit('errorMessage', 'First move must be [6|6]'); return;
      }
      room.board.push(tile);
      room.leftEnd = tile[0]; room.rightEnd = tile[1];
    } else {
      if (!placeTile(room, tile, side)) {
        socket.emit('errorMessage', 'Tile does not fit'); return;
      }
    }

    room.pipCounts[tile[0]]++; room.pipCounts[tile[1]]++;
    room.lastPlayer = seat;
    room.passes = 0;

    const player = room.players[seat];
    player.hand = player.hand.filter(t => !(t[0] === tile[0] && t[1] === tile[1]));

    if (room.board.length === 1) {
      const rightSeat = nextSeat(seat);
      const canPlayRight = room.players[rightSeat].hand.some(
        ([x, y]) => x === room.leftEnd || y === room.leftEnd || x === room.rightEnd || y === room.rightEnd
      );
      if (!canPlayRight) {
        const bonus = room.isFirst ? 30 : 60;
        room.scores[seat % 2] += bonus;
        io.in(roomId).emit('message', `Team ${seat % 2} gains ${bonus} bonus points`);
      }
    }

    if (player.hand.length === 0) {
      const rightSeat = nextSeat(seat);
      const closerPips = 0;
      const rightPips = handSum(room.players[rightSeat].hand);
      let winnerSeat = seat, winnerTeam = seat % 2;
      if (closerPips > rightPips) { winnerSeat = rightSeat; winnerTeam = rightSeat % 2; }

      let points = 0;
      for (const s in room.players) points += handSum(room.players[s].hand);
      const capicua = (room.leftEnd === room.rightEnd);
      if (capicua) points += 30;

      room.scores[winnerTeam] += points;
      room.lastWinner = winnerSeat;

      io.in(roomId).emit('roundEnded', {
        winner: winnerSeat, reason: 'Closed', capicua,
        points, scores: room.scores, board: room.board, pipCounts: room.pipCounts
      });

      if (room.scores[winnerTeam] >= 200) {
        io.in(roomId).emit('gameOver', { winningTeam: winnerTeam, scores: room.scores });
        delete rooms[roomId]; return;
      }
      resetRound(roomId, room); return;
    }

    room.turn = nextSeat(room.turn);
    io.in(roomId).emit('broadcastMove', { seat, tile, side, board: room.board, pipCounts: room.pipCounts });
    io.in(roomId).emit('turnChanged', room.turn);
  });

  /* Pass turn */
  socket.on('passTurn', ({ roomId, seat }) => {
    const room = rooms[roomId]; if (!room || !room.started) return;
    if (room.turn !== seat) { socket.emit('errorMessage', 'Not your turn'); return; }

    room.passes++;
    const ends = [room.leftEnd, room.rightEnd];
    if (room.passes === 4) {
      const blocked = ends.every(p => room.pipCounts[p] === 7);
      if (!blocked) {
        room.passes = 0; room.turn = room.lastPlayer;
        io.in(roomId).emit('message', 'All passed — back to last player');
        io.in(roomId).emit('turnChanged', room.turn);
        return;
      }
    }

    if (room.passes > 4 || (room.passes === 4 && ends.every(p => room.pipCounts[p] === 7))) {
      let low = Infinity, winnerSeat = null;
      for (const s in room.players) {
        const p = handSum(room.players[s].hand);
        if (p < low) { low = p; winnerSeat = +s; }
        else if (p === low) { winnerSeat = room.lastPlayer; }
      }
      const winnerTeam = winnerSeat % 2;

      let points = 0;
      for (const s in room.players) points += handSum(room.players[s].hand);
      room.scores[winnerTeam] += points;
      room.lastWinner = winnerSeat;

      io.in(roomId).emit('roundEnded', {
        winner: winnerSeat, reason: 'Tranca',
        points, scores: room.scores, board: room.board, pipCounts: room.pipCounts
      });

      if (room.scores[winnerTeam] < 170) {
        resetRound(roomId, room); return;
      }
      resetRound(roomId, room); return;
    }

    room.turn = nextSeat(room.turn);
    io.in(roomId).emit('playerPassed', seat);
    io.in(roomId).emit('turnChanged', room.turn);
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      for (const s in room.players)
        if (room.players[s].socketId === socket.id) delete room.players[s];
      if (!Object.keys(room.players).length) delete rooms[roomId];
    }
  });
});

server.listen(PORT, () => console.log(`Domino server on ${PORT}`));
/* ===================================================================== */
