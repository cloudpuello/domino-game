/* =====================================================================
 * src/game/dragDropManager.js — COMPLETE DRAG AND DROP MANAGER
 * 
 * FIXES:
 * - Complete implementation
 * - Better event handling
 * - Proper cleanup
 * - Touch support
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
    // Prevent if already dragging
    if (this.dragState.isDragging) return;
    
    // Validate turn and tile
    if (!GameState.isMyTurn() || !GameState.isTilePlayable(tile)) {
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
    
    // Get mouse/touch position
    const pos = this.getEventPosition(event);
    const rect = tileElement.getBoundingClientRect();
    this.dragState.offsetX = pos.x - rect.left;
    this.dragState.offsetY = pos.y - rect.top;
    
    // Create drag element
    this.createDragElement(tileElement, pos);
    
    // Hide original
    tileElement.style.opacity = '0.4';
    
    // Add event listeners
    document.addEventListener('mousemove', this.handleDragMove.bind(this), { passive: false });
    document.addEventListener('mouseup', this.handleDragEnd.bind(this));
    document.addEventListener('touchmove', this.handleDragMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.handleDragEnd.bind(this));
    
    // Show drop zones
    BoardRenderer.showDropZones();
    document.body.classList.add('dragging');
  },
  
  /**
   * Create the dragged element
   */
  createDragElement(original, pos) {
    const drag = original.cloneNode(true);
    drag.className = 'hand-domino dragging-tile';
    drag.style.cssText = `
      position: fixed;
      left: ${pos.x - this.dragState.offsetX}px;
      top: ${pos.y - this.dragState.offsetY}px;
      width: 30px;
      height: 60px;
      z-index: 1000;
      pointer-events: none;
      transform: rotate(0deg) scale(1.2);
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      border: 3px solid #ffd700;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
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
    
    // Check for drop zones
    this.updateHoveredZone(pos);
  },
  
  /**
   * Handle drag end
   */
  handleDragEnd(event) {
    if (!this.dragState.isDragging) return;
    
    event.preventDefault();
    
    // Check if over a valid drop zone
    const pos = this.getEventPosition(event);
    const dropZone = this.getDropZoneAt(pos);
    
    if (dropZone) {
      this.handleDrop(dropZone);
    } else {
      this.handleInvalidDrop();
    }
    
    this.cleanup();
  },
  
  /**
   * Handle valid drop
   */
  handleDrop(dropZone) {
    const side = dropZone.dataset.side;
    console.log('Dropping tile on side:', side);
    
    // Send move to server
    window.socket.emit('playTile', {
      roomId: GameState.roomId,
      seat: GameState.mySeat,
      tile: this.dragState.tileData,
      side: side
    });
  },
  
  /**
   * Handle invalid drop
   */
  handleInvalidDrop() {
    console.log('Invalid drop location');
    UIManager.showError('Drop the tile on a valid drop zone');
    
    // Animate back to original position
    if (this.dragState.originalTile) {
      this.dragState.originalTile.style.opacity = '1';
    }
  },
  
  /**
   * Update hovered zone highlighting
   */
  updateHoveredZone(pos) {
    const dropZone = this.getDropZoneAt(pos);
    
    // Remove previous hover
    if (this.dragState.hoveredZone && this.dragState.hoveredZone !== dropZone) {
      this.dragState.hoveredZone.style.background = 'rgba(255, 215, 0, 0.1)';
      this.dragState.hoveredZone.style.borderColor = '#ffd700';
    }
    
    // Add new hover
    if (dropZone) {
      dropZone.style.background = 'rgba(255, 215, 0, 0.3)';
      dropZone.style.borderColor = '#ffed4e';
      this.dragState.hoveredZone = dropZone;
    } else {
      this.dragState.hoveredZone = null;
    }
  },
  
  /**
   * Get drop zone at position
   */
  getDropZoneAt(pos) {
    const elements = document.elementsFromPoint(pos.x, pos.y);
    return elements.find(el => el.classList.contains('drop-zone'));
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
        x: event.clientX,
        y: event.clientY
      };
    }
  },
  
  /**
   * Clean up drag state
   */
  cleanup() {
    // Remove event listeners
    document.removeEventListener('mousemove', this.handleDragMove.bind(this));
    document.removeEventListener('mouseup', this.handleDragEnd.bind(this));
    document.removeEventListener('touchmove', this.handleDragMove.bind(this));
    document.removeEventListener('touchend', this.handleDragEnd.bind(this));
    
    // Remove drag element
    if (this.dragState.element && this.dragState.element.parentNode) {
      this.dragState.element.remove();
    }
    
    // Restore original tile
    if (this.dragState.originalTile) {
      this.dragState.originalTile.style.opacity = '1';
    }
    
    // Hide drop zones
    BoardRenderer.hideDropZones();
    
    // Remove body class
    document.body.classList.remove('dragging');
    
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
   * Initialize drag and drop (called by game manager)
   */
  init() {
    console.log('DragDropManager: Initialized');
    
    // Add CSS for dragging state
    const style = document.createElement('style');
    style.textContent = `
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
      
      .drop-zone {
        transition: all 0.2s ease !important;
      }
      
      .drop-zone:hover {
        background: rgba(255, 215, 0, 0.3) !important;
        border-color: #ffed4e !important;
        transform: scale(1.05) !important;
      }
    `;
    document.head.appendChild(style);
  }
};