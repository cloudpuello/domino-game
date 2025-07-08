/* ============================================================================
 * server.js — (Opener Bug Fixed)
 * ========================================================================= */

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = 3000;

app.use(express.static('public'));

/* -------------------------------------------------------------------------- */
/* Helpers & constants                                                       */
/* -------------------------------------------------------------------------- */
const turnOrder = [0, 1, 2, 3];
const nextSeat  = seat => turnOrder[(turnOrder.indexOf(seat) + 1) % 4];
const teamOf    = seat => seat % 2;

/* -------------------------------------------------------------------------- */
/* Player class                                                              */
/* -------------------------------------------------------------------------- */
class Player {
  constructor(socketId, name, seat) {
    this.socketId   = socketId;
    this.name       = name;
    this.seat       = seat;
    this.hand       = [];
    this.isConnected = true;
  }
  handSum() { return this.hand.reduce((s,[a,b]) => s+a+b, 0); }
}

/* -------------------------------------------------------------------------- */
/* Room factory                                                              */
/* -------------------------------------------------------------------------- */
let roomCounter = 1;
const rooms     = {};

function createRoom(id) {
  rooms[id] = {
    id,
    players        : {},
    isGameStarted  : false,
    board          : [],
    leftEnd        : null,
    rightEnd       : null,
    pipCounts      : {0:0,1:0,2:0,3:0,4:0,5:0,6:0},
    turn           : null,
    turnStarter    : null,
    lastMoverSeat  : null,
    passCount      : 0,
    isRoundOver    : false,
    isFirstRound   : true,
    lastWinnerSeat : null,
    scores         : [0,0],
    passTimer      : null,
    reconnectTimers: {},
  };
  return rooms[id];
}

