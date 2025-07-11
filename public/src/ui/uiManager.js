/* =====================================================================
 * src/ui/uiManager.js — Handles All UI Updates (COMPLETELY FIXED)
 * 
 * FIXES APPLIED:
 * - Fixed clockwise seating arrangement
 * - Better position remapping for player hands
 * - Improved visual feedback and status updates
 * - Better error handling and messaging
 * - Fixed side hand styling and positioning
 * =================================================================== */

const UIManager = {
  elements: {},
  
  /**
   * Initialize and cache DOM elements
   */
  init() {
    console.log('UIManager: Initializing');
    
    // Cache all DOM elements
    const $ = id => document.getElementById(id);
    
    this.elements = {
      // Info panel
      status: $('status'),
      playerInfo: $('playerInfo'),
      errors: $('errors'),
      messages: $('messages'),
      team0Score: $('team0-score'),
      team1Score: $('team1-score'),
      
      // Lobby
      lobbyContainer: $('lobbyContainer'),
      lobbyList: $('lobbyList'),
      
      // Game board
      board: $('board'),
      
      // Player areas - will be remapped based on seat
      playerAreas: {
        top: $('topPlayer'),
        left: $('leftPlayer'),
        right: $('rightPlayer'),
        bottom: $('bottomPlayer')
      },
      
      // Hands - will be remapped based on seat
      hands: {
        0: $('hand0'),
        1: $('hand1'),
        2: $('hand2'),
        3: $('hand3')
      }
    };
    
    // Inject required CSS for proper display
    this.injectDynamicStyles();
  },
  
  /**
   * FIXED: Inject dynamic CSS with better styling
   */
  injectDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Board domino styling */
      .board-domino {
        position: absolute;
        width: 40px;
        height: 80px;
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 50%, #e9ecef 100%);
        border: 2px solid #333;
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        z-index: 10;
        box-shadow: 0 3px 8px rgba(0,0,0,0.3);
        transition: all 0.3s ease;
      }
      
      .board-domino:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0,0,0,0.4);
      }
      
      /* Hand domino styling */
      .hand-domino {
        width: 30px;
        height: 60px;
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 50%, #e9ecef 100%);
        border: 2px solid #333;
        border-radius: 4px;
        margin: 2px;
        display: inline-flex;
        flex-direction: column;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      }
      
      .hand-domino:hover {
        transform: scale(1.05) translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
      
      .hand-domino.playable {
        border-color: #ffd700;
        box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        cursor: grab;
      }
      
      .hand-domino.playable:hover {
        border-color: #ffed4e;
        box-shadow: 0 0 15px rgba(255, 215, 0, 0.8);
        transform: scale(1.1) translateY(-3px);
      }
      
      .hand-domino.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        filter: grayscale(0.3);
      }
      
      /* Domino sections */
      .domino-section {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: #333;
        position: relative;
      }
      
      .domino-section.top {
        border-bottom: 1px solid #333;
      }
      
      /* Player hand containers */
      .player-hand-container {
        min-height: 80px;
        padding: 10px;
        border-radius: 8px;
        background: rgba(255,255,255,0.1);
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        border: 2px solid transparent;
        transition: all 0.3s ease;
      }
      
      .player-hand-container.current-player {
        border-color: #ffd700;
        background: rgba(255,215,0,0.2);
        box-shadow: 0 0 20px rgba(255,215,0,0.6);
        animation: currentPlayerGlow 2s ease-in-out infinite;
      }
      
      @keyframes currentPlayerGlow {
        0%, 100% { 
          box-shadow: 0 0 20px rgba(255,215,0,0.4); 
        }
        50% { 
          box-shadow: 0 0 30px rgba(255,215,0,0.8); 
        }
      }
      
      .player-hand-container.my-hand {
        background: rgba(76, 175, 80, 0.1);
        border-color: rgba(76, 175, 80, 0.3);
      }
      
      /* FIXED: Side hands spanning properly */
      .position-left .player-hand-container,
      .position-right .player-hand-container {
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        height: 100%;
        min-height: 300px;
        max-height: 400px;
        padding: 15px 8px;
        overflow-y: auto;
      }
      
      .position-left .hand-domino,
      .position-right .hand-domino {
        margin: 4px 0;
        transform-origin: center;
      }
      
      /* Rotate dominoes for side players */
      .position-left .hand-domino {
        transform: rotate(90deg);
      }
      
      .position-right .hand-domino {
        transform: rotate(-90deg);
      }
      
      .position-left .hand-domino:hover {
        transform: rotate(90deg) scale(1.05) translateY(-2px);
      }
      
      .position-right .hand-domino:hover {
        transform: rotate(-90deg) scale(1.05) translateY(-2px);
      }
      
      .position-left .hand-domino.playable:hover {
        transform: rotate(90deg) scale(1.1) translateY(-3px);
      }
      
      .position-right .hand-domino.playable:hover {
        transform: rotate(-90deg) scale(1.1) translateY(-3px);
      }
      
      /* Pip container for domino dots */
      .pip-container {
        position: relative;
        width: 100%;
        height: 100%;
      }
      
      .pip {
        position: absolute;
        width: 4px;
        height: 4px;
        background: #333;
        border-radius: 50%;
        box-shadow: 0 1px 2px rgba(0,0,0,0.3);
      }
      
      /* Drop zones */
      .drop-zone {
        position: absolute;
        border: 3px dashed #ffd700;
        border-radius: 8px;
        background: rgba(255, 215, 0, 0.1);
        transition: all 0.3s ease;
        pointer-events: all;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffd700;
        font-size: 11px;
        font-weight: bold;
        text-align: center;
        z-index: 50;
      }
      
      /* Placeholder animation */
      @keyframes placeholderPulse {
        0%, 100% {
          opacity: 0.6;
          transform: translate(-50%, -50%) scale(1);
        }
        50% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1.05);
        }
      }
      
      .starting-tile-placeholder {
        animation: placeholderPulse 2s ease-in-out infinite;
      }
      
      /* Celebration animation */
      @keyframes celebration {
        0%, 100% { transform: scale(1); }
        25% { transform: scale(1.1) rotate(2deg); }
        50% { transform: scale(1.05) rotate(-1deg); }
        75% { transform: scale(1.1) rotate(1deg); }
      }
      
      /* Dragging state */
      body.dragging {
        cursor: grabbing !important;
        user-select: none;
      }
      
      body.dragging * {
        cursor: inherit !important;
      }
    `;
    document.head.appendChild(style);
  },
  
  /**
   * FIXED: Correct clockwise seating arrangement
   */
  remapPositions(mySeat) {
    console.log('UIManager: Remapping positions for seat', mySeat);
    
    // FIXED: Define correct clockwise order from player's perspective
    // You are always at bottom, then going clockwise: left, top, right
    const seatMapping = {
      bottom: mySeat,           // You
      left: (mySeat + 1) % 4,   // Next player clockwise (to your left)
      top: (mySeat + 2) % 4,    // Player across from you
      right: (mySeat + 3) % 4   // Previous player (to your right)
    };
    
    console.log('UIManager: Seat mapping:', seatMapping);
    
    // Clear all positions first
    Object.entries(this.elements.playerAreas).forEach(([position, area]) => {
      const existingHand = area.querySelector('.player-hand-container');
      if (existingHand && existingHand.parentNode === area) {
        existingHand.remove();
      }
    });
    
    // Assign hands to correct positions
    Object.entries(seatMapping).forEach(([position, seat]) => {
      const playerArea = this.elements.playerAreas[position];
      const handElement = this.elements.hands[seat];
      
      if (playerArea && handElement) {
        // Remove hand from any previous location
        if (handElement.parentNode) {
          handElement.remove();
        }
        
        playerArea.appendChild(handElement);
        
        // Update player name label
        const nameDiv = playerArea.querySelector('.player-name');
        if (nameDiv) {
          if (seat === mySeat) {
            nameDiv.textContent = 'Your Hand';
            handElement.classList.add('my-hand');
          } else {
            const player = LobbyManager.players.find(p => p && p.seat === seat);
            nameDiv.textContent = player ? `${player.name}` : `Seat ${seat}`;
          }
        }
        
        // Add position class for CSS styling
        handElement.className = 'player-hand-container';
        handElement.classList.add(`position-${position}`);
        if (seat === mySeat) {
          handElement.classList.add('my-hand');
        }
        
        console.log(`UIManager: Mapped seat ${seat} to ${position} position`);
      }
    });
  },
  
  /**
   * Update player info display
   */
  updatePlayerInfo(seat) {
    if (this.elements.playerInfo) {
      const team = seat % 2;
      const partner = team === 0 ? (seat === 0 ? 2 : 0) : (seat === 1 ? 3 : 1);
      this.elements.playerInfo.textContent = 
        `You are Seat ${seat} (Team ${team} with Seat ${partner})`;
    }
    
    // Remap positions so player is at bottom with correct clockwise order
    this.remapPositions(seat);
  },
  
  /**
   * Set status text with visual feedback
   */
  setStatus(text) {
    if (this.elements.status) {
      this.elements.status.textContent = text;
      
      // Add visual feedback for different status types
      this.elements.status.className = '';
      if (text.includes('Your turn')) {
        this.elements.status.classList.add('your-turn');
        this.elements.status.style.color = '#27ae60';
        this.elements.status.style.fontWeight = 'bold';
      } else if (text.includes('Waiting')) {
        this.elements.status.style.color = '#6c757d';
        this.elements.status.style.fontWeight = 'normal';
      } else if (text.includes('wins') || text.includes('Game Over')) {
        this.elements.status.style.color = '#e74c3c';
        this.elements.status.style.fontWeight = 'bold';
      }
    }
  },
  
  /**
   * Show error message with better styling
   */
  showError(text) {
    if (this.elements.errors) {
      this.elements.errors.textContent = text;
      this.elements.errors.style.background = 'rgba(231, 76, 60, 0.1)';
      this.elements.errors.style.borderColor = 'rgba(231, 76, 60, 0.3)';
      this.elements.errors.style.animation = 'shake 0.5s ease-in-out';
      
      setTimeout(() => {
        this.elements.errors.textContent = '';
        this.elements.errors.style.animation = '';
      }, 4000);
    }
  },
  
  /**
   * Hide error message
   */
  hideError() {
    if (this.elements.errors) {
      this.elements.errors.textContent = '';
      this.elements.errors.style.animation = '';
    }
  },
  
  /**
   * Add message to log with timestamp
   */
  addMessage(text) {
    if (this.elements.messages) {
      const msg = document.createElement('div');
      msg.style.cssText = `
        padding: 4px 0;
        border-bottom: 1px solid #e9ecef;
        font-size: 13px;
        animation: slideIn 0.3s ease-out;
      `;
      
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      msg.innerHTML = `<span style="color: #6c757d;">[${time}]</span> ${text}`;
      
      this.elements.messages.insertBefore(msg, this.elements.messages.firstChild);
      
      // Keep only last 50 messages
      while (this.elements.messages.children.length > 50) {
        this.elements.messages.lastChild.remove();
      }
    }
  },
  
  /**
   * Show/hide lobby
   */
  showLobby(show) {
    if (this.elements.lobbyContainer) {
      this.elements.lobbyContainer.style.display = show ? 'block' : 'none';
    }
  },
  
  /**
   * Update scores with animation
   */
  updateScores(scores) {
    if (this.elements.team0Score) {
      const newScore = scores[0] || 0;
      if (parseInt(this.elements.team0Score.textContent) !== newScore) {
        this.elements.team0Score.style.animation = 'scoreUpdate 0.5s ease-in-out';
        setTimeout(() => {
          this.elements.team0Score.style.animation = '';
        }, 500);
      }
      this.elements.team0Score.textContent = newScore;
    }
    
    if (this.elements.team1Score) {
      const newScore = scores[1] || 0;
      if (parseInt(this.elements.team1Score.textContent) !== newScore) {
        this.elements.team1Score.style.animation = 'scoreUpdate 0.5s ease-in-out';
        setTimeout(() => {
          this.elements.team1Score.style.animation = '';
        }, 500);
      }
      this.elements.team1Score.textContent = newScore;
    }
  },
  
  /**
   * Show temporary notification
   */
  showNotification(text, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-weight: bold;
      animation: slideInRight 0.3s ease-out;
      max-width: 300px;
    `;
    
    notification.textContent = text;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, duration);
  }
};