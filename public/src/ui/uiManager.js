/* =====================================================================
 * src/ui/uiManager.js — Handles All UI Updates
 * 
 * AI NOTES:
 * - All DOM manipulation happens here
 * - Other modules call UIManager to update display
 * - Ensures player's hand is always at bottom
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
    
    // Inject required CSS
    this.injectStyles();
  },
  
  /**
   * Inject dynamic CSS
   */
  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .board-domino {
        position: absolute;
        width: 40px;
        height: 80px;
        background: #f0f0f0;
        border: 2px solid #333;
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        z-index: 10;
        box-shadow: 0 3px 6px rgba(0,0,0,0.3);
      }
      
      .hand-domino {
        width: 30px;
        height: 60px;
        background: #f8f8f8;
        border: 1px solid #333;
        border-radius: 4px;
        margin: 2px;
        display: inline-flex;
        flex-direction: column;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .hand-domino:hover {
        transform: scale(1.1) translateY(-3px);
      }
      
      .domino-section {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: #333;
      }
      
      .domino-section.top {
        border-bottom: 1px solid #333;
      }
      
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
        box-shadow: 0 0 15px rgba(255,215,0,0.5);
      }
      
      .player-hand-container.my-hand {
        background: rgba(76, 175, 80, 0.1);
        border-color: rgba(76, 175, 80, 0.3);
      }
    `;
    document.head.appendChild(style);
  },
  
  /**
   * Remap UI positions so player is always at bottom
   */
  remapPositions(mySeat) {
    console.log('UIManager: Remapping positions for seat', mySeat);
    
    // Calculate position mapping
    const positions = ['bottom', 'left', 'top', 'right'];
    const rotation = (4 - mySeat) % 4;
    
    // Create seat to position mapping
    const seatToPosition = {};
    for (let i = 0; i < 4; i++) {
      const seat = i;
      const posIndex = (i + rotation) % 4;
      seatToPosition[seat] = positions[posIndex];
    }
    
    // Update player area labels and assign hands
    for (let seat = 0; seat < 4; seat++) {
      const position = seatToPosition[seat];
      const playerArea = this.elements.playerAreas[position];
      const handElement = this.elements.hands[seat];
      
      if (playerArea && handElement) {
        // Move hand to correct position
        playerArea.querySelector('.player-hand-container')?.remove();
        playerArea.appendChild(handElement);
        
        // Update label
        const nameDiv = playerArea.querySelector('.player-name');
        if (nameDiv) {
          if (seat === mySeat) {
            nameDiv.textContent = 'Your Hand';
            handElement.classList.add('my-hand');
          } else {
            nameDiv.textContent = `Seat ${seat}`;
          }
        }
      }
    }
  },
  
  /**
   * Update player info
   */
  updatePlayerInfo(seat) {
    if (this.elements.playerInfo) {
      const team = seat % 2;
      const partner = team === 0 ? (seat === 0 ? 2 : 0) : (seat === 1 ? 3 : 1);
      this.elements.playerInfo.textContent = 
        `You are Seat ${seat} (Team ${team} with Seat ${partner})`;
    }
    
    // Remap positions so player is at bottom
    this.remapPositions(seat);
  },
  
  /**
   * Set status text
   */
  setStatus(text) {
    if (this.elements.status) {
      this.elements.status.textContent = text;
    }
  },
  
  /**
   * Show error message
   */
  showError(text) {
    if (this.elements.errors) {
      this.elements.errors.textContent = text;
      setTimeout(() => {
        this.elements.errors.textContent = '';
      }, 4000);
    }
  },
  
  /**
   * Hide error message
   */
  hideError() {
    if (this.elements.errors) {
      this.elements.errors.textContent = '';
    }
  },
  
  /**
   * Add message to log
   */
  addMessage(text) {
    if (this.elements.messages) {
      const msg = document.createElement('div');
      msg.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
      this.elements.messages.prepend(msg);
      
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
   * Update scores
   */
  updateScores(scores) {
    if (this.elements.team0Score) {
      this.elements.team0Score.textContent = scores[0] || 0;
    }
    if (this.elements.team1Score) {
      this.elements.team1Score.textContent = scores[1] || 0;
    }
  }
};