/* -------------------------------------------------------------------------- */
/* Domino helpers                                                            */
/* -------------------------------------------------------------------------- */
function newDeck() {
  const deck = [];
  for (let i=0;i<=6;i++) for (let j=i;j<=6;j++) deck.push([i,j]);
  for (let i=deck.length-1;i;i--) {
    const j = Math.floor(Math.random()*(i+1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function dealHands(room) {
  const deck = newDeck();
  Object.values(room.players).forEach((p,i) => {
    p.hand = deck.slice(i*7, i*7+7);
  });
}

function placeTile(room, tile, sideHint) {
  let [a,b] = tile, side = sideHint;
  const fitsLeft  = a===room.leftEnd  || b===room.leftEnd;
  const fitsRight = a===room.rightEnd || b===room.rightEnd;
  if (!fitsLeft && !fitsRight) return false;
  if (!side) side = fitsRight ? 'right' : 'left';
  if (side === 'left') {
    if (!fitsLeft) return false;
    if (a===room.leftEnd){ room.board.unshift([b,a]); room.leftEnd=b; }
    else                 { room.board.unshift([a,b]); room.leftEnd=a; }
  } else {
    if (!fitsRight) return false;
    if (a===room.rightEnd){ room.board.push([a,b]); room.rightEnd=b; }
    else                  { room.board.push([b,a]); room.rightEnd=a; }
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* Timers & Turn Advancement                                                 */
/* -------------------------------------------------------------------------- */
const TURN_MS = 90_000;
function startTurnTimer(room) {
  if (room.passTimer) clearTimeout(room.passTimer);
  room.passTimer = setTimeout(() => {
    io.in(room.id).emit('playerPassed', { seat: room.turn, reason:'timeout' });
    room.passCount++;
    stepTurn(room);
  }, TURN_MS);
}

function stepTurn(room) {
  if (room.passTimer) clearTimeout(room.passTimer);
  room.turn = nextSeat(room.turn);
  const player = room.players[room.turn];
  if (!player.isConnected) {
    room.passCount++;
    io.in(room.id).emit('playerPassed', { seat: room.turn, reason:'disconnected' });
    return room.passCount>=4 ? handleTranca(room) : setImmediate(()=>stepTurn(room));
  }
  const canPlay = room.board.length === 0 || player.hand.some(([x, y]) =>
      x === room.leftEnd || y === room.leftEnd || x === room.rightEnd || y === room.rightEnd);
  if (canPlay) {
    room.passCount = 0;
    io.in(room.id).emit('turnChanged', room.turn);
    startTurnTimer(room);
  } else {
    room.passCount++;
    io.in(room.id).emit('playerPassed', { seat: room.turn });
    if (room.passCount>=4) handleTranca(room);
    else setImmediate(()=>stepTurn(room));
  }
}

/* -------------------------------------------------------------------------- */
/* Round / scoring helpers                                                   */
/* -------------------------------------------------------------------------- */
function broadcastHands(room) {
  const hands = Object.values(room.players).map(p => ({ seat:p.seat, hand:p.hand }));
  io.in(room.id).emit('showFinalHands', hands);
}

function handleTranca(room) {
  if (room.isRoundOver) return;
  room.isRoundOver = true;
  const closer   = room.lastMoverSeat;
  const nextPlayerInTurn = nextSeat(closer);
  const closerPips = room.players[closer].handSum();
  const nextPlayerPips = room.players[nextPlayerInTurn].handSum();
  const winnerSeat = closerPips <= nextPlayerPips ? closer : nextPlayerInTurn;
  const winningTeam = teamOf(winnerSeat);
  const points = Object.values(room.players).reduce((s,p)=>s+p.handSum(),0);
  room.scores[winningTeam] += points;
  room.lastWinnerSeat = winnerSeat;
  room.isFirstRound   = false;
  io.in(room.id).emit('roundEnded',{ reason:'Tranca', winner:winnerSeat, winningTeam, points, scores:room.scores });
  broadcastHands(room);
  setTimeout(()=>maybeStartNextRound(room),4000);
}

function handleRoundWin(room, winnerSeat, endsBefore) {
    if (room.isRoundOver) return;
    room.isRoundOver = true;
    const team = teamOf(winnerSeat);
    const pipSum = Object.values(room.players).reduce((s, p) => s + p.handSum(), 0);
    let bonus = 0;
    let pointsAwarded = pipSum;
    let capicua = false;
    let paso = false;
    room.scores[team] += pipSum;
    const isGameOver = room.scores[team] >= 200;
    if (!isGameOver) {
        capicua = endsBefore.left !== endsBefore.right && room.leftEnd === room.rightEnd;
        paso = !Object.values(room.players).some(p =>
            p.seat !== winnerSeat &&
            p.hand.some(([x, y]) => x === room.leftEnd || y === room.leftEnd || x === room.rightEnd || y === room.rightEnd)
        );
        if (capicua && paso) bonus = 60;
        else if (capicua || paso) bonus = 30;
        if (bonus > 0) {
            room.scores[team] += bonus;
            pointsAwarded += bonus;
        }
    }
    room.lastWinnerSeat = winnerSeat;
    room.isFirstRound = false;
    io.in(room.id).emit('roundEnded', { reason: 'Closed', winner: winnerSeat, winningTeam: team, capicua, paso, points: pointsAwarded, scores: room.scores });
    broadcastHands(room);
    setTimeout(() => maybeStartNextRound(room), 4000);
}

function maybeStartNextRound(room) {
  if (room.scores.some(s=>s>=200)){
    const winningTeam = room.scores.findIndex(s=>s>=200);
    io.in(room.id).emit('gameOver',{ winningTeam, scores:room.scores });
    delete rooms[room.id];
    return;
  }
  initNewRound(room);
}

// --- THIS FUNCTION IS REWRITTEN WITH THE OPENER BUG FIX ---
function initNewRound(room) {
    Object.assign(room, {
        board: [], leftEnd: null, rightEnd: null,
        pipCounts: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        turn: null, turnStarter: null,
        lastMoverSeat: null,
        passCount: 0, isRoundOver: false
    });

    dealHands(room);

    let opener;
    if (room.isFirstRound) {
        // For the first round of the game, find the player with [6|6]
        opener = +Object.keys(room.players).find(s =>
            room.players[s].hand.some(([a, b]) => a === 6 && b === 6)
        );
        // Fallback just in case [6|6] isn't dealt (should be impossible)
        if (opener === undefined) opener = 0;
    } else {
        // For all subsequent rounds, the winner of the previous round opens
        opener = room.lastWinnerSeat;
    }

    room.turn = opener;
    room.turnStarter = opener;

    Object.values(room.players).forEach(p => {
        io.to(p.socketId).emit('roundStart', {
            yourHand: p.hand,
            startingSeat: opener,
            scores: room.scores
        });
    });
    io.in(room.id).emit('turnChanged', opener);
    startTurnTimer(room);
}


/* -------------------------------------------------------------------------- */
/* Socket.IO main handler                                                    */
/* -------------------------------------------------------------------------- */
io.on('connection', socket=>{
  socket.on('findRoom', ({ playerName, roomId, reconnectSeat }) => {
    if (roomId && rooms[roomId] && reconnectSeat!==undefined) {
      const room = rooms[roomId];
      const pl   = room.players[reconnectSeat];
      if (pl && !pl.isConnected){
        clearTimeout(room.reconnectTimers[reconnectSeat]);
        pl.isConnected = true;
        pl.socketId    = socket.id;
        socket.join(roomId);
        io.in(roomId).emit('playerReconnected',{ seat:pl.seat, name:pl.name });
        socket.emit('reconnectSuccess',{
          roomState:{
            players: Object.values(room.players).map(p=>({ seat:p.seat,name:p.name,isConnected:p.isConnected })),
            board: room.board, leftEnd: room.leftEnd, rightEnd: room.rightEnd,
            pipCounts: room.pipCounts, scores: room.scores, turn: room.turn,
            yourHand: pl.hand
          }
        });
        return;
      }
    }
    let room = Object.values(rooms).find(r => !r.isGameStarted && Object.keys(r.players).length < 4);
    if (!room) room = createRoom(`room${roomCounter++}`);
    const seat = [0,1,2,3].find(s=>!room.players[s]);
    const pl = new Player(socket.id, playerName||`Player ${seat+1}`, seat);
    room.players[seat] = pl;
    socket.join(room.id);
    socket.emit('roomJoined',{ roomId:room.id, seat });
    io.in(room.id).emit('lobbyUpdate',{
      players:Object.values(room.players).map(p=>({ seat:p.seat, name:p.name })),
      seatsRemaining: 4 - Object.keys(room.players).length,
    });
    if (Object.keys(room.players).length===4){
      room.isGameStarted = true;
      io.in(room.id).emit('allPlayersReady');
      setTimeout(()=>initNewRound(room),1500);
    }
  });

  socket.on('playTile', ({ roomId, seat, tile, side }) => {
    const room = rooms[roomId];
    if (!room || room.isRoundOver || room.turn!==seat) return;
    if (room.passTimer) clearTimeout(room.passTimer); // Clear AFK timer on valid action
    const player = room.players[seat];
    const idx = player.hand.findIndex(([a,b]) => (a===tile[0] && b===tile[1]) || (a===tile[1] && b===tile[0]));
    if (idx===-1){ io.to(socket.id).emit('errorMessage','Tile not in hand'); return; }
    const endsBefore = { left:room.leftEnd, right:room.rightEnd };
    if (room.board.length===0){
      if (room.isFirstRound && !(tile[0]===6&&tile[1]===6)){
        io.to(socket.id).emit('errorMessage','First move must be [6|6]');
        return;
      }
      room.board.push(tile);
      [room.leftEnd, room.rightEnd] = tile;
    } else {
      if (!placeTile(room,tile,side)){
        io.to(socket.id).emit('errorMessage','Tile does not fit');
        return;
      }
    }
    room.passCount = 0;
    room.pipCounts[tile[0]]++;
    room.pipCounts[tile[1]]++;
    player.hand.splice(idx,1);
    io.to(player.socketId).emit('updateHand', player.hand);
    room.lastMoverSeat = seat;
    if (room.board.length===1 && seat===room.turnStarter){
      const rightSeat = nextSeat(seat);
      if (teamOf(rightSeat)!==teamOf(seat)){
        const oppHand = room.players[rightSeat].hand;
        const blocked = !oppHand.some(([x,y])=> x===room.leftEnd||y===room.leftEnd||x===room.rightEnd||y===room.rightEnd);
        if (blocked){
          const bonus = (tile[0]===tile[1]) ? 30 : 60;
          room.scores[teamOf(seat)] += bonus;
          io.in(room.id).emit('bonusAwarded',{ seat, type:'Right-Hand Block', points:bonus, scores:room.scores });
        }
      }
    }
    io.in(room.id).emit('broadcastMove',{
      seat, tile, board:room.board, leftEnd:room.leftEnd, rightEnd:room.rightEnd, pipCounts:room.pipCounts
    });
    if (player.hand.length===0) {
      handleRoundWin(room, seat, endsBefore);
    } else {
      stepTurn(room);
    }
  });

  socket.on('disconnect', () => {
    for (const room of Object.values(rooms)) {
        const player = Object.values(room.players).find(p => p.socketId === socket.id);
        if (!player) continue;
        if (!room.isGameStarted) {
            delete room.players[player.seat];
            io.in(room.id).emit('lobbyUpdate', {
                players: Object.values(room.players).map(p => ({ seat: p.seat, name: p.name })),
                seatsRemaining: 4 - Object.keys(room.players).length
            });
        } else {
            player.isConnected = false;
            io.in(room.id).emit('playerDisconnected', { seat: player.seat, name: player.name });
            room.reconnectTimers[player.seat] = setTimeout(() => {
                if (!player.isConnected) {
                    io.in(room.id).emit('gameOver', {
                        reason: `Player ${player.name} did not reconnect.`,
                        winningTeam: (teamOf(player.seat) + 1) % 2
                    });
                    delete rooms[room.id];
                }
            }, 60000);
            if (room.turn === player.seat && !room.isRoundOver) {
                stepTurn(room);
            }
        }
        break;
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Start server                                                              */
/* -------------------------------------------------------------------------- */
server.listen(PORT,()=>console.log(`✅ Domino server running at http://localhost:${PORT}`));