/* ============================================================================
   server.js — Dominican Domino (Fully Rule-Compliant, Tranca Fix v2)
   ========================================================================== */

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);
const PORT   = 3000;

app.use(express.static('public'));

const rooms = Object.create(null);
let   roomCounter = 1;

/* ---------- Turn order: 0 ➜ 3 ➜ 2 ➜ 1 ---------- */
const turnOrder = [0, 3, 2, 1];
function nextSeat(s) {
  const i = turnOrder.indexOf(s);
  return turnOrder[(i + 1) % 4];
}

/* ---------- Room & deck helpers ---------- */
function createRoom(id) {
  rooms[id] = {
    players   : {},                       // seat → { socketId, hand, name }
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
    scores    : [0, 0]
  };
}

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

const handSum = h => h.reduce((a, [x, y]) => a + x + y, 0);

function placeTile(room, tile, sideHint = null) {
  let [a, b] = tile, side = sideHint;
  if (!side) side = (a === room.rightEnd || b === room.rightEnd) ? 'right' : 'left';

  if (side === 'left') {
    if      (a === room.leftEnd)  { room.board.unshift([b, a]); room.leftEnd = b; }
    else if (b === room.leftEnd)  { room.board.unshift([a, b]); room.leftEnd = a; }
    else return false;
  } else {
    if      (a === room.rightEnd) { room.board.push([a, b]);    room.rightEnd = b; }
    else if (b === room.rightEnd) { room.board.push([b, a]);    room.rightEnd = a; }
    else return false;
  }
  return true;
}

function resetRound(roomId, room) {
  const deck = newDeck();
  for (const s in room.players) room.players[s].hand = deck.splice(0, 7);

  Object.assign(room, {
    board     : [],
    leftEnd   : null,
    rightEnd  : null,
    pipCounts : {0:0,1:0,2:0,3:0,4:0,5:0,6:0},
    passes    : 0,
    lastPlayer: null,
    turn      : room.lastWinner ?? 0,
    isFirst   : false
  });

  for (const s in room.players) {
    io.to(room.players[s].socketId).emit('gameStart', {
      yourHand     : room.players[s].hand,
      startingSeat : room.turn,
      scores       : room.scores
    });
  }
  io.in(roomId).emit('turnChanged', room.turn);
}

