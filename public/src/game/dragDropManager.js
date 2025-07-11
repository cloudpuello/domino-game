/* =====================================================================
 * src/game/dragDropManager.js — Handles Domino Dragging
 * 
 * AI NOTES:
 * - Supports both mouse and touch
 * - Visual feedback during drag
 * - Validates drop locations
 * - FIXED: Bug 2 - Works with specific drop zones
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
    BoardRenderer.showDropZones();
  },
  
  /**
   * Handle drag movement - UPDATED FOR SPECIFIC DROP ZONES
   */
  handleDragMove(event) {
    if (!this.dragState.isDragging) return;
    
    event.preventDefault();
    const pos = this.getEventPosition(event);
    
    // Update position
    this.dragState.element.style.left = `${pos.x - this.dragState.offsetX}px`;
    this.dragState.element.style.top = `${pos.y - this.dragState.offsetY}px`;
    
    // Check for hover over drop zones (not entire board)
    const dropZones = document.querySelectorAll('.drop-zone');
    let hoveredZone = null;
    
    dropZones.forEach(zone => {
      const rect = zone.getBoundingClientRect();
      const isOver = pos.x >= rect.left && pos.x <= rect.right &&
                     pos.y >= rect.top && pos.y <= rect.bottom;
      
      if (isOver) {
        hoveredZone = zone;
        zone.style.opacity = '1';
        zone.style.background = 'rgba(255, 215, 0, 0.3)';
        zone.style.borderColor = '#ffd700';
        zone.style.borderWidth = '3px';
      } else {
        zone.style.opacity = '0.5';
        zone.style.background = 'rgba(255, 215, 0, 0.1)';
        zone.style.borderColor = '#ffd700';
        zone.style.borderWidth = '2px';
      }
    });
    
    this.dragState.hoveredZone = hoveredZone;
    
    // Update cursor
    document.body.style.cursor = hoveredZone ? 'pointer' : 'not-allowed';
  },
  
  /**
   * Handle drag end - UPDATED FOR SPECIFIC DROP ZONES
   */
  handleDragEnd(event) {
    if (!this.dragState.isDragging) return;
    
    // Check if dropped on a valid zone
    if (this.dragState.hoveredZone) {
      const side = this.dragState.hoveredZone.dataset.side;
      
      // Play the tile
      window.socket.emit('playTile', {
        roomId: GameState.roomId,
        seat: GameState.mySeat,
        tile: this.dragState.tileData,
        side: side
      });
      
      console.log('Dropped tile on', side, 'side');
    } else {
      // Not dropped on valid zone - animate back
      this.animateBack();
    }
    
    // Cleanup
    this.cleanup();
  },
  
  /**
   * Animate tile back to original position
   */
  animateBack() {
    if (this.dragState.element && this.dragState.originalTile) {
      const originalRect = this.dragState.originalTile.getBoundingClientRect();
      this.dragState.element.style.transition = 'all 0.3s ease';
      this.dragState.element.style.left = `${originalRect.left}px`;
      this.dragState.element.style.top = `${originalRect.top}px`;
      this.dragState.element.style.transform = 'scale(1)';
      
      setTimeout(() => {
        this.cleanup();
      }, 300);
    }
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
    
    // Hide drop zones
    BoardRenderer.hideDropZones();
    
    // Reset cursor
    document.body.style.cursor = 'default';
    
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
      offsetY: 0,
      hoveredZone: null
    };
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