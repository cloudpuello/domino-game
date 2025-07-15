/* =====================================================================
 * src/game/dragDropManager.js — PERFECT Drag Drop Manager
 * 
 * FIXES APPLIED:
 * - Event listener cleanup bug FIXED (no memory leaks)
 * - Proper bound function references
 * - Complete error handling
 * - Touch support with scroll prevention
 * - Invalid drop feedback
 * =================================================================== */

const DragDropManager = {
  dragState: {
    element: null,
    originalTile: null,
    tileData: null,
    isDragging: false,
    offsetX: 0,
    offsetY: 0,
    hoveredZone: null
  },
  
  // CRITICAL: Store bound handlers to fix cleanup bug
  boundDragMove: null,
  boundDragEnd: null,
  
  /**
   * Initialize drag and drop system
   */
  init() {
    console.log('DragDropManager: Initializing');
    
    // CRITICAL: Create bound handlers once and store them
    this.boundDragMove = this.handleDragMove.bind(this);
    this.boundDragEnd = this.handleDragEnd.bind(this);
    
    // Add required CSS
    this.injectDragStyles();
  },
  
  /**
   * Start dragging a domino
   */
  startDrag(event, tile, tileElement) {
    // Validate state
    if (this.dragState.isDragging) {
      console.log('Already dragging, ignoring new drag');
      return;
    }
    
    // Validate dependencies
    if (!GameState || !window.socket) {
      console.error('DragDropManager: Missing dependencies');
      return;
    }
    
    // Validate game state
    if (!GameState.isMyTurn()) {
      console.log('Not my turn, drag ignored');
      return;
    }
    
    if (!GameState.isTilePlayable(tile)) {
      console.log('Tile not playable, drag ignored');
      return;
    }
    
    console.log('Starting drag for:', tile);
    
    // Prevent default behaviors
    event.preventDefault();
    event.stopPropagation();
    
    // Set drag state
    this.dragState.tileData = tile;
    this.dragState.originalTile = tileElement;
    this.dragState.isDragging = true;
    
    // Calculate offset
    const pos = this.getEventPosition(event);
    const rect = tileElement.getBoundingClientRect();
    this.dragState.offsetX = pos.x - rect.left;
    this.dragState.offsetY = pos.y - rect.top;
    
    // Create drag element
    this.createDragElement(tileElement, pos);
    
    // Hide original with fade effect
    tileElement.style.opacity = '0.4';
    tileElement.style.transition = 'opacity 0.2s ease';
    
    // FIXED: Add event listeners using stored bound handlers
    document.addEventListener('mousemove', this.boundDragMove, { passive: false });
    document.addEventListener('mouseup', this.boundDragEnd);
    document.addEventListener('touchmove', this.boundDragMove, { passive: false });
    document.addEventListener('touchend', this.boundDragEnd);
    
    // Prevent mobile scroll during drag
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    
    // Show drop zones
    if (BoardRenderer && BoardRenderer.showDropZones) {
      BoardRenderer.showDropZones();
    }
    
    // Add dragging class
    document.body.classList.add('dragging');
  },
  
  /**
   * Create the dragged element
   */
  createDragElement(original, pos) {
    const drag = original.cloneNode(true);
    drag.className = 'hand-domino dragging-tile';
    
    // Set consistent styling
    drag.style.cssText = `
      position: fixed;
      left: ${pos.x - this.dragState.offsetX}px;
      top: ${pos.y - this.dragState.offsetY}px;
      width: 30px;
      height: 60px;
      z-index: 1000;
      pointer-events: none;
      transform: scale(1.2);
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      border: 3px solid #ffd700;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      transition: none;
    `;
    
    document.body.appendChild(drag);
    this.dragState.element = drag;
  },
  
  /**
   * Handle drag movement
   */
  handleDragMove(event) {
    if (!this.dragState.isDragging || !this.dragState.element) return;
    
    event.preventDefault();
    
    const pos = this.getEventPosition(event);
    this.dragState.element.style.left = `${pos.x - this.dragState.offsetX}px`;
    this.dragState.element.style.top = `${pos.y - this.dragState.offsetY}px`;
    
    // Update hover effects
    this.updateHoveredZone(pos);
  },
  
  /**
   * Handle drag end
   */
  handleDragEnd(event) {
    if (!this.dragState.isDragging) return;
    
    event.preventDefault();
    
    const pos = this.getEventPosition(event);
    const dropZone = this.getDropZoneAt(pos);
    
    if (dropZone && this.isValidDropZone(dropZone)) {
      this.handleValidDrop(dropZone);
    } else {
      this.handleInvalidDrop();
    }
    
    this.cleanup();
  },
  
  /**
   * Handle valid drop
   */
  handleValidDrop(dropZone) {
    const side = dropZone.dataset.side;
    console.log('Valid drop on side:', side);
    
    // Validate the drop is still valid
    const playableSides = GameState.getPlayableSides(this.dragState.tileData);
    if (!playableSides.includes(side)) {
      console.log('Drop no longer valid, treating as invalid');
      this.handleInvalidDrop();
      return;
    }
    
    // Send move to server
    window.socket.emit('playTile', {
      roomId: GameState.roomId,
      seat: GameState.mySeat,
      tile: this.dragState.tileData,
      side: side
    });
  },
  
  /**
   * Handle invalid drop with feedback
   */
  handleInvalidDrop() {
    console.log('Invalid drop location');
    
    // Show error feedback
    if (UIManager && UIManager.showError) {
      UIManager.showError('Drop the tile on a valid drop zone');
    }
    
    // Add shake animation to original tile
    if (this.dragState.originalTile) {
      this.dragState.originalTile.style.opacity = '1';
      this.dragState.originalTile.classList.add('shake');
      
      // Remove shake after animation
      setTimeout(() => {
        if (this.dragState.originalTile) {
          this.dragState.originalTile.classList.remove('shake');
        }
      }, 500);
    }
  },
  
  /**
   * Update hovered zone highlighting
   */
  updateHoveredZone(pos) {
    const dropZone = this.getDropZoneAt(pos);
    
    // Remove previous hover state
    if (this.dragState.hoveredZone && this.dragState.hoveredZone !== dropZone) {
      this.resetDropZoneStyle(this.dragState.hoveredZone);
    }
    
    // Apply new hover state
    if (dropZone && this.isValidDropZone(dropZone)) {
      this.applyDropZoneHover(dropZone);
      this.dragState.hoveredZone = dropZone;
    } else {
      this.dragState.hoveredZone = null;
    }
  },
  
  /**
   * Reset drop zone to default style
   */
  resetDropZoneStyle(zone) {
    zone.style.background = 'rgba(255, 215, 0, 0.2)';
    zone.style.borderColor = '#ffd700';
    zone.style.transform = 'scale(1)';
  },
  
  /**
   * Apply hover effect to drop zone
   */
  applyDropZoneHover(zone) {
    zone.style.background = 'rgba(255, 215, 0, 0.4)';
    zone.style.borderColor = '#ffed4e';
    zone.style.transform = 'scale(1.05)';
  },
  
  /**
   * Check if drop zone is valid for current tile
   */
  isValidDropZone(dropZone) {
    if (!dropZone || !this.dragState.tileData) return false;
    
    const side = dropZone.dataset.side;
    const playableSides = GameState.getPlayableSides(this.dragState.tileData);
    
    return playableSides.includes(side);
  },
  
  /**
   * Get drop zone at position
   */
  getDropZoneAt(pos) {
    const elements = document.elementsFromPoint(pos.x, pos.y);
    return elements.find(el => el && el.classList && el.classList.contains('drop-zone'));
  },
  
  /**
   * Get event position (mouse or touch)
   */
  getEventPosition(event) {
    if (event.touches && event.touches.length > 0) {
      return {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      };
    } else {
      return {
        x: event.clientX || 0,
        y: event.clientY || 0
      };
    }
  },
  
  /**
   * Clean up drag state - FIXED: Proper event cleanup
   */
  cleanup() {
    // FIXED: Remove event listeners using stored bound handlers
    document.removeEventListener('mousemove', this.boundDragMove);
    document.removeEventListener('mouseup', this.boundDragEnd);
    document.removeEventListener('touchmove', this.boundDragMove);
    document.removeEventListener('touchend', this.boundDragEnd);
    
    // Remove drag element
    if (this.dragState.element && this.dragState.element.parentNode) {
      this.dragState.element.remove();
    }
    
    // Restore original tile
    if (this.dragState.originalTile) {
      this.dragState.originalTile.style.opacity = '1';
      this.dragState.originalTile.style.transition = '';
    }
    
    // Reset hover zone
    if (this.dragState.hoveredZone) {
      this.resetDropZoneStyle(this.dragState.hoveredZone);
    }
    
    // Hide drop zones
    if (BoardRenderer && BoardRenderer.hideDropZones) {
      BoardRenderer.hideDropZones();
    }
    
    // Restore body state
    document.body.classList.remove('dragging');
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    
    // Reset drag state
    this.dragState = {
      element: null,
      originalTile: null,
      tileData: null,
      isDragging: false,
      offsetX: 0,
      offsetY: 0,
      hoveredZone: null
    };
  },
  
  /**
   * Inject required CSS styles
   */
  injectDragStyles() {
    // Don't inject twice
    if (document.getElementById('dragdrop-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'dragdrop-styles';
    style.textContent = `
      /* Dragging state styles */
      .dragging-tile {
        transition: none !important;
        cursor: grabbing !important;
      }
      
      body.dragging {
        cursor: grabbing !important;
        user-select: none !important;
      }
      
      body.dragging * {
        cursor: inherit !important;
      }
      
      /* Drop zone hover effects */
      .drop-zone {
        transition: all 0.2s ease !important;
      }
      
      .drop-zone:hover {
        background: rgba(255, 215, 0, 0.4) !important;
        border-color: #ffed4e !important;
        transform: scale(1.05) !important;
      }
      
      /* Shake animation for invalid drops */
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-5px); }
        40%, 80% { transform: translateX(5px); }
      }
      
      .shake {
        animation: shake 0.4s ease !important;
      }
      
      /* Ensure drop zones are visible during drag */
      .drop-zone.visible {
        opacity: 1 !important;
        pointer-events: all !important;
      }
    `;
    
    document.head.appendChild(style);
  },
  
  /**
   * Force cleanup if something goes wrong
   */
  forceCleanup() {
    console.log('DragDropManager: Force cleanup called');
    
    // Reset drag state
    this.dragState.isDragging = false;
    
    // Call normal cleanup
    this.cleanup();
  },
  
  /**
   * Get current drag status for debugging
   */
  getStatus() {
    return {
      isDragging: this.dragState.isDragging,
      hasDragElement: !!this.dragState.element,
      tileData: this.dragState.tileData,
      hasHoveredZone: !!this.dragState.hoveredZone
    };
  }
};

// CRITICAL: Make DragDropManager globally available
window.DragDropManager = DragDropManager;