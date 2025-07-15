/* =====================================================================
 * src/ui/uiManager.js — Enhanced UI Manager with Notifications
 * 
 * ENHANCEMENTS ADDED:
 * - Toast notification system
 * - Better visual feedback for turns
 * - Enhanced status updates
 * - Improved error handling
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
    
    // Create notification container
    this.createNotificationContainer();
    
    // Inject required CSS
    this.injectEnhancedStyles();
  },
  
  /**
   * NEW: Create notification container
   */
  createNotificationContainer() {
    if (document.getElementById('notification-container')) return;
    
    const container = document.createElement('div');
    container.id = 'notification-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(container);
  },
  
  /**
   * ENHANCED: Show toast notifications
   */
  showNotification(text, type = 'info', duration = 3000) {
    const container = document.getElementById('notification-container');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `toast-notification toast-${type}`;
    
    // Set colors based on type
    const colors = {
      info: { bg: '#3498db', icon: 'ℹ️' },
      success: { bg: '#27ae60', icon: '✅' },
      warning: { bg: '#f39c12', icon: '⚠️' },
      error: { bg: '#e74c3c', icon: '❌' }
    };
    
    const color = colors[type] || colors.info;
    
    notification.style.cssText = `
      background: ${color.bg};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      font-weight: 600;
      font-size: 14px;
      max-width: 300px;
      pointer-events: auto;
      transform: translateX(100%);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      display: flex;
      align-items: center;
      gap: 10px;
      border-left: 4px solid rgba(255,255,255,0.3);
    `;
    
    notification.innerHTML = `
      <span style="font-size: 18px;">${color.icon}</span>
      <span>${text}</span>
    `;
    
    container.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
      notification.style.opacity = '1';
    }, 100);
    
    // Auto remove
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, duration);
    
    // Click to dismiss
    notification.addEventListener('click', () => {
      notification.style.transform = 'translateX(100%)';
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    });
  },
  
  /**
   * Inject enhanced CSS styles
   */
  injectEnhancedStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Enhanced notification styles */
      .toast-notification {
        cursor: pointer;
        user-select: none;
      }
      
      .toast-notification:hover {
        transform: translateX(-5px) !important;
        box-shadow: 0 6px 25px rgba(0,0,0,0.4) !important;
      }
      
      /* Enhanced status styling */
      #status.your-turn {
        background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%) !important;
        color: white !important;
        animation: statusPulse 2s ease-in-out infinite;
        border-color: #27ae60 !important;
      }
      
      @keyframes statusPulse {
        0%, 100% { 
          box-shadow: 0 0 20px rgba(39, 174, 96, 0.3); 
        }
        50% { 
          box-shadow: 0 0 30px rgba(39, 174, 96, 0.6); 
        }
      }
      
      /* Enhanced current player glow */
      .player-hand-container.current-player {
        border-color: #ffd700 !important;
        background: rgba(255,215,0,0.2) !important;
        box-shadow: 0 0 25px rgba(255,215,0,0.6) !important;
        animation: currentPlayerGlow 2s ease-in-out infinite !important;
      }
      
      @keyframes currentPlayerGlow {
        0%, 100% { 
          box-shadow: 0 0 25px rgba(255,215,0,0.4) !important; 
        }
        50% { 
          box-shadow: 0 0 35px rgba(255,215,0,0.8) !important; 
        }
      }
      
      /* Board end indicators */
      .board-end-indicator {
        animation: endPulse 3s ease-in-out infinite;
      }
      
      @keyframes endPulse {
        0%, 100% { 
          transform: scale(1);
          opacity: 0.8;
        }
        50% { 
          transform: scale(1.1);
          opacity: 1;
        }
      }
      
      /* Enhanced drop zones */
      .drop-zone.enhanced {
        animation: dropZoneBreathe 2s ease-in-out infinite;
      }
      
      @keyframes dropZoneBreathe {
        0%, 100% { 
          border-color: #ffd700;
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 215, 0, 0.3) 100%);
        }
        50% { 
          border-color: #ffed4e;
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.4) 100%);
        }
      }
      
      /* Enhanced board end highlighting */
      .board-domino.board-end {
        animation: endHighlight 2s ease-in-out infinite;
        z-index: 15;
      }
      
      @keyframes endHighlight {
        0%, 100% { 
          border-color: #ffd700;
          box-shadow: 0 0 15px rgba(255, 215, 0, 0.6);
        }
        50% { 
          border-color: #ffed4e;
          box-shadow: 0 0 25px rgba(255, 215, 0, 0.9);
        }
      }
      
      /* Enhanced error styling */
      #errors.shake {
        animation: shake 0.5s ease-in-out;
      }
      
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
      }
      
      /* Enhanced message animations */
      .message-item {
        animation: slideInMessage 0.3s ease-out;
      }
      
      @keyframes slideInMessage {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      /* Score update animations */
      .score-updated {
        animation: scoreUpdate 0.6s ease-in-out;
      }
      
      @keyframes scoreUpdate {
        0% { transform: scale(1); }
        30% { transform: scale(1.3); color: #d4af37; }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  },
  
  /**
   * FIXED: Correct clockwise seating arrangement
   */
  remapPositions(mySeat) {
    console.log('UIManager: Remapping positions for seat', mySeat);
    
    // Define correct clockwise order from player's perspective
    const seatMapping = {
      bottom: mySeat,           // You
      left: (mySeat + 1) % 4,   // Next player clockwise (to your left)
      top: (mySeat + 2) % 4,    // Player across from you
      right: (mySeat + 3) % 4   // Previous player (to your right)
    };
    
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
      }
    });
  },
  
  /**
   * ENHANCED: Update player info display
   */
  updatePlayerInfo(seat) {
    if (this.elements.playerInfo) {
      const team = seat % 2;
      const partner = team === 0 ? (seat === 0 ? 2 : 0) : (seat === 1 ? 3 : 1);
      this.elements.playerInfo.innerHTML = `
        🎯 You are <strong>Seat ${seat}</strong> 
        (Team ${team} with Seat ${partner})
      `;
    }
    
    // Remap positions so player is at bottom with correct clockwise order
    this.remapPositions(seat);
  },
  
  /**
   * ENHANCED: Set status text with visual feedback
   */
  setStatus(text) {
    if (this.elements.status) {
      this.elements.status.textContent = text;
      
      // Remove all status classes
      this.elements.status.className = '';
      
      // Add specific styling based on content
      if (text.includes('YOUR TURN') || text.includes('Your turn')) {
        this.elements.status.classList.add('your-turn');
      } else if (text.includes('Waiting') || text.includes('turn')) {
        this.elements.status.style.cssText = `
          background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
          color: white;
          border-color: #6c757d;
        `;
      } else if (text.includes('wins') || text.includes('GAME OVER')) {
        this.elements.status.style.cssText = `
          background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
          color: white;
          border-color: #e74c3c;
          animation: statusPulse 1s ease-in-out;
        `;
      } else if (text.includes('No valid moves') || text.includes('Passing')) {
        this.elements.status.style.cssText = `
          background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
          color: white;
          border-color: #f39c12;
        `;
      }
    }
  },
  
  /**
   * ENHANCED: Show error message with better styling
   */
  showError(text) {
    if (this.elements.errors) {
      this.elements.errors.textContent = text;
      this.elements.errors.style.cssText = `
        background: rgba(231, 76, 60, 0.1);
        border: 2px solid rgba(231, 76, 60, 0.5);
        border-radius: 8px;
        padding: 12px;
        color: #e74c3c;
        font-weight: bold;
      `;
      this.elements.errors.classList.add('shake');
      
      // Show as notification too
      this.showNotification(text, 'error', 4000);
      
      setTimeout(() => {
        this.hideError();
      }, 5000);
    }
  },
  
  /**
   * Hide error message
   */
  hideError() {
    if (this.elements.errors) {
      this.elements.errors.textContent = '';
      this.elements.errors.style.cssText = '';
      this.elements.errors.classList.remove('shake');
    }
  },
  
  /**
   * ENHANCED: Add message to log with better styling
   */
  addMessage(text) {
    if (this.elements.messages) {
      const msg = document.createElement('div');
      msg.className = 'message-item';
      msg.style.cssText = `
        padding: 8px 12px;
        margin: 2px 0;
        border-radius: 6px;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-left: 3px solid #3498db;
        font-size: 13px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      `;
      
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      msg.innerHTML = `
        <span style="color: #6c757d; font-size: 11px;">[${time}]</span> 
        <span style="color: #2c3e50; font-weight: 500;">${text}</span>
      `;
      
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
   * ENHANCED: Update scores with animation
   */
  updateScores(scores) {
    if (this.elements.team0Score) {
      const newScore = scores[0] || 0;
      const oldScore = parseInt(this.elements.team0Score.textContent) || 0;
      
      if (oldScore !== newScore) {
        this.elements.team0Score.classList.add('score-updated');
        setTimeout(() => {
          this.elements.team0Score.classList.remove('score-updated');
        }, 600);
      }
      this.elements.team0Score.textContent = newScore;
    }
    
    if (this.elements.team1Score) {
      const newScore = scores[1] || 0;
      const oldScore = parseInt(this.elements.team1Score.textContent) || 0;
      
      if (oldScore !== newScore) {
        this.elements.team1Score.classList.add('score-updated');
        setTimeout(() => {
          this.elements.team1Score.classList.remove('score-updated');
        }, 600);
      }
      this.elements.team1Score.textContent = newScore;
    }
  }
};