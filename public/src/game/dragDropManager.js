/* =====================================================================
 * src/game/dragDropManager.js — Handles Domino Dragging
 * 
 * AI NOTES:
 * - Supports both mouse and touch
 * - Visual feedback during drag
 * - Validates drop locations
 * =================================================================== */

const DragDropManager = {
  dragState: {
    element: null,
    originalTile: null,
    tileData: null,
    isDragging: false,
    offsetX: 0,
    offsetY: 0
  },
  
  /**
   * Start dragging a domino
   */
  startDrag(event, tile, tileElement) {
    if (event.type === 'touchstart') {
      event.preventDefault();
    }
    
    if (this.dragState.isDragging || !GameState.isMyTurn()) return;
    if (!GameState.isTilePlayable(tile)) return;
    
    // Set drag state
    this.dragState.tileData = tile;
    this.dragState.originalTile = tileElement;
    this.dragState.isDragging = true;
    
    // Get position
    const pos = this.getEventPosition(event);
    const rect = tileElement.getBoundingClientRect();
    this.dragState.offsetX = pos.x - rect.left;
    this.dragState.offsetY = pos.y - rect.top;
    
    // Create dragged element
    this.dragState.element = tileElement.cloneNode(true);
    this.dragState.element.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 1000;
      opacity: 0.8;
      transform: scale(1.1);
      left: ${pos.x - this.dragState.offsetX}px;
      top: ${pos.y - this.dragState.offsetY}px;
      width: 30px;
      height: 60px;
    `;
    document.body.appendChild(this.dragState.element);
    
    // Hide original
    tileElement.style.opacity = '0.3';
    
    // Add event listeners
    document.addEventListener('mousemove', this.handleDragMove.bind(this));
    document.addEventListener('mouseup', this.handleDragEnd.bind(this));
    document.addEventListener('touchmove', this.handleDragMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.handleDragEnd.bind(this));
    
    // Show drop zones
    this.showDropZones();
  },
  
  /**
   * Handle drag movement
   */
  handleDragMove(event) {
    if (!this.dragState.isDragging) return;
    
    event.preventDefault();
    const pos = this.getEventPosition(event);
    
    // Update position
    this.dragState.element.style.left = `${pos.x - this.dragState.offsetX}px`;
    this.dragState.element.style.top = `${pos.y - this.dragState.offsetY}px`;
    
    // Check for hover over board
    const board = document.getElementById('board');
    const rect = board.getBoundingClientRect();
    const isOverBoard = pos.x >= rect.left && pos.x <= rect.right &&
                       pos.y >= rect.top && pos.y <= rect.bottom;
    
    if (isOverBoard) {
      board.classList.add('drop-hover');
    } else {
      board.classList.remove('drop-hover');
    }
  },
  
  /**
   * Handle drag end
   */
  handleDragEnd(event) {
    if (!this.dragState.isDragging) return;
    
    const pos = this.getEventPosition(event);
    
    // Check if dropped on board
    const board = document.getElementById('board');
    const rect = board.getBoundingClientRect();
    const isOverBoard = pos.x >= rect.left && pos.x <= rect.right &&
                       pos.y >= rect.top && pos.y <= rect.bottom;
    
    if (isOverBoard) {
      // Determine side based on position
      let side = 'right';
      if (GameState.boardState.length === 0) {
        side = 'left';
      } else {
        const centerX = rect.left + rect.width / 2;
        side = pos.x < centerX ? 'left' : 'right';
      }
      
      // Play the tile
      window.socket.emit('playTile', {
        roomId: GameState.roomId,
        seat: GameState.mySeat,
        tile: this.dragState.tileData,
        side: side
      });
    }
    
    // Cleanup
    this.cleanup();
  },
  
  /**
   * Clean up drag state
   */
  cleanup() {
    // Remove dragged element
    if (this.dragState.element) {
      this.dragState.element.remove();
    }
    
    // Restore original tile
    if (this.dragState.originalTile) {
      this.dragState.originalTile.style.opacity = '1';
    }
    
    // Remove drop zones
    document.getElementById('board').classList.remove('drop-hover');
    
    // Remove event listeners
    document.removeEventListener('mousemove', this.handleDragMove);
    document.removeEventListener('mouseup', this.handleDragEnd);
    document.removeEventListener('touchmove', this.handleDragMove);
    document.removeEventListener('touchend', this.handleDragEnd);
    
    // Reset state
    this.dragState = {
      element: null,
      originalTile: null,
      tileData: null,
      isDragging: false,
      offsetX: 0,
      offsetY: 0
    };
  },
  
  /**
   * Show drop zones on board
   */
  showDropZones() {
    const board = document.getElementById('board');
    board.style.border = '3px dashed #ffd700';
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
    }
    return {
      x: event.clientX,
      y: event.clientY
    };
  }
};