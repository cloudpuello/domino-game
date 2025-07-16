/* =====================================================================
 * src/lobby/lobbyManager.js — Handles Lobby Events
 * 
 * AI NOTES:
 * - Manages room join events and reconnection
 * - Keeps track of current players and seats
 * - Triggers game start automatically when 4 players connect
 * - Updates UI lobby list and player status
 * =================================================================== */

const LobbyManager = {
  currentRoom: null,
  players: [],

  /**
   * Initialize socket listeners related to lobby behavior
   */
  init() {
    console.log('LobbyManager: Initializing');

    window.socket.on('roomJoined', this.handleRoomJoined.bind(this));
    window.socket.on('lobbyUpdate', this.handleLobbyUpdate.bind(this));
    window.socket.on('reconnectSuccess', this.handleReconnectSuccess.bind(this));
  },

  /**
   * Handle when client joins a room successfully
   */
  handleRoomJoined(data) {
    console.log('LobbyManager: Joined room', data);

    this.currentRoom = data.roomId;
    GameState.setRoomInfo(data.roomId, data.seat);

    sessionStorage.setItem('domino_roomId', data.roomId);
    sessionStorage.setItem('domino_mySeat', data.seat.toString());

    UIManager.updatePlayerInfo(data.seat);
    UIManager.addMessage(`Joined room as Seat ${data.seat}`);
  },

  /**
   * Handle lobby update (sent when players connect/disconnect)
   */
  handleLobbyUpdate(data) {
    console.log('LobbyManager: Lobby update', data);

    this.players = data.players || [];
    this.updateLobbyDisplay();

    const connectedCount = this.players.filter(p => p && p.connected).length;
    UIManager.setStatus(`Waiting for players... (${connectedCount}/4)`);

    if (connectedCount < 4) {
      UIManager.showLobby(true);
    } else {
      // Auto-start game once 4 players are connected
      UIManager.setStatus("All players connected. Starting game...");
      UIManager.showLobby(false);

      // Tell server to start the game
      window.socket.emit('startGame', {
        roomId: this.currentRoom
      });
    }
  },

  /**
   * Render the current state of the lobby player list
   */
  updateLobbyDisplay() {
    const lobbyList = document.getElementById('lobbyList');
    if (!lobbyList) return;

    lobbyList.innerHTML = '';

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
          li.textContent += ' (You)';
          li.style.fontWeight = 'bold';
        }
      } else {
        li.textContent = `Seat ${seat}: [Waiting for player]`;
        li.style.opacity = '0.5';
      }

      lobbyList.appendChild(li);
    }
  },

  /**
   * Handle a successful reconnection (restores seat)
   */
  handleReconnectSuccess() {
    console.log('LobbyManager: Reconnected successfully');
    UIManager.addMessage('Reconnected to game');
    UIManager.hideError();
  }
};

window.LobbyManager = LobbyManager;
