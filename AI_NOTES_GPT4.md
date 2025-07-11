# Dominican Domino Game - ChatGPT 4.0 Development Guide

## 🎯 Quick Context for GPT-4

This is a **modular, real-time multiplayer Dominican Domino game** using Socket.IO. The codebase is specifically structured so you can modify individual modules without breaking others.

### Key Architecture Points:
- **NO ES6 IMPORTS** - Uses global objects instead (browser compatibility)
- **Each file has ONE job** - Never mix concerns
- **GameState is the single source of truth** - All modules read from it
- **UIManager handles ALL DOM updates** - Never update DOM elsewhere
- **Socket events are isolated by module** - Each module handles its own events

## 📁 File Structure & Responsibilities

```
/public
  client.js                    → Bootstrap only (just starts modules)
  /src
    /lobby
      connectionManager.js     → ALWAYS prompts for name, handles connection
      lobbyManager.js         → Room joining, shows 4-player lobby
    /game  
      gameState.js            → Central data store (never update DOM here)
      gameManager.js          → Game events (roundStart, moves, turns)
      dragDropManager.js      → Drag & drop domino functionality
    /ui
      uiManager.js            → ALL DOM updates, position remapping
      boardRenderer.js        → Snake formation board display
      handRenderer.js         → Player hands (yours visible, others hidden)
```

## 🔧 Common Modification Requests

### 1. "Change the winning score from 200 to 100"

**Files to modify:**
- `server.js` - Change `WINNING_SCORE = 100`
- `gameManager.js` - Update any UI text mentioning "200"

```javascript
// In server.js
const WINNING_SCORE = 100; // Changed from 200
```

### 2. "Add sound effects when playing tiles"

**Create new file:** `public/src/ui/soundManager.js`

```javascript
const SoundManager = {
  sounds: {
    tilePlace: new Audio('/assets/sounds/tilePlace.mp3'),
    yourTurn: new Audio('/assets/sounds/yourTurn.mp3')
  },
  
  playSound(soundName) {
    if (this.sounds[soundName]) {
      this.sounds[soundName].play();
    }
  }
};
```

**Then modify:**
- `index.html` - Add `<script src="src/ui/soundManager.js"></script>`
- `gameManager.js` - In `handleBroadcastMove()`, add: `SoundManager.playSound('tilePlace');`

### 3. "Show player names instead of seat numbers"

**Modify these methods:**
- `lobbyManager.js` - `updateLobbyDisplay()` already shows names
- `uiManager.js` - In `remapPositions()`, update the label logic
- `gameManager.js` - In message handlers, use player names from `LobbyManager.players`

### 4. "Add a chat system"

**Create new file:** `public/src/ui/chatManager.js`

```javascript
const ChatManager = {
  init() {
    // Add chat UI elements
    const chatBox = document.createElement('div');
    chatBox.id = 'chatBox';
    chatBox.innerHTML = `
      <div id="chatMessages"></div>
      <input type="text" id="chatInput" placeholder="Type message...">
    `;
    document.querySelector('.info-panel').appendChild(chatBox);
    
    // Listen for enter key
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
    
    // Socket listener
    window.socket.on('chatMessage', this.handleChatMessage.bind(this));
  },
  
  sendMessage() {
    const input = document.getElementById('chatInput');
    if (input.value.trim()) {
      window.socket.emit('chat', {
        roomId: GameState.roomId,
        message: input.value
      });
      input.value = '';
    }
  },
  
  handleChatMessage(data) {
    const messages = document.getElementById('chatMessages');
    messages.innerHTML += `<div><b>${data.name}:</b> ${data.message}</div>`;
    messages.scrollTop = messages.scrollHeight;
  }
};
```

### 5. "Fix: Game starts with less than 4 players"

**Issue is in:** `server.js`

Look for the `startGame` condition and ensure it checks for exactly 4 connected players:

```javascript
// In server.js - findRoom handler
if (targetRoom.isFull() && !targetRoom.isGameActive) {
  // Add extra check for all connected
  const allConnected = targetRoom.players.every(p => p && p.connected);
  if (allConnected) {
    startGame(targetRoom);
  }
}
```

## ⚠️ Critical Rules for GPT-4

### 1. **NEVER modify GameState directly from UI modules**
```javascript
// ❌ WRONG - in boardRenderer.js
GameState.boardState.push(newDomino);

// ✅ CORRECT - only read from GameState
const board = GameState.boardState; // Read only!
```

### 2. **ALWAYS use UIManager for DOM updates**
```javascript
// ❌ WRONG - in gameManager.js  
document.getElementById('status').textContent = 'Your turn';

// ✅ CORRECT
UIManager.setStatus('Your turn');
```

### 3. **Socket events stay in their module**
```javascript
// ❌ WRONG - putting game events in lobbyManager.js
window.socket.on('roundStart', ...); 

// ✅ CORRECT - game events in gameManager.js
// Each module handles its own socket events
```

### 4. **ConnectionManager MUST prompt for name**
```javascript
// The game will break if you skip name prompt
// ConnectionManager.start() MUST call promptForName() first
```

## 🐛 Common Issues & Fixes

### "Players not connecting"
1. Check `ConnectionManager.promptForName()` is called
2. Verify `window.socket` is initialized before modules
3. Check server.js is serving static files correctly

### "Hand not showing at bottom"
1. Check `UIManager.remapPositions()` is called after `roomJoined`
2. Verify hand elements exist in DOM before remapping

### "Drag not working"
1. Check `GameState.isMyTurn()` returns true
2. Verify `GameState.isTilePlayable()` logic
3. Check event listeners in `HandRenderer.renderMyHand()`

### "Game starts too early"
1. In server.js, check room.isFull() logic
2. Verify all 4 players are connected, not just joined

## 📝 Module Communication Pattern

```
User Action → Module → GameState → UIManager → DOM

Example flow:
1. User drags tile → DragDropManager
2. DragDrop emits socket event → Server
3. Server broadcasts → GameManager  
4. GameManager updates → GameState
5. GameManager calls → UIManager/Renderers
6. UI updates → DOM
```

## 🚀 Adding New Features

### Step 1: Decide which module
- Connection/room logic? → `/lobby/`
- Game rules/state? → `/game/`  
- Visual/display? → `/ui/`

### Step 2: Create new file if needed
- One feature = one file
- Export as global object (no ES6 modules)

### Step 3: Initialize in client.js
- Add initialization in correct order
- UI modules before game modules

### Step 4: Update index.html
- Add script tag in correct section
- Maintain load order

## 💡 Pro Tips for GPT-4

1. **Read GameState.js first** - It shows all available data
2. **Check UIManager.elements** - Shows all DOM elements
3. **Follow the socket event flow** - Client emit → Server handle → Broadcast → Client handle
4. **Test with 4 browser tabs** - Open 4 instances for full game test
5. **Use console.log liberally** - Each module logs its actions

## 🎮 Game Rules Reference

- **Teams**: Seats 0&2 vs 1&3
- **Starting**: Player with [6,6] goes first  
- **Winning**: First team to 200 points (configurable)
- **Scoring**: Sum of all remaining tiles when someone goes out
- **Board**: Snake formation, left-to-right then down

Remember: This architecture lets you modify one file without breaking others. Always think "What is this module's ONE job?" before making changes.

User Action → Module → GameState → UIManager → DOM

Example flow:
1. User drags tile → DragDropManager
2. DragDrop emits socket event → Server
3. Server broadcasts → GameManager  
4. GameManager updates → GameState
5. GameManager calls → UIManager/Renderers
6. UI updates → DOM