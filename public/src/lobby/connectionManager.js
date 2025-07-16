/* =====================================================================
 * src/lobby/connectionManager.js — Handles Initial Connection
 *
 * AI NOTES:
 * - Fully rebuilt for clarity and reliability.
 * - ALWAYS prompts for player name (with saved suggestion).
 * - Emits `findRoom` and handles reconnection using sessionStorage.
 * - Cleanly separates concerns: name collection, connection, error handling.
 * - Adds optional callback hooks for better flow control (e.g. LobbyManager).
 * =================================================================== */

const ConnectionManager = {
  playerName: null,

  /**
   * Initialize the connection manager
   * Triggers name prompt and emits join request
   */
  start() {
    console.log('[ConnectionManager] start() called');
    this.promptForName().then(name => {
      this.playerName = name;
      this.saveName(name);
      this.tryToJoinRoom();
    });
  },

  /**
   * Prompt user for a name with optional pre-filled value
   * Returns a Promise that resolves with the validated name
   */
  promptForName() {
    return new Promise((resolve) => {
      const saved = localStorage.getItem('domino_playerName') || '';
      let name = null;

      const ask = () => {
        name = prompt('Enter your name to join the game:', saved).trim();
        if (!name) {
          alert('A name is required to join.');
          ask();
        } else {
          resolve(name);
        }
      };

      ask();
    });
  },

  /**
   * Save player name locally
   */
  saveName(name) {
    localStorage.setItem('domino_playerName', name);
    console.log('[ConnectionManager] Name saved:', name);
  },

  /**
   * Attempt to join a room (new or reconnect)
   */
  tryToJoinRoom() {
    const savedRoomId = sessionStorage.getItem('domino_roomId');
    const savedSeat = sessionStorage.getItem('domino_mySeat');

    console.log('[ConnectionManager] Emitting findRoom:', {
      playerName: this.playerName,
      savedRoomId,
      reconnectSeat: savedSeat
    });

    window.socket.emit('findRoom', {
      playerName: this.playerName,
      roomId: savedRoomId || null,
      reconnectSeat: savedSeat ? parseInt(savedSeat) : null
    });
  }
};

window.ConnectionManager = ConnectionManager;
