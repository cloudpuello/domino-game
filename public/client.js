/* ------------------------------------------------------------------
   client.js – matches new server.js logic
   ------------------------------------------------------------------ */

const socket = io();

/* prompt for room & name */
const roomId     = prompt('Room?')      || 'room1';
const playerName = prompt('Name?')      || 'Anon';

/* local state */
let mySeat        = null;
let myHand        = [];
let boardState    = [];
let handCounts    = [0,0,0,0];    // how many tiles each seat holds
let currentTurn   = null;

/* DOM shortcuts */
const $ = id => document.getElementById(id);

/* helper – tile div (visible or back) */
function makeTile(text, isHidden=false){
  const d=document.createElement('div');
  d.style.display='inline-block';
  d.style.border='1px solid #000';
  d.style.padding='2px';
  d.style.margin='1px';
  d.textContent=isHidden? '■' : text;
  if(isHidden) d.style.opacity='0.4';
  return d;
}

/* ── renderers ────────────────────────────────────────────────────── */
function renderBoard(){
  $('board').innerHTML='';
  boardState.forEach(([a,b])=>{
    $('board').appendChild( makeTile(`${a}|${b}`) );
  });
}

function renderHands(){
  /* clear all four spots */
  ['yourHand','topPlayer','leftPlayer','rightPlayer']
    .forEach(id=>$(id).innerHTML='');

  for(let seat=0; seat<4; seat++){
    const rel=(4+seat-mySeat)%4;   // 0=you,1=right,2=top,3=left
    const container =
      rel===0 ? $('yourHand')  :
      rel===1 ? $('rightPlayer'):
      rel===2 ? $('topPlayer')  :
                $('leftPlayer');

    if(rel===0){   // your own tiles, show pips
      myHand.forEach((t,idx)=>{
        const div=makeTile(`${t[0]}|${t[1]}`);
        if(currentTurn===mySeat){
          div.style.cursor='pointer';
          div.onclick=()=>playTile(idx);
        }else{
          div.style.opacity='0.4';
        }
        container.appendChild(div);
      });
    }else{         // opponents – hidden
      for(let i=0;i<handCounts[seat];i++)
        container.appendChild( makeTile('', true) );
    }
  }
}

function updateScores(scores){
  $('scores').textContent=`Team 0: ${scores[0]} | Team 1: ${scores[1]}`;
}

/* ── socket event handlers ────────────────────────────────────────── */

socket.on('roomJoined',({seat})=>{
  mySeat=seat;
});

socket.on('gameStart',({yourHand,startingSeat,scores})=>{
  myHand    = yourHand;
  boardState=[];
  currentTurn=startingSeat;
  handCounts=[7,7,7,7];
  handCounts[mySeat]=myHand.length;

  $('messages').innerHTML='';
  $('pipCounts').innerHTML='';
  setStatus();
  updateScores(scores);
  renderBoard();
  renderHands();
});

socket.on('turnChanged', seat=>{
  currentTurn=seat;
  setStatus();
  renderHands();
});

socket.on('broadcastMove',({seat,tile,board,pipCounts})=>{
  boardState=board;
  renderBoard();

  /* update hand counts */
  if(seat!==mySeat) handCounts[seat]--;

  /* optional pip count display */
  $('pipCounts').textContent=
    Object.entries(pipCounts).map(([p,c])=>`${p}:${c}`).join(', ');

  renderHands();
});

socket.on('playerPassed', seat=>{
  appendMsg(`Seat ${seat} passed.`);
});

socket.on('message', text=>{
  appendMsg(text);
});

socket.on('roundEnded', ({winner,reason,capicua,points,scores,board,pipCounts})=>{
  boardState=board;
  renderBoard();
  updateScores(scores);

  let msg=`Round ended by ${reason}. Winner seat ${winner}. +${points} pts.`;
  if(capicua) msg+=' Capicúa (+30)!';
  appendMsg(msg);

  /* reset hand counts until next gameStart arrives */
});

socket.on('gameOver',({winningTeam,scores})=>{
  alert(`GAME OVER – Team ${winningTeam} wins!\nFinal: ${scores[0]}-${scores[1]}`);
});

/* ── helpers ───────────────────────────────────────────────────────── */

function setStatus(){
  $('status').textContent =
    currentTurn===mySeat ? 'Your turn!' : `Waiting… seat ${currentTurn}`;
}

function appendMsg(txt){
  const d=document.createElement('div');
  d.textContent=txt;
  $('messages').appendChild(d);
}

/* ── outgoing actions ─────────────────────────────────────────────── */

function playTile(idx){
  const tile=myHand[idx];
  /* ask side if tile fits both ends */
  let side=null;
  if(boardState.length){
    const L=boardState[0][0], R=boardState.at(-1)[1];
    const fitsLeft = tile[0]===L||tile[1]===L;
    const fitsRight= tile[0]===R||tile[1]===R;
    if(fitsLeft && fitsRight){
      side= confirm('Play on RIGHT side? (Can
