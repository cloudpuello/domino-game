/* =====================================================================
 * client.js — Bootstrap File Only (COMPLETELY FIXED)
 * 
 * FIXES APPLIED:
 * - Better error handling during initialization
 * - Improved module loading order
 * - Better connection management
 * - Added debug capabilities
 * 
 * AI NOTES:
 * - This file ONLY initializes modules, doesn't contain any logic
 * - All connection logic is in /src/lobby/
 * - All game logic is in /src/game/
 * - All UI updates are in /src/ui/
 * =================================================================== */

// Global socket instance that modules will use
window.socket = null;

// Global debug flag
window.DEBUG_DOMINO = false;

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Dominican Domino: Starting initialization...');
  
  try {
    // Create socket connection first
    console.log('Creating socket connection...');
    window.socket = io();
    
    // Set up basic socket event listeners for debugging
    window.socket.on('connect', () => {
      console.log('Socket connected successfully');
    });
    
    window.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      UIManager.showError('Connection lost. Please refresh the page.');
    });
    
    window.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      UIManager.showError('Failed to connect to server. Please refresh and try again.');
    });
    
    // Initialize modules in the correct order
    console.log('Initializing UI Manager...');
    if (typeof UIManager !== 'undefined') {
      UIManager.init();
    } else {
      throw new Error('UIManager not loaded');
    }
    
    console.log('Initializing Game State...');
    if (typeof GameState !== 'undefined') {
      GameState.init();
    } else {
      throw new Error('GameState not loaded');
    }
    
    console.log('Initializing Lobby Manager...');
    if (typeof LobbyManager !== 'undefined') {
      LobbyManager.init();
    } else {
      throw new Error('LobbyManager not loaded');
    }
    
    console.log('Initializing Game Manager...');
    if (typeof GameManager !== 'undefined') {
      GameManager.init();
    } else {
      throw new Error('GameManager not loaded');
    }
    
    // Wait a moment for socket to establish connection
    console.log('Starting connection process...');
    setTimeout(() => {
      if (typeof ConnectionManager !== 'undefined') {
        ConnectionManager.start();
      } else {
        throw new Error('ConnectionManager not loaded');
      }
    }, 500);
    
    console.log('All modules initialized successfully');
    
    // Set up global debug functions
    window.debugDomino = {
      gameState: () => GameState.debugState(),
      lobby: () => LobbyManager.debugLobbyState(),
      connection: () => ConnectionManager.debugConnection(),
      gameStatus: () => GameManager.getGameStatus(),
      toggleDebug: () => {
        window.DEBUG_DOMINO = !window.DEBUG_DOMINO;
        console.log('Debug mode:', window.DEBUG_DOMINO ? 'ON' : 'OFF');
      }
    };
    
    // Show debug help
    console.log('%cDominican Domino Debug Commands:', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
    console.log('debugDomino.gameState() - Show game state');
    console.log('debugDomino.lobby() - Show lobby state');
    console.log('debugDomino.connection() - Show connection state');
    console.log('debugDomino.gameStatus() - Show current game status');
    console.log('debugDomino.toggleDebug() - Toggle debug logging');
    
  } catch (error) {
    console.error('Failed to initialize Dominican Domino:', error);
    
    // Show user-friendly error
    const errorContainer = document.getElementById('errors');
    if (errorContainer) {
      errorContainer.textContent = 'Failed to initialize game. Please refresh the page.';
      errorContainer.style.display = 'block';
    } else {
      alert('Failed to initialize game. Please refresh the page and try again.');
    }
    
    // Try to show what went wrong
    console.log('Checking module availability:');
    console.log('- UIManager:', typeof UIManager);
    console.log('- GameState:', typeof GameState);
    console.log('- LobbyManager:', typeof LobbyManager);
    console.log('- GameManager:', typeof GameManager);
    console.log('- ConnectionManager:', typeof ConnectionManager);
    console.log('- BoardRenderer:', typeof BoardRenderer);
    console.log('- HandRenderer:', typeof HandRenderer);
    console.log('- DragDropManager:', typeof DragDropManager);
  }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (window.socket) {
    window.socket.disconnect();
  }
});

// Handle visibility change (tab switching)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('Page hidden - game paused');
  } else {
    console.log('Page visible - game resumed');
    // Could add reconnection logic here if needed
  }
});

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  
  if (window.DEBUG_DOMINO) {
    console.log('Error details:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
  }
  
  // Don't show error popup for minor issues
  if (event.error && event.error.name !== 'NetworkError') {
    if (typeof UIManager !== 'undefined' && UIManager.showError) {
      UIManager.showError('A technical error occurred. Please refresh if the game stops working.');
    }
  }
});

// Prevent right-click context menu on game elements (optional)
document.addEventListener('contextmenu', (event) => {
  const gameElements = ['.hand-domino', '.board-domino', '.drop-zone', '.game-board'];
  
  if (gameElements.some(selector => event.target.closest(selector))) {
    event.preventDefault();
  }
});

console.log('Dominican Domino bootstrap loaded successfully');