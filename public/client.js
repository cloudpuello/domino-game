/* =========================================================================
   client.js — (Magnet-Zone Drop Patch • 2025-07-08)
   =========================================================================
   – Bigger invisible hit-boxes around both board ends (±25 px padding)
   – Everything else from your previous build is unchanged
   ======================================================================= */

const socket     = io();
const playerName = prompt("Enter your name:") || "Anonymous";

/* -------------------------------------------------------------------------- */
/* Local state                                                                */
/* -------------------------------------------------------------------------- */
let roomId      = null;
let mySeat      = null;
let currentTurn = null;
let myHand      = [];
let boardState  = [];
let scores      = [0, 0];
let seatMap     = {};
let handSizes   = {};

/* Temp holder for drag-and-drop */
let dragged = {
  element: null,
  originalTile: null,
  tileData: null,
  isDragging: false,
  hoveredSide: null
};

/* -------------------------------------------------------------------------- */
/* DOM references                                                             */
/* -------------------------------------------------------------------------- */
const $ = (id) => document.getElementById(id);
const statusEl = $("status"),    boardEl = $("board"),   handEl  = $("hand");
const lobbyListEl = $("lobbyList"), lobbyContainerEl = $("lobbyContainer");
const playerInfoEl = $("playerInfo"), errorsEl = $("errors"),  msgEl = $("messages"), pipEl = $("pipCounts");
const topEl = $("topPlayer"), leftEl = $("leftPlayer"), rightEl = $("rightPlayer");
const team0ScoreEl = $("team0-score"), team1ScoreEl = $("team1-score");

