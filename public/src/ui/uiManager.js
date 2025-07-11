/* =====================================================================
 * src/ui/uiManager.js — Handles All UI Updates & Display Logic
 *
 * AI NOTES:
 * - Single responsibility: manage all DOM-based UI rendering
 * - Never modifies game state directly — only reflects it visually
 * - Called by: handRenderer, boardRenderer, socket events, etc.
 * - Should remain display-only and side-effect free (other than visuals)
 *
 * FIXED:
 * - Bug 1: Ensures clockwise seating (bottom, left, top, right)
 * - Bug 3: Side hands span vertically with rotated tiles
 * ===================================================================== */

const UIManager = {
  elements: {},

  /**
   * Initialize and cache UI DOM references
   * Called once on page load
   */
  init() {
    console.log('UIManager: Initializing');

    const $ = id => document.getElementById(id);

    this.elements = {
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

      // Player areas (assigned dynamically)
      playerAreas: {
        top: $('topPlayer'),
        left: $('leftPlayer'),
        right: $('rightPlayer'),
        bottom: $('bottomPlayer')
      },

      // Hands (by seat)
      hands: {
        0: $('hand0'),
        1: $('hand1'),
        2: $('hand2'),
        3: $('hand3')
      }
    };

    this.injectStyles(); // Inject dynamic CSS
  },

  /**
   * Dynamic UI styles (including hand rotation/fixes)
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
        position: relative;
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
        position: relative;
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

      /* BUG 3 FIX: Side hands vertical + rotated */
      .player-area.left .player-hand-container,
      .player-area.right .player-hand-container {
        flex-direction: column;
        justify-content: space-around;
        height: 400px;
        max-height: 400px;
        padding: 20px 10px;
      }

      .player-area.left .hand-domino,
      .player-area.right .hand-domino {
        margin: 8px 0;
      }

      .position-left .hand-domino {
        transform: rotate(90deg);
      }

      .position-right .hand-domino {
        transform: rotate(-90deg);
      }

      .position-left .hand-domino:hover {
        transform: rotate(90deg) scale(1.1);
      }

      .position-right .hand-domino:hover {
        transform: rotate(-90deg) scale(1.1);
      }

      .pip-container {
        position: absolute;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
      }

      .pip {
        position: absolute;
        width: 5px;
        height: 5px;
        background: #333;
        border-radius: 50%;
      }
    `;
    document.head.appendChild(style);
  },

  /**
   * BUG 1 FIX: Ensure clockwise remapping of hands
   */
  remapPositions(mySeat) {
    const mapping = {
      bottom: mySeat,
      left: (mySeat + 1) % 4,
      top: (mySeat + 2) % 4,
      right: (mySeat + 3) % 4
    };

    // Clear previous hand placements
    Object.entries(this.elements.playerAreas).forEach(([position, area]) => {
      const existing = area.querySelector('.player-hand-container');
      if (existing) existing.remove();
    });

    // Attach hands in mapped order
    Object.entries(mapping).forEach(([position, seat]) => {
      const area = this.elements.playerAreas[position];
      const hand = this.elements.hands[seat];
      if (!area || !hand) return;

      if (hand.parentNode) hand.remove();
      area.appendChild(hand);

      hand.className = 'player-hand-container';
      hand.classList.add(`position-${position}`);
      if (seat === mySeat) hand.classList.add('my-hand');

      const label = area.querySelector('.player-name');
      if (label) {
        label.textContent = seat === mySeat 
          ? 'Your Hand' 
          : `Seat ${seat}`;
      }
    });
  },

  /**
   * Show player's seat and team info
   */
  updatePlayerInfo(seat) {
    const team = seat % 2;
    const partner = team === 0 ? (seat === 0 ? 2 : 0) : (seat === 1 ? 3 : 1);

    if (this.elements.playerInfo) {
      this.elements.playerInfo.textContent =
        `You are Seat ${seat} (Team ${team} with Seat ${partner})`;
    }

    this.remapPositions(seat);
  },

  setStatus(text) {
    if (this.elements.status) this.elements.status.textContent = text;
  },

  showError(text) {
    if (!this.elements.errors) return;
    this.elements.errors.textContent = text;
    setTimeout(() => this.hideError(), 4000);
  },

  hideError() {
    if (this.elements.errors) this.elements.errors.textContent = '';
  },

  addMessage(text) {
    if (!this.elements.messages) return;
    const msg = document.createElement('div');
    msg.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    this.elements.messages.prepend(msg);

    // Cap at 50 messages
    while (this.elements.messages.children.length > 50) {
      this.elements.messages.lastChild.remove();
    }
  },

  showLobby(show = true) {
    if (this.elements.lobbyContainer) {
      this.elements.lobbyContainer.style.display = show ? 'block' : 'none';
    }
  },

  updateScores(scores = [0, 0]) {
    if (this.elements.team0Score) {
      this.elements.team0Score.textContent = scores[0];
    }
    if (this.elements.team1Score) {
      this.elements.team1Score.textContent = scores[1];
    }
  }
};
