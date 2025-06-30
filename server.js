/* ============================================================================
   server.js — Dominican Domino (Full Rules: Capicú, Paso, Block Bonus)
   ========================================================================= */

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);
const PORT   = 3000;

app.use(express.static('public'));

const rooms = {};
let roomCounter = 1;

/* ---------- Turn order 0 ➜ 3 ➜ 2 ➜ 1 ---------- */
const turnOrder = [0, 3, 2, 1];
const nextSeat  = s => turnOrder[(turnOrder.indexOf(s)+1)%4];

/* ---------- Core helpers ---------- */
function createRoom(id){
  rooms[id] = {
    players   : {},
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
    scores    : [0,0],
    passTimer : null
  };
}

function newDeck(){
  const d=[];
  for(let i=0;i<=6;i++)for(let j=i;j<=6;j++)d.push([i,j]);
  for(let i=d.length-1;i;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
  return d;
}

const handSum = h => h.reduce((s,[x,y])=>s+x+y,0);

function dealHands(room){
  const deck=newDeck();
  const seats=Object.keys(room.players);
  seats.forEach((s,i)=>{ room.players[s].hand = deck.slice(i*7,i*7+7); });
}

function placeTile(room, tile, sideHint){
  let [a,b]=tile, side=sideHint;
  if(!side) side = (a===room.rightEnd||b===room.rightEnd) ? 'right' : 'left';
  if(side==='left'){
    if(a===room.leftEnd){ room.board.unshift([b,a]); room.leftEnd=b; }
    else if(b===room.leftEnd){ room.board.unshift([a,b]); room.leftEnd=a; }
    else return false;
  }else{
    if(a===room.rightEnd){ room.board.push([a,b]); room.rightEnd=b; }
    else if(b===room.rightEnd){ room.board.push([b,a]); room.rightEnd=a; }
    else return false;
  }
  return true;
}

/* ---------- Timer helpers ---------- */
function startTurnTimer(roomId,room){
  if(room.passTimer) clearTimeout(room.passTimer);
  room.passTimer=setTimeout(()=>{
    io.in(roomId).emit('playerPassed', room.turn);
    room.passes++;
    advanceTurn(roomId, room);
  },90_000);
}

function advanceTurn(roomId,room){
  if(room.passTimer) clearTimeout(room.passTimer);
  while(true){
    room.turn = nextSeat(room.turn);
    const hand = room.players[room.turn].hand;
    const playable = hand.some(([x,y])=> x===room.leftEnd||y===room.leftEnd||x===room.rightEnd||y===room.rightEnd);
    if(playable){
      io.in(roomId).emit('turnChanged', room.turn);
      startTurnTimer(roomId, room);
      break;
    }else{
      io.in(roomId).emit('playerPassed', room.turn);
      room.passes++;
      if(room.passes===4){ handleTranca(roomId,room); return; }
    }
  }
}

function handleTranca(roomId,room){
  const closer   = room.lastPlayer;
  const nextCCW  = nextSeat(closer);
  const closerP  = handSum(room.players[closer].hand);
  const nextP    = handSum(room.players[nextCCW].hand);
  const winner   = closerP<=nextP?closer:nextCCW;
  const team     = winner%2;
  const points   = Object.values(room.players).reduce((s,p)=>s+handSum(p.hand),0);
  room.scores[team]+=points; room.lastWinner=winner;

  io.in(roomId).emit('roundEnded',{winner,reason:'Tranca',points,scores:room.scores,board:room.board});
  endOrReset(roomId,room,team);
}

/* ---------- Round reset / end ---------- */
function resetRound(roomId,room){
  dealHands(room);
  Object.assign(room,{
    board:[],leftEnd:null,rightEnd:null,
    pipCounts:{0:0,1:0,2:0,3:0,4:0,5:0,6:0},
    passes:0,lastPlayer:null,isFirst:false,
    turn:room.lastWinner??0
  });
  if(room.passTimer) clearTimeout(room.passTimer);

  for(const s in room.players){
    io.to(room.players[s].socketId).emit('gameStart',{
      yourHand:room.players[s].hand,
      startingSeat:room.turn,
      scores:room.scores
    });
  }
  io.in(roomId).emit('turnChanged', room.turn);
  startTurnTimer(roomId, room);
}

function endOrReset(roomId,room,winningTeam){
  if(room.scores[winningTeam]>=200){
    io.in(roomId).emit('gameOver',{winningTeam,scores:room.scores});
    delete rooms[roomId];
  }else{
    resetRound(roomId,room);
  }
}

/* ---------- SOCKET.IO ---------- */
io.on('connection', socket=>{

  socket.on('findRoom',({playerName})=>{
    let roomId = Object.keys(rooms).find(id=>Object.keys(rooms[id].players).length<4);
    if(!roomId){ roomId=`room${roomCounter++}`; createRoom(roomId); }
    const room=rooms[roomId]; socket.join(roomId);

    const seat=[0,1,2,3].find(s=>!room.players[s]);
    room.players[seat]={socketId:socket.id,hand:[],name:playerName||`P${seat}`};

    socket.emit('roomAssigned',{room:roomId});
    socket.emit('roomJoined',{seat});
    io.in(roomId).emit('lobbyUpdate',{
      players:Object.entries(room.players).map(([s,p])=>({seat:+s,name:p.name})),
      seatsRemaining:4-Object.keys(room.players).length
    });

    if(Object.keys(room.players).length===4){
      room.started=true; dealHands(room);
      const starter = room.isFirst
        ? +Object.keys(room.players).find(s=>room.players[s].hand.some(t=>t[0]===6&&t[1]===6))
        : room.lastWinner;
      room.turn=starter;
      for(const s in room.players){
        io.to(room.players[s].socketId).emit('gameStart',{
          yourHand:room.players[s].hand,
          startingSeat:starter,
          scores:room.scores
        });
      }
      io.in(roomId).emit('turnChanged',starter);
      startTurnTimer(roomId, room);
    }
  });

  /* ---------- playTile ---------- */
  socket.on('playTile',({roomId,seat,tile,side})=>{
    const room=rooms[roomId]; if(!room||!room.started) return;
    if(room.turn!==seat){ socket.emit('errorMessage','Not your turn'); return; }
    if(room.passTimer) clearTimeout(room.passTimer);

    const endsBefore=[room.leftEnd,room.rightEnd];
    /* first tile */
    if(room.board.length===0){
      if(room.isFirst && !(tile[0]===6&&tile[1]===6)){
        socket.emit('errorMessage','First move must be [6|6]'); return;
      }
      room.board.push(tile); room.leftEnd=tile[0]; room.rightEnd=tile[1];
    }else if(!placeTile(room,tile,side)){
      socket.emit('errorMessage','Tile does not fit'); return;
    }

    room.pipCounts[tile[0]]++; room.pipCounts[tile[1]]++;
    room.lastPlayer=seat; room.passes=0;
    const player=room.players[seat];
    player.hand = player.hand.filter(t=>!(t[0]===tile[0]&&t[1]===tile[1]));

    /* ---- Right-hand block bonus (opening only) ---- */
    if(room.board.length===1){
      const rightSeat=nextSeat(seat);
      if((seat%2)!==(rightSeat%2)){          // only if opponent
        const opp=room.players[rightSeat].hand;
        const [a,b]=tile;
        let bonus=0;
        if(a===b){
          if(!opp.some(([x,y])=>x===a||y===a)) bonus=30;
        }else{
          if(!opp.some(([x,y])=>[a,b].includes(x)||[a,b].includes(y))) bonus=60;
        }
        if(bonus){
          room.scores[seat%2]+=bonus;
          io.in(roomId).emit('message',`Right-hand block bonus +${bonus}`);
        }
      }
    }

    io.in(roomId).emit('broadcastMove',{seat,tile,board:room.board,pipCounts:room.pipCounts});

    /* ---- Player closed hand? ---- */
    if(player.hand.length===0){
      const capicua = endsBefore[0]!==endsBefore[1] && room.leftEnd===room.rightEnd;

      let paso=true;
      for(const s in room.players){
        if(+s===seat) continue;
        if(room.players[s].hand.some(([x,y])=>{
          return x===room.leftEnd||y===room.leftEnd||x===room.rightEnd||y===room.rightEnd;
        })){ paso=false; break; }
      }

      let points = Object.values(room.players).reduce((s,p)=>s+handSum(p.hand),0);
      if(capicua&&paso)      points+=60;
      else if(capicua||paso) points+=30;

      room.scores[seat%2]+=points; room.lastWinner=seat;

      io.in(roomId).emit('roundEnded',{
        winner:seat,reason:'Closed',capicua,paso,points,
        scores:room.scores,board:room.board
      });
      endOrReset(roomId,room,seat%2);
      return;
    }

    advanceTurn(roomId, room);
  });

  /* ---------- passTurn ---------- */
  socket.on('passTurn',({roomId,seat})=>{
    const room=rooms[roomId]; if(!room||!room.started) return;
    if(room.turn!==seat){ socket.emit('errorMessage','Not your turn'); return; }
    if(room.passTimer) clearTimeout(room.passTimer);

    room.passes++; io.in(roomId).emit('playerPassed',seat);
    if(room.passes===4) handleTranca(roomId,room);
    else advanceTurn(roomId, room);
  });

  /* ---------- disconnect ---------- */
  socket.on('disconnect',()=>{
    for(const rid in rooms){
      const r=rooms[rid];
      for(const s in r.players)
        if(r.players[s].socketId===socket.id) delete r.players[s];
      if(!Object.keys(r.players).length) delete rooms[rid];
    }
  });
});

/* ---------- Start server ---------- */
server.listen(PORT,()=>console.log(`Domino server on port ${PORT}`));
