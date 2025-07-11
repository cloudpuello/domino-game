/* =====================================================================
 * src/lobby/lobbyManager.js — Handles Lobby Events
 * 
 * AI NOTES:
 * - Manages room joining
 * - Updates lobby display
 * - Ensures 4 players before starting
 * =================================================================== */

const LobbyManager = {
  currentRoom: null,
  players: [],
  
  /**
   * Initialize lobby event listeners
   */
  init() {
    console.log('LobbyManager: Initializing');
    
    // Set up socket listeners
    window.socket.on('roomJoined', this.handleRoomJoined.bind(this));
    window.socket.on('lobbyUpdate', this.handleLobbyUpdate.bind(this));
    window.socket.on('reconnectSuccess', this.handleReconnectSuccess.bind(this));
  },
  
  /**
   * Handle successful room join
   */
  handleRoomJoined(data) {
    console.log('LobbyManager: Joined room', data);
    
    // Save room info
    this.currentRoom = data.roomId;
    GameState.setRoomInfo(data.roomId, data.seat);
    
    // Save to session for reconnection
    sessionStorage.setItem('domino_roomId', data.roomId);
    sessionStorage.setItem('domino_mySeat', data.seat.toString());
    
    // Update UI
    UIManager.updatePlayerInfo(data.seat);
    UIManager.addMessage(`Joined room as Seat ${data.seat}`);
  },
  
  /**
   * Handle lobby updates
   */
  handleLobbyUpdate(data) {
    console.log('LobbyManager: Lobby update', data);
    
    // Update player list
    this.players = data.players || [];
    
    // Update UI
    this.updateLobbyDisplay();
    
    // Check player count
    const connectedCount = this.players.filter(p => p && p.connected).length;
    UIManager.setStatus(`Waiting for players... (${connectedCount}/4)`);
    
    // Show warning if not enough players
    if (connectedCount < 4) {
      UIManager.showLobby(true);
    }
  },
  
  /**
   * Update lobby display
   */
  updateLobbyDisplay() {
    const lobbyList = document.getElementById('lobbyList');
    if (!lobbyList) return;
    
    lobbyList.innerHTML = '';
    
    // Show all 4 seats
    for (let seat = 0; seat < 4; seat++) {
      const player = this.players.find(p => p && p.seat === seat);
      const li = document.createElement('li');
      
      if (player) {
        li.textContent = `Seat ${seat}: ${player.name}`;
        if (!player.connected) {
          li.textContent += ' (disconnected)';
          li.style.opacity = '0.5';
        }
        if (seat === GameState.mySeat) {
          li.style.fontWeight = 'bold';
          li.textContent += ' (You)';
        }
      } else {
        li.textContent = `Seat ${seat}: [Waiting for player]`;
        li.style.opacity = '0.5';
      }
      
      lobbyList.appendChild(li);
    }
  },
  
  /**
   * Handle successful reconnection
   */
  handleReconnectSuccess() {
    console.log('LobbyManager: Reconnected successfully');
    UIManager.addMessage('Reconnected to game');
    UIManager.hideError();
  }
};