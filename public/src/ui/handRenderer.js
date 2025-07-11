/* =====================================================================
 * src/ui/handRenderer.js — Renders Player Hands
 * 
 * AI NOTES:
 * - Shows actual tiles for current player
 * - Shows face-down tiles for opponents
 * - Highlights current turn
 * =================================================================== */

const HandRenderer = {
  /**
   * Render all player hands
   */
  renderAllHands() {
    // Clear all hands
    for (let i = 0; i < 4; i++) {
      const handElement = document.getElementById(`hand${i}`);
      if (handElement) {
        handElement.innerHTML = '';
        handElement.classList.remove('current-player');
      }
    }
    
    // Render each player's hand
    for (let seat = 0; seat < 4; seat++) {
      this.renderPlayerHand(seat);
    }
    
    // Highlight current player
    if (GameState.currentTurn !== null) {
      const currentHand = document.getElementById(`hand${GameState.currentTurn}`);
      if (currentHand) {
        currentHand.classList.add('current-player');
      }
    }
  },
  
  /**
   * Render a specific player's hand
   */
  renderPlayerHand(seat) {
    const handElement = document.getElementById(`hand${seat}`);
    if (!handElement) return;
    
    if (seat === GameState.mySeat) {
      // Render actual tiles for current player
      this.renderMyHand(handElement);
    } else {
      // Render dummy tiles for opponents
      this.renderOpponentHand(handElement, seat);
    }
  },
  
  /**
   * Render current player's hand
   */
  renderMyHand(handElement) {
    GameState.myHand.forEach((domino, index) => {
      const element = this.createHandDomino(domino, GameState.mySeat, index);
      
      // Add click handler if it's my turn
      if (GameState.isMyTurn()) {
        const isPlayable = GameState.isTilePlayable(domino);
        if (isPlayable) {
          element.classList.add('playable');
          element.addEventListener('click', () => this.handleTileClick(domino));
          
          // Add drag support
          element.addEventListener('mousedown', e => {
            DragDropManager.startDrag(e, domino, element);
          });
          element.addEventListener('touchstart', e => {
            DragDropManager.startDrag(e, domino, element);
          }, { passive: false });
        } else {
          element.classList.add('disabled');
          element.style.opacity = '0.5';
          element.style.cursor = 'not-allowed';
        }
      }
      
      handElement.appendChild(element);
    });
  },
  
  /**
   * Render opponent's hand (face-down)
   */
  renderOpponentHand(handElement, seat) {
    const tileCount = GameState.handSizes[seat] || 0;
    
    for (let i = 0; i < tileCount; i++) {
      const dummy = document.createElement('div');
      dummy.className = 'hand-domino dummy';
      dummy.style.background = '#2d3748';
      dummy.style.border = '1px solid #1a202c';
      
      // Add back pattern
      const pattern = document.createElement('div');
      pattern.style.cssText = `
        width: 100%;
        height: 100%;
        background-image: repeating-linear-gradient(
          45deg,
          transparent,
          transparent 3px,
          rgba(255,255,255,0.1) 3px,
          rgba(255,255,255,0.1) 6px
        );
        border-radius: 3px;
      `;
      dummy.appendChild(pattern);
      handElement.appendChild(dummy);
    }
  },
  
  /**
   * Create hand domino element
   */
  createHandDomino(domino, seat, index) {
    const element = document.createElement('div');
    element.className = 'hand-domino';
    element.dataset.seat = seat;
    element.dataset.index = index;
    element.dataset.value = JSON.stringify(domino);
    
    // Top section
    const topSection = document.createElement('div');
    topSection.className = 'domino-section top';
    topSection.textContent = domino[0];
    
    // Bottom section
    const bottomSection = document.createElement('div');
    bottomSection.className = 'domino-section bottom';
    bottomSection.textContent = domino[1];
    
    element.appendChild(topSection);
    element.appendChild(bottomSection);
    
    return element;
  },
  
  /**
   * Handle tile click (alternative to drag)
   */
  handleTileClick(domino) {
    // Simple click-to-play for mobile
    const ends = GameState.getBoardEnds();
    let side = null;
    
    if (GameState.boardState.length === 0) {
      side = 'left';
    } else {
      // Check which side(s) the tile can play on
      const [a, b] = domino;
      const canPlayLeft = a === ends.left || b === ends.left;
      const canPlayRight = a === ends.right || b === ends.right;
      
      if (canPlayLeft && canPlayRight) {
        // Ask player which side
        side = confirm('Play on the left side? (Cancel for right)') ? 'left' : 'right';
      } else if (canPlayLeft) {
        side = 'left';
      } else if (canPlayRight) {
        side = 'right';
      }
    }
    
    if (side) {
      window.socket.emit('playTile', {
        roomId: GameState.roomId,
        seat: GameState.mySeat,
        tile: domino,
        side: side
      });
    }
  }
};