/* =====================================================================
 * src/lobby/connectionManager.js — Handles Initial Connection
 * 
 * AI NOTES:
 * - ALWAYS prompts for player name
 * - Handles initial room finding
 * - Manages reconnection attempts
 * =================================================================== */

const ConnectionManager = {
  playerName: null,
  
  /**
   * Start the connection process
   * ALWAYS prompts for name first
   */
  start() {
    console.log('ConnectionManager: Starting connection process');
    
    // Always get player name first
    this.promptForName();
  },
  
  /**
   * Prompt for player name
   * This MUST happen before any connection
   */
  promptForName() {
    // Check if we have a saved name
    const savedName = localStorage.getItem('domino_playerName');
    
    // Always prompt, but suggest saved name
    const name = prompt(
      'Enter your name:', 
      savedName || ''
    );
    
    // Validate name
    if (!name || name.trim() === '') {
      // If no name, try again
      alert('You must enter a name to play!');
      this.promptForName();
      return;
    }
    
    // Save name
    this.playerName = name.trim();
    localStorage.setItem('domino_playerName', this.playerName);
    
    console.log('ConnectionManager: Player name set to', this.playerName);
    
    // Now try to connect
    this.attemptConnection();
  },
  
  /**
   * Attempt to connect to a room
   */
  attemptConnection() {
    // Check for existing session
    const savedRoomId = sessionStorage.getItem('domino_roomId');
    const savedSeat = sessionStorage.getItem('domino_mySeat');
    
    console.log('ConnectionManager: Attempting connection', {
      playerName: this.playerName,
      savedRoomId,
      savedSeat
    });
    
    // Emit findRoom event
    window.socket.emit('findRoom', {
      playerName: this.playerName,
      roomId: savedRoomId,
      reconnectSeat: savedSeat ? parseInt(savedSeat) : null
    });
  }
};

window.ConnectionManager = ConnectionManager;