/* ───────── SOCKET.IO ───────── */
io.on('connection', socket => {

  /* ---------- Auto-room discovery ---------- */
  socket.on('findRoom', ({ playerName }) => {
    let roomId = Object.keys(rooms).find(id => Object.keys(rooms[id].players).length < 4);

    if (!roomId) {
      roomId = `room${roomCounter++}`;
      createRoom(roomId);
    }

    const room = rooms[roomId];
    socket.join(roomId);

    const seat = [0,1,2,3].find(s => !room.players[s]);
    room.players[seat] = { socketId: socket.id, hand: [], name: playerName || `P${seat}` };

    socket.emit('roomAssigned', { room: roomId });
    socket.emit('roomJoined',  { seat });

    io.in(roomId).emit('lobbyUpdate', {
      players        : Object.entries(room.players).map(([s, p]) => ({ seat:+s, name:p.name })),
      seatsRemaining : 4 - Object.keys(room.players).length
    });

    /* ---------- Start when 4 seats filled ---------- */
    if (Object.keys(room.players).length === 4) {
      room.started = true;
      const deck = newDeck();
      for (const s in room.players) room.players[s].hand = deck.splice(0, 7);

      const starter = room.isFirst
        ? +Object.keys(room.players).find(s => room.players[s].hand.some(t => t[0]===6 && t[1]===6))
        : room.lastWinner;

      room.turn = starter;

      for (const s in room.players) {
        io.to(room.players[s].socketId).emit('gameStart', {
          yourHand     : room.players[s].hand,
          startingSeat : starter,
          scores       : room.scores
        });
      }
      io.in(roomId).emit('turnChanged', starter);
    }
  });

  /* ---------- Play tile ---------- */
  socket.on('playTile', ({ roomId, seat, tile, side }) => {
    const room = rooms[roomId]; if (!room || !room.started) return;
    if (room.turn !== seat) { socket.emit('errorMessage', 'Not your turn'); return; }

    const endsBefore = [room.leftEnd, room.rightEnd];

    /* ---- First tile ---- */
    if (room.board.length === 0) {
      if (room.isFirst && !(tile[0] === 6 && tile[1] === 6)) {
        socket.emit('errorMessage', 'First move must be [6|6]'); return;
      }
      room.board.push(tile);
      room.leftEnd  = tile[0];
      room.rightEnd = tile[1];
    } else {
      if (!placeTile(room, tile, side)) {
        socket.emit('errorMessage', 'Tile does not fit'); return;
      }
    }

    /* ---- State updates ---- */
    room.pipCounts[tile[0]]++; room.pipCounts[tile[1]]++;
    room.lastPlayer = seat;
    room.passes     = 0;

    const player = room.players[seat];
    player.hand = player.hand.filter(t => !(t[0] === tile[0] && t[1] === tile[1]));

    /* ---- Right-hand block bonus (opening move only) ---- */
    if (room.board.length === 1) {
      const rightSeat = nextSeat(seat);
      if ((seat % 2) !== (rightSeat % 2)) {                 // opponent only
        const oppHand = room.players[rightSeat].hand;
        const [a, b] = tile;
        if (a === b) {                                      // double
          const hasMatch = oppHand.some(([x,y]) => x === a || y === a);
          if (!hasMatch) {
            room.scores[seat % 2] += 30;
            io.in(roomId).emit('message', 'Right-hand block bonus +30');
          }
        } else {                                            // mixed
          const hasAny = oppHand.some(([x,y]) => x===a||y===a||x===b||y===b);
          if (!hasAny) {
            room.scores[seat % 2] += 60;
            io.in(roomId).emit('message', 'Right-hand block bonus +60');
          }
        }
      }
    }

    /* ---- Closing the round (player emptied hand) ---- */
    if (player.hand.length === 0) {
      const capicua = endsBefore[0] !== endsBefore[1] && room.leftEnd === room.rightEnd;

      let paso = true;
      for (const s in room.players) {
        if (+s === seat) continue;
        const canPlay = room.players[s].hand.some(
          ([x,y]) => x===room.leftEnd || y===room.leftEnd || x===room.rightEnd || y===room.rightEnd
        );
        if (canPlay) { paso = false; break; }
      }

      let points = Object.values(room.players).reduce((sum, p) => sum + handSum(p.hand), 0);
      if (capicua && paso)      points += 60;
      else if (capicua || paso) points += 30;

      room.scores[seat % 2] += points;
      room.lastWinner = seat;

      io.in(roomId).emit('roundEnded', {
        winner : seat,
        reason : 'Closed',
        capicua,
        paso,
        points,
        scores : room.scores,
        board  : room.board
      });

      if (room.scores[seat % 2] >= 200) {
        io.in(roomId).emit('gameOver', { winningTeam: seat % 2, scores: room.scores });
        delete rooms[roomId];
        return;
      }
      resetRound(roomId, room);
      return;
    }

    /* ---- Next turn ---- */
    room.turn = nextSeat(room.turn);
    io.in(roomId).emit('broadcastMove', { seat, tile, side, board: room.board });
    io.in(roomId).emit('turnChanged', room.turn);
  });

  /* ---------- Pass turn ---------- */
  socket.on('passTurn', ({ roomId, seat }) => {
    const room = rooms[roomId]; if (!room || !room.started) return;
    if (room.turn !== seat) { socket.emit('errorMessage', 'Not your turn'); return; }

    room.passes++;

    /* ---------------- Tranca (4 consecutive passes) ---------------- */
    if (room.passes === 4) {
      const closingSeat   = room.lastPlayer;         // last to place a tile
      const nextSeatCCW   = nextSeat(closingSeat);   // counter-clockwise seat
      const closingPips   = handSum(room.players[closingSeat].hand);
      const nextPips      = handSum(room.players[nextSeatCCW].hand);

      const winnerSeat    = closingPips <= nextPips ? closingSeat : nextSeatCCW;
      const winnerTeam    = winnerSeat % 2;

      const points = Object.values(room.players).reduce((sum, p) => sum + handSum(p.hand), 0);
      room.scores[winnerTeam] += points;
      room.lastWinner = winnerSeat;

      io.in(roomId).emit('roundEnded', {
        winner : winnerSeat,
        reason : 'Tranca',
        points,
        scores : room.scores,
        board  : room.board
      });

      if (room.scores[winnerTeam] >= 200) {
        io.in(roomId).emit('gameOver', { winningTeam: winnerTeam, scores: room.scores });
        delete rooms[roomId];
        return;
      }
      resetRound(roomId, room);
      return;
    }

    /* ---- Normal pass ---- */
    room.turn = nextSeat(room.turn);
    io.in(roomId).emit('playerPassed', seat);
    io.in(roomId).emit('turnChanged', room.turn);
  });

  /* ---------- Disconnect cleanup ---------- */
  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      for (const s in room.players)
        if (room.players[s].socketId === socket.id) delete room.players[s];
      if (!Object.keys(room.players).length) delete rooms[roomId];
    }
  });
});

/* ---------- Start server ---------- */
server.listen(PORT, () => console.log(`Domino server running on port ${PORT}`));
