Here's a comprehensive troubleshooting guide to add to your AI_NOTES_GPT4.md:
markdown## 🔥 CRITICAL TROUBLESHOOTING GUIDE

### Issue: "Game Not Rendering / Blank Screen"

**Check these in order:**

1. **Browser Console Errors** (F12)
   - Missing script? Check index.html script tags order
   - "Cannot read property of undefined"? Module initialization order wrong
   - Fix: All UI modules must load BEFORE game modules

2. **Module Load Order in index.html**
   ```html
   <!-- MUST BE IN THIS ORDER -->
   <script src="/socket.io/socket.io.js"></script>
   <script src="src/game/gameState.js"></script>
   <script src="src/ui/uiManager.js"></script>
   <script src="src/ui/boardRenderer.js"></script>
   <script src="src/ui/handRenderer.js"></script>
   <script src="src/lobby/connectionManager.js"></script>
   <script src="src/lobby/lobbyManager.js"></script>
   <script src="src/game/gameManager.js"></script>
   <script src="src/game/dragDropManager.js"></script>
   <script src="client.js"></script> <!-- LAST -->

DOM Elements Missing

Check all id="" in index.html match UIManager.elements
Missing: hand0, hand1, hand2, hand3, board, status, etc.



Issue: "Players Not Connecting / Game Won't Start"
Server-side fixes in server.js:
javascript// Problem: Game starts with < 4 players
// In findRoom handler, change:
if (targetRoom.isFull() && !targetRoom.isGameActive) {
  // TO THIS:
  const connectedPlayers = targetRoom.players.filter(p => p && p.connected);
  if (connectedPlayers.length === 4) {
    startGame(targetRoom);
  }
}

// Problem: isFull() returns true with null players
isFull() {
  return this.players.filter(p => p !== null).length === 4;
}
Client-side checks:

ConnectionManager MUST call promptForName() first
Check sessionStorage has roomId/seat for reconnection
Verify socket.emit('findRoom') includes playerName

Issue: "Dominoes Not Connecting in Snake Formation"
In boardRenderer.js - calculateSnakePositions():
javascript// Key variables that control layout:
const DOMINO_WIDTH = 40;      // Width of each domino
const DOMINO_HEIGHT = 80;     // Height of each domino  
const GAP = 2;                // Gap between dominoes
const MAX_WIDTH = 300;        // Max distance before new row
const ROW_HEIGHT = 100;       // Space between rows

// Fix orientation issues:
// Doubles (like 6|6) should have rotation = 90
// Regular tiles rotation = 0
// Turn tiles can have rotation = 45

// Fix positioning:
// First domino starts at: x = centerX - MAX_WIDTH
// Each domino adds: x += DOMINO_WIDTH + GAP
// New row: y += ROW_HEIGHT, x resets to start
Issue: "Score Not Updating"
Check this flow:

Server sends scores in:

roundStart → includes scores: [0, 0]
roundEnded → includes updated scores: [150, 75]
bonusAwarded → includes bonus scores


GameManager receives and updates:
javascripthandleRoundEnded(data) {
  GameState.updateScores(data.scores); // THIS LINE
  UIManager.updateScores(data.scores); // THIS LINE
}

UIManager displays:
javascriptupdateScores(scores) {
  if (this.elements.team0Score) {
    this.elements.team0Score.textContent = scores[0] || 0;
  }
  if (this.elements.team1Score) {
    this.elements.team1Score.textContent = scores[1] || 0;
  }
}


Issue: "Bonus Points Not Working"
Server-side in endRound():
javascriptfunction endRound(room, result) {
  const points = room.gameState.calculatePoints();
  const winningTeam = result.winner % 2;
  
  // Base points
  room.scores[winningTeam] += points;
  
  // CHECK FOR BONUSES HERE
  // Capicú bonus (25 points) - winning tile plays on both ends
  if (result.reason === 'domino') {
    const lastTile = room.gameState.board[room.gameState.board.length - 1];
    const firstTile = room.gameState.board[0];
    
    if (lastTile[1] === firstTile[0]) {
      room.scores[winningTeam] += 25;
      io.to(room.roomId).emit('bonusAwarded', {
        seat: result.winner,
        type: 'capicú',
        points: 25,
        scores: room.scores
      });
    }
  }
}
Issue: "Tiles Not Dragging"
Check HandRenderer.renderMyHand():
javascript// Must have these conditions:
if (GameState.isMyTurn()) {  // Only on your turn
  const isPlayable = GameState.isTilePlayable(domino);  // Tile must be valid
  if (isPlayable) {
    // Add BOTH listeners
    element.addEventListener('mousedown', e => {
      DragDropManager.startDrag(e, domino, element);
    });
    element.addEventListener('touchstart', e => {
      DragDropManager.startDrag(e, domino, element);
    }, { passive: false });
  }
}
Issue: "Wrong Player Hand Position"
UIManager.remapPositions() must be called:
javascript// In lobbyManager.js - handleRoomJoined()
handleRoomJoined(data) {
  GameState.setRoomInfo(data.roomId, data.seat);
  UIManager.updatePlayerInfo(data.seat);  // THIS CALLS remapPositions
}

// The remapping formula:
const positions = ['bottom', 'left', 'top', 'right'];
const rotation = (4 - mySeat) % 4;
// This ensures YOUR hand is always at bottom
Issue: "Reconnection Not Working"
Must preserve session data:
javascript// In lobbyManager - handleRoomJoined()
sessionStorage.setItem('domino_roomId', data.roomId);
sessionStorage.setItem('domino_mySeat', data.seat.toString());

// In connectionManager - attemptConnection()
const savedRoomId = sessionStorage.getItem('domino_roomId');
const savedSeat = sessionStorage.getItem('domino_mySeat');
// These MUST be sent in findRoom emit
Issue: "Pass Turn Not Working"
Add to gameManager.js:
javascript// In handleTurnChanged()
if (!hasValidMoves) {
  setTimeout(() => {
    if (confirm('No valid moves. Pass?')) {
      window.socket.emit('passPlay', {  // THIS EVENT
        roomId: GameState.roomId,
        seat: GameState.mySeat
      });
    }
  }, 500);
}
Server must handle:
javascriptsocket.on('passPlay', ({ roomId, seat }) => {
  // Increment pass counter
  room.gameState.consecutivePasses++;
  room.gameState.advanceTurn();
  
  // Check if all passed (blocked game)
  if (room.gameState.consecutivePasses >= 4) {
    const result = room.gameState.checkRoundEnd();
    endRound(room, result);
  }
});
🎯 Quick Debug Checklist

Open Browser Console - Any red errors?
Check Network Tab - Socket.IO connecting?
Add Console Logs:
javascriptconsole.log('GameState:', GameState);  // Has data?
console.log('Board:', GameState.boardState);  // Shows tiles?
console.log('My seat:', GameState.mySeat);  // 0-3?
console.log('Current turn:', GameState.currentTurn);  // Matches?

Verify 4 Players:

All 4 browser tabs open?
All entered names?
Check lobby shows 4/4?


Test Order:

Player with 6|6 goes first?
Turns advance clockwise?
Scores update after round?



🚨 Emergency Fixes
"Nothing works!"
bash# Clear everything and restart
rm -rf node_modules
npm install express socket.io
# Clear browser cache/localStorage
# Restart server
"Still broken!"

Check server.js has app.use(express.static('public'));
Verify all files are in public/ folder
Try http://localhost:3000 not file://
Open 4 incognito windows (no cache)

Remember: Most issues are either wrong load order, missing DOM elements, or server not checking for 4 players properly!

Add this to your AI_NOTES_GPT4.md file. This comprehensive guide will help ChatGPT fix any issue without needing to see all your code!