/* =====================================================================
 * src/ui/handRenderer.js — FIXED Rendering Timing and Layout Issues
 * 
 * FIXES APPLIED:
 * 1. Better timing for rendering (wait for layout to stabilize)
 * 2. Force layout calculation before rendering
 * 3. Clear containers properly before re-rendering
 * 4. Ensure consistent spacing for side players
 * =================================================================== */

const HandRenderer = {
  /**
   * FIX 1: Render all hands with proper timing
   */
  renderAllHands() {
    console.log('HandRenderer: Starting render for all hands');
    
    // Clear all hands first and force layout
    this.clearAllHands();
    
    // FIX 2: Wait for next frame to ensure layout is stable
    requestAnimationFrame(() => {
      this.doRenderAllHands();
    });
  },
  
  /**
   * Clear all hands properly
   */
  clearAllHands() {
    for (let i = 0; i < 4; i++) {
      const handElement = document.getElementById(`hand${i}`);
      if (handElement) {
        // Clear content
        handElement.innerHTML = '';
        
        // Remove all classes
        handElement.classList.remove('current-player');
        
        // Force layout recalculation
        handElement.offsetHeight;
      }
    }
  },
  
  /**
   * Actually render all hands
   */
  doRenderAllHands() {
    console.log('HandRenderer: Rendering all hands (after layout stable)');
    
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
    
    console.log('HandRenderer: All hands rendered successfully');
  },
  
  /**
   * Render a specific player's hand
   */
  renderPlayerHand(seat) {
    const handElement = document.getElementById(`hand${seat}`);
    if (!handElement) {
      console.warn(`HandRenderer: Hand element for seat ${seat} not found`);
      return;
    }
    
    console.log(`HandRenderer: Rendering hand for seat ${seat}`);
    
    if (seat === GameState.mySeat) {
      this.renderMyHand(handElement);
    } else {
      this.renderOpponentHand(handElement, seat);
    }
    
    // FIX 3: Force layout after rendering each hand
    handElement.offsetHeight;
  },
  
  /**
   * Render my hand with interactive tiles
   */
  renderMyHand(handElement) {
    const tileCount = GameState.myHand.length;
    console.log(`HandRenderer: Rendering my hand with ${tileCount} tiles`);
    
    // Clear first
    handElement.innerHTML = '';
    
    GameState.myHand.forEach((domino, index) => {
      const element = this.createHandDomino(domino, true);
      
      // Add interaction if it's my turn
      if (GameState.isMyTurn()) {
        const isPlayable = GameState.isTilePlayable(domino);
        
        if (isPlayable) {
          element.classList.add('playable');
          element.style.cursor = 'grab';
          element.title = 'Drag to board or click to play';
          
          // Click handler
          element.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleTileClick(domino);
          });
          
          // Drag handlers
          element.addEventListener('mousedown', (e) => {
            e.preventDefault();
            DragDropManager.startDrag(e, domino, element);
          });
          
          element.addEventListener('touchstart', (e) => {
            e.preventDefault();
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
   * FIX 4: Render opponent hand with proper spacing
   */
  renderOpponentHand(handElement, seat) {
    const tileCount = GameState.handSizes[seat] || 0;
    console.log(`HandRenderer: Rendering ${tileCount} dummy tiles for seat ${seat}`);
    
    // Clear first
    handElement.innerHTML = '';
    
    // Create a document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    for (let i = 0; i < tileCount; i++) {
      const dummy = this.createDummyTile();
      fragment.appendChild(dummy);
    }
    
    // Append all at once
    handElement.appendChild(fragment);
  },
  
  /**
   * Create a hand domino element
   */
  createHandDomino(domino, isInteractive = false) {
    const element = document.createElement('div');
    element.className = 'hand-domino';
    element.dataset.value = JSON.stringify(domino);
    
    // Set explicit size to prevent layout shifts
    element.style.width = '30px';
    element.style.height = '60px';
    element.style.flexShrink = '0';
    
    if (isInteractive) {
      element.style.cursor = 'pointer';
    }
    
    // Add domino halves
    const topHalf = this.createDominoHalf(domino[0]);
    const bottomHalf = this.createDominoHalf(domino[1]);
    
    topHalf.style.borderBottom = '1px solid #333';
    
    element.appendChild(topHalf);
    element.appendChild(bottomHalf);
    
    return element;
  },
  
  /**
   * Create a domino half with pips
   */
  createDominoHalf(value) {
    const half = document.createElement('div');
    half.style.cssText = `
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      min-height: 28px;
    `;
    
    // Add pips
    this.addPips(half, value);
    
    return half;
  },
  
  /**
   * Add pips to domino half
   */
  addPips(container, value) {
    const pipPatterns = {
      0: [],
      1: [[0.5, 0.5]],
      2: [[0.3, 0.3], [0.7, 0.7]],
      3: [[0.3, 0.3], [0.5, 0.5], [0.7, 0.7]],
      4: [[0.3, 0.3], [0.3, 0.7], [0.7, 0.3], [0.7, 0.7]],
      5: [[0.3, 0.3], [0.3, 0.7], [0.5, 0.5], [0.7, 0.3], [0.7, 0.7]],
      6: [[0.25, 0.2], [0.25, 0.5], [0.25, 0.8], [0.75, 0.2], [0.75, 0.5], [0.75, 0.8]]
    };
    
    const positions = pipPatterns[value] || [];
    
    positions.forEach(([x, y]) => {
      const pip = document.createElement('div');
      pip.style.cssText = `
        position: absolute;
        width: 4px;
        height: 4px;
        background: #333;
        border-radius: 50%;
        left: ${x * 100}%;
        top: ${y * 100}%;
        transform: translate(-50%, -50%);
      `;
      container.appendChild(pip);
    });
  },
  
  /**
   * FIX 5: Create dummy tile with consistent sizing
   */
  createDummyTile() {
    const dummy = document.createElement('div');
    dummy.className = 'hand-domino dummy';
    
    // Set explicit size to prevent layout shifts
    dummy.style.cssText = `
      width: 30px;
      height: 60px;
      background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
      border: 2px solid #1a202c;
      border-radius: 6px;
      display: flex;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      position: relative;
      flex-shrink: 0;
    `;
    
    // Add pattern
    const pattern = document.createElement('div');
    pattern.style.cssText = `
      position: absolute;
      inset: 3px;
      background-image: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 2px,
        rgba(255,255,255,0.1) 2px,
        rgba(255,255,255,0.1) 4px
      );
      border-radius: 4px;
    `;
    
    dummy.appendChild(pattern);
    return dummy;
  },
  
  /**
   * Handle tile click
   */
  handleTileClick(domino) {
    console.log('HandRenderer: Tile clicked', domino);
    
    if (!GameState.isMyTurn() || !GameState.isTilePlayable(domino)) {
      return;
    }
    
    // Determine playable sides
    const playableSides = GameState.getPlayableSides(domino);
    
    if (playableSides.length === 0) {
      UIManager.showError('This tile cannot be played');
      return;
    }
    
    let side;
    if (playableSides.length === 1) {
      side = playableSides[0];
    } else {
      // Ask player which side
      side = confirm('Play on LEFT side?\n\nOK = Left\nCancel = Right') ? 'left' : 'right';
    }
    
    // Send move
    window.socket.emit('playTile', {
      roomId: GameState.roomId,
      seat: GameState.mySeat,
      tile: domino,
      side: side
    });
  },
  
  /**
   * FIX 6: Debug function to check layout
   */
  debugLayout() {
    console.log('=== HandRenderer Layout Debug ===');
    for (let i = 0; i < 4; i++) {
      const handElement = document.getElementById(`hand${i}`);
      if (handElement) {
        const rect = handElement.getBoundingClientRect();
        const tiles = handElement.querySelectorAll('.hand-domino');
        console.log(`Seat ${i}:`, {
          container: { width: rect.width, height: rect.height },
          tiles: tiles.length,
          position: handElement.closest('.player-area')?.className
        });
      }
    }
    console.log('================================');
  }
};
window.HandRenderer = HandRenderer;

