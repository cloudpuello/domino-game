/* =====================================================================
 * client.js — Bootstrap File Only
 * 
 * AI NOTES:
 * - This file ONLY initializes modules, doesn't contain any logic
 * - All connection logic is in /src/lobby/
 * - All game logic is in /src/game/
 * - All UI updates are in /src/ui/
 * =================================================================== */

// Global socket instance that modules will use
window.socket = null;

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing Dominican Domino...');
  
  // Create socket connection
  window.socket = io();
  
  // Initialize modules in order
  try {
    // 1. Initialize UI first
    UIManager.init();
    
    // 2. Initialize game state
    GameState.init();
    
    // 3. Initialize lobby connection
    LobbyManager.init();
    
    // 4. Initialize game manager
    GameManager.init();
    
    // 5. Start the connection process
    ConnectionManager.start();
    
    console.log('All modules initialized successfully');
  } catch (error) {
    console.error('Failed to initialize:', error);
    alert('Failed to initialize game. Please refresh the page.');
  }
});