/* -------------------------------------------------------------------------- */
/* Reconnect                                                                  */
/* -------------------------------------------------------------------------- */
socket.emit("findRoom", {
  playerName,
  roomId:        sessionStorage.getItem("domino_roomId"),
  reconnectSeat: sessionStorage.getItem("domino_mySeat")
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */
const setStatus = (txt) => statusEl.textContent = txt;
const showError = (txt) => { errorsEl.textContent = txt; setTimeout(()=> errorsEl.textContent = "", 4000); };
const addMsg    = (txt) => { const div = document.createElement("div"); div.textContent = txt; msgEl.prepend(div); };

/* -------------------------------------------------------------------------- */
/* Board centring                                                             */
/* -------------------------------------------------------------------------- */
function adjustBoardCenter() {
  boardEl.classList.toggle("board-center", boardEl.scrollWidth <= boardEl.clientWidth);
}
window.addEventListener("resize", adjustBoardCenter);

/* -------------------------------------------------------------------------- */
/* Board / placeholder render                                                 */
/* -------------------------------------------------------------------------- */
function renderPlaceholder() {
  const ph = document.createElement("div");
  ph.className   = "tile-placeholder drop-target";
  ph.dataset.side = "left";
  ph.textContent = (scores[0]===0 && scores[1]===0) ? "6|6" : "PLAY";
  boardEl.appendChild(ph);
}

function renderBoard() {
  boardEl.innerHTML = "";
  if (boardState.length === 0) {
    renderPlaceholder();
  } else {
    boardState.forEach(t => {
      const tile = document.createElement("div");
      tile.className = "tile disabled";
      if (t[0]===t[1]) tile.classList.add("double");
      tile.innerHTML = `<span>${t[0]}</span><span>${t[1]}</span>`;
      boardEl.appendChild(tile);
    });
  }
  adjustBoardCenter();
}

/* -------------------------------------------------------------------------- */
/* Hand rendering                                                             */
/* -------------------------------------------------------------------------- */
function getBoardEnds() {
  if (boardState.length === 0) return null;
  return {
    leftTile:  boardEl.firstChild,
    leftPip :  boardState[0][0],
    rightTile: boardEl.lastChild,
    rightPip : boardState.at(-1)[1]
  };
}

function isTilePlayable([a,b], ends) {
  const firstRound = scores[0]===0 && scores[1]===0 && boardState.length===0;
  if (firstRound) return a===6 && b===6;
  if (!ends) return true;
  return a===ends.leftPip || b===ends.leftPip || a===ends.rightPip || b===ends.rightPip;
}

function renderHand(){
  handEl.innerHTML="";
  const ends=getBoardEnds();
  myHand.forEach(t=>{
    const d=document.createElement("div");
    d.className="tile";
    d.innerHTML=`<span>${t[0]}</span><span>${t[1]}</span>`;
    const playable=isTilePlayable(t,ends);
    if(currentTurn===mySeat){
      if(playable){
        d.classList.add("playable");
        d.addEventListener("mousedown",e=>handleDragStart(e,t,d));
        d.addEventListener("touchstart",e=>handleDragStart(e,t,d),{passive:false});
        d.addEventListener("dragstart",e=>e.preventDefault());
      }else d.classList.add("disabled");
    }else d.classList.add("disabled");
    handEl.appendChild(d);
  });
}

/* -------------------------------------------------------------------------- */
/* Drag helpers                                                               */
/* -------------------------------------------------------------------------- */
function getEventPos(e){
  return e.touches?{x:e.touches[0].clientX,y:e.touches[0].clientY}:{x:e.clientX,y:e.clientY};
}
function moveDragged(x,y){
  if(dragged.element){ dragged.element.style.left=`${x}px`; dragged.element.style.top=`${y}px`; }
}

/* Expand the bounding‐box by 25 px on every side */
const HIT_PADDING = 25;

function pointInsideExpandedRect(p, r){
  return p.x > r.left - HIT_PADDING &&
         p.x < r.right + HIT_PADDING &&
         p.y > r.top  - HIT_PADDING &&
         p.y < r.bottom+ HIT_PADDING;
}

/* -------------------------------------------------------------------------- */
/* Highlight ends                                                             */
/* -------------------------------------------------------------------------- */
function highlightPlayableEnds([a,b]){
  const ends=getBoardEnds();
  if(!ends) return;
  if(a===ends.leftPip || b===ends.leftPip){
    ends.leftTile.classList.add("drop-target");
    ends.leftTile.dataset.side="left";
  }
  if(a===ends.rightPip || b===ends.rightPip){
    ends.rightTile.classList.add("drop-target");
    ends.rightTile.dataset.side="right";
  }
}

/* -------------------------------------------------------------------------- */
/* Drag-and-drop lifecycle                                                    */
/* -------------------------------------------------------------------------- */
function cleanupDrag(){
  if(dragged.element) dragged.element.remove();
  document.querySelectorAll(".drop-target").forEach(el=>{
    el.classList.remove("drop-target","drop-hover");
    el.removeAttribute("data-side");
  });
  if(dragged.originalTile) dragged.originalTile.classList.remove("ghost");
  document.removeEventListener("mousemove",handleDragMove);
  document.removeEventListener("mouseup",handleDragEnd);
  document.removeEventListener("touchmove",handleDragMove);
  document.removeEventListener("touchend",handleDragEnd);
  dragged={element:null,originalTile:null,tileData:null,isDragging:false,hoveredSide:null};
}

function handleDragStart(e,tileData,tileEl){
  if(e.type==="touchstart") e.preventDefault();
  if(dragged.isDragging) return;

  dragged={tileData,originalTile:tileEl,isDragging:true,hoveredSide:null};
  dragged.element=tileEl.cloneNode(true);
  dragged.element.classList.add("dragging");
  document.body.appendChild(dragged.element);
  tileEl.classList.add("ghost");

  highlightPlayableEnds(tileData);

  const pos=getEventPos(e); moveDragged(pos.x,pos.y);

  document.addEventListener("mousemove",handleDragMove);
  document.addEventListener("mouseup",handleDragEnd);
  document.addEventListener("touchmove",handleDragMove,{passive:false});
  document.addEventListener("touchend",handleDragEnd);
}

function handleDragMove(e){
  if(!dragged.isDragging) return;
  e.preventDefault();
  const pos=getEventPos(e);
  moveDragged(pos.x,pos.y);

  let onTarget=false;
  document.querySelectorAll(".drop-target").forEach(t=>{
    const r=t.getBoundingClientRect();
    if(pointInsideExpandedRect(pos,r)){
      onTarget=true;
      dragged.hoveredSide=t.dataset.side;
      t.classList.add("drop-hover");
    }else{
      t.classList.remove("drop-hover");
    }
  });
  if(!onTarget) dragged.hoveredSide=null;
}

function handleDragEnd(){
  if(!dragged.isDragging) return;
  const {originalTile,tileData,hoveredSide}=dragged;
  const side = hoveredSide || (boardState.length===0 ? "left" : null);
  if(side){
    socket.emit("playTile",{ roomId, seat:mySeat, tile:tileData, side });
  }else{
    originalTile.classList.remove("ghost");
  }
  cleanupDrag();
}

/* -------------------------------------------------------------------------- */
/* Socket.IO events  (unchanged from your build)                              */
/* -------------------------------------------------------------------------- */
socket.on("roomJoined",({roomId:id,seat})=>{
  roomId=id; mySeat=seat;
  sessionStorage.setItem("domino_roomId",roomId);
  sessionStorage.setItem("domino_mySeat",mySeat);
  playerInfoEl.textContent=`You are Seat ${seat} (Team ${seat%2===0?"0 & 2":"1 & 3"})`;
});

socket.on("lobbyUpdate",({players})=>{
  lobbyContainerEl.style.display="block";
  seatMap=Object.fromEntries(players.map(p=>[p.seat,p]));
  lobbyListEl.innerHTML=""; players.forEach(p=>{ const li=document.createElement("li"); li.textContent=`Seat ${p.seat}: ${p.name}`; lobbyListEl.appendChild(li); });
});

socket.on("roundStart",({yourHand,startingSeat,scores:s})=>{
  lobbyContainerEl.style.display="none";
  myHand=yourHand; boardState=[]; scores=s; currentTurn=startingSeat;
  msgEl.innerHTML=""; handSizes={0:7,1:7,2:7,3:7};
  cleanupDrag(); renderScores(); renderBoard(); renderHand(); renderOpponents();
  setStatus(currentTurn===mySeat?"Your turn!":`Waiting for seat ${currentTurn}`);
});

socket.on("updateHand",hand=>{ myHand=hand; handSizes[mySeat]=hand.length; renderHand(); renderOpponents(); });

socket.on("broadcastMove",({seat,tile,board,pipCounts})=>{
  boardState=board; if(seat!==mySeat) handSizes[seat]--;
  cleanupDrag(); renderBoard(); renderPips(pipCounts); renderOpponents();
  addMsg(`${seat} played ${tile[0]}|${tile[1]}.`);
});

socket.on("turnChanged",turn=>{
  currentTurn=turn; setStatus(turn===mySeat?"Your turn!":`Waiting for seat ${turn}`);
  cleanupDrag(); renderHand();
  [topEl,leftEl,rightEl,handEl].forEach(el=>el.classList.remove("active-turn-indicator"));
  const pos= seatPos(turn);
  if(pos==="top")      topEl.classList.add("active-turn-indicator");
  else if(pos==="left") leftEl.classList.add("active-turn-indicator");
  else if(pos==="right")rightEl.classList.add("active-turn-indicator");
  else                  handEl.classList.add("active-turn-indicator");
});

socket.on("playerPassed",({seat})=> addMsg(`Seat ${seat} passed.`));

socket.on("roundEnded",({winner,reason,points,scores:s,board})=>{
  boardState=board; scores=s;
  cleanupDrag(); renderScores(); renderBoard();
  const msg=`Seat ${winner} wins (${reason}) +${points} pts.`; setStatus(msg); addMsg(msg);
});

socket.on("gameOver",({winningTeam,scores:s})=>{
  sessionStorage.removeItem("domino_roomId");
  sessionStorage.removeItem("domino_mySeat");
  alert(`Game over! Team ${winningTeam} wins.\\nScores: ${s.join(" / ")}`);
  setStatus("Game over.");
});

socket.on("reconnectSuccess",()=> console.log("Reconnected"));
socket.on("errorMessage",showError);
socket.on("bonusAwarded",({seat,type,points,scores:s})=>{
  scores=s; renderScores(); addMsg(`Team ${seat%2} gets +${points} pts for ${type}!`);
});

/* -------------------------------------------------------------------------- */
/* Opponent rendering helpers                                                 */
/* (kept at end so code stays one compact file)                               */
/* -------------------------------------------------------------------------- */
function seatPos(seat){
  if(seat===mySeat) return "self";
  const diff=(seat-mySeat+4)%4;
  return diff===1 ? "right" : diff===2 ? "top" : "left";
}
function renderOpponents(){
  const areas={top:topEl,left:leftEl,right:rightEl};
  Object.values(areas).forEach(el=>el.innerHTML="");
  Object.entries(seatMap).forEach(([s,info])=>{
    s=+s; if(s===mySeat) return;
    const area=areas[ seatPos(s) ]; if(!area) return;
    const n=document.createElement("div"); n.textContent=`${info.name} (Seat ${s})`; area.appendChild(n);
    const hd=document.createElement("div"); hd.className="player-area-hand-display";
    const cnt=handSizes[s]||0; for(let i=0;i<cnt;i++){ const d=document.createElement("div"); d.className="dummy-tile"; hd.appendChild(d);}
    area.appendChild(hd);
  });
}
function renderScores(){ team0ScoreEl.textContent=scores[0]; team1ScoreEl.textContent=scores[1]; }
function renderPips(c){ pipEl.textContent=c?Object.entries(c).map(([p,n])=>`${p}:${n}`).join(" | "):""; }
