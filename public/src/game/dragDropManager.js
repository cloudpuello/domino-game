/* =====================================================================
 * src/game/dragDropManager.js — Handles Domino Dragging (FIXED)
 * 
 * FIXES APPLIED:
 * - Better validation before starting drag
 * - Precise drop zone detection
 * - Improved visual feedback
 * - Only allows dragging playable tiles
 * - Better hover detection for drop zones
 * =================================================================== */

const DragDropManager = {
  dragState: {
    element: null,
    originalTile: null,
    tileData: null,
    isDragging: false,
    offsetX: 0,
    offsetY: 0,
    hoveredZone: null,
    startX: 0,
    startY: 0
  },
  
  /**
   * FIXED: Start dragging with better validation
   */
  startDrag(event, tile, tileElement) {
    if (event.type === 'touchstart') {
      event.preventDefault();
    }
    
    // Validate drag conditions
    if (this.dragState.isDragging) return;
    if (!GameState.isMyTurn()) {
      console.log('DragDrop: Not your turn');
      return;
    }
    if (!GameState.isTilePlayable(tile)) {
      console.log('DragDrop: Tile not playable', tile);
      return;
    }
    
    console.log('DragDrop: Starting drag for tile', tile);
    
    // Set drag state
    this.dragState.tileData = tile;
    this.dragState.originalTile = tileElement;
    this.dragState.isDragging = true;
    
    // Get initial position
    const pos = this.getEventPosition(event);
    const rect = tileElement.getBoundingClientRect();
    this.dragState.offsetX = pos.x - rect.left;
    this.dragState.offsetY = pos.y - rect.top;
    this.dragState.startX = pos.x;
    this.dragState.startY = pos.y;
    
    // Create dragged element
    this.createDragElement(tileElement, pos);
    
    // Hide original and add visual feedback
    tileElement.style.opacity = '0.3';
    tileElement.style.transform = 'scale(0.95)';
    
    // Add event listeners
    document.addEventListener('mousemove', this.handleDragMove.bind(this));
    document.addEventListener('mouseup', this.handleDragEnd.bind(this));
    document.addEventListener('touchmove', this.handleDragMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.handleDragEnd.bind(this));
    
    // Show drop zones
    BoardRenderer.showDropZones();
    
    // Add dragging class to body for cursor
    document.body.classList.add('dragging');
  },
  
  /**
   * FIXED: Create dragged element with better styling
   */
  createDragElement(tileElement, pos) {
    this.dragState.element = tileElement.cloneNode(true);
    
    // Remove any existing classes and add dragging class
    this.dragState.element.className = 'hand-domino dragging';
    
    this.dragState.element.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 1000;
      left: ${pos.x - this.dragState.offsetX}px;
      top: ${pos.y - this.dragState.offsetY}px;
      width: 30px;
      height: 60px;
      transform: scale(1.2) rotate(5deg);
      box-shadow: 0 8px 25px rgba(0,0,0,0.4);
      border: 2px solid #ffd700;
      background: #fff;
      border-radius: 6px;
      transition: none;
    `;
    
    document.body.appendChild(this.dragState.element);
  },
  
  /**
   * FIXED: Handle drag movement with precise drop zone detection
   */
  handleDragMove(event) {
    if (!this.dragState.isDragging) return;
    
    event.preventDefault();
    const pos = this.getEventPosition(event);
    
    // Update dragged element position
    this.dragState.element.style.left = `${pos.x - this.dragState.offsetX}px`;
    this.dragState.element.style.top = `${pos.y - this.dragState.offsetY}px`;
    
    // Check distance moved (for click vs drag detection)
    const distanceMoved = Math.sqrt(
      Math.pow(pos.x - this.dragState.startX, 2) + 
      Math.pow(pos.y - this.dragState.startY, 2)
    );
    
    // Only check drop zones if actually dragging (not just clicking)
    if (distanceMoved > 10) {
      this.checkDropZoneHover(pos);
    }
  },
  
  /**
   * FIXED: Check drop zone hover with precise detection
   */
  checkDropZoneHover(pos) {
    // Clear previous hover state
    if (this.dragState.hoveredZone) {
      BoardRenderer.unhighlightDropZone(this.dragState.hoveredZone);
      this.dragState.hoveredZone = null;
    }
    
    // Find drop zone under cursor
    const dropZones = document.querySelectorAll('.drop-zone');
    let hoveredZone = null;
    
    dropZones.forEach(zone => {
      const rect = zone.getBoundingClientRect();
      const isOver = pos.x >= rect.left && pos.x <= rect.right &&
                     pos.y >= rect.top && pos.y <= rect.bottom;
      
      if (isOver) {
        // Validate that this tile can actually play on this side
        const side = zone.dataset.side;
        const playableSides = GameState.getPlayableSides(this.dragState.tileData);
        
        if (playableSides.includes(side)) {
          hoveredZone = zone;
        }
      }
    });
    
    // Update hover state
    if (hoveredZone) {
      BoardRenderer.highlightDropZone(hoveredZone);
      this.dragState.hoveredZone = hoveredZone;
      document.body.style.cursor = 'grabbing';
      
      // Update drag element to show valid drop
      this.dragState.element.style.borderColor = '#4CAF50';
      this.dragState.element.style.boxShadow = '0 8px 25px rgba(76, 175, 80, 0.4)';
    } else {
      document.body.style.cursor = 'not-allowed';
      
      // Update drag element to show invalid drop
      this.dragState.element.style.borderColor = '#f44336';
      this.dragState.element.style.boxShadow = '0 8px 25px rgba(244, 67, 54, 0.4)';
    }
  },
  
  /**
   * FIXED: Handle drag end with validation
   */
  handleDragEnd(event) {
    if (!this.dragState.isDragging) return;
    
    console.log('DragDrop: Drag ended');
    
    // Check if dropped on valid zone
    if (this.dragState.hoveredZone) {
      const side = this.dragState.hoveredZone.dataset.side;
      
      // Double-check that move is valid
      if (GameState.validateMove(this.dragState.tileData, side)) {
        console.log('DragDrop: Playing tile', this.dragState.tileData, 'on', side);
        
        // Play the tile
        window.socket.emit('playTile', {
          roomId: GameState.roomId,
          seat: GameState.mySeat,
          tile: this.dragState.tileData,
          side: side
        });
        
        // Success feedback
        this.showSuccessFeedback();
      } else {
        console.log('DragDrop: Invalid move on validation');
        this.animateBack();
      }
    } else {
      console.log('DragDrop: No valid drop zone');
      this.animateBack();
    }
    
    // Always cleanup after a short delay
    setTimeout(() => this.cleanup(), 300);
  },
  
  /**
   * Show success feedback
   */
  showSuccessFeedback() {
    if (this.dragState.element) {
      this.dragState.element.style.transition = 'all 0.3s ease';
      this.dragState.element.style.transform = 'scale(0.8) rotate(0deg)';
      this.dragState.element.style.opacity = '0';
    }
  },
  
  /**
   * FIXED: Animate tile back to original position
   */
  animateBack() {
    if (this.dragState.element && this.dragState.originalTile) {
      const originalRect = this.dragState.originalTile.getBoundingClientRect();
      
      this.dragState.element.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      this.dragState.element.style.left = `${originalRect.left}px`;
      this.dragState.element.style.top = `${originalRect.top}px`;
      this.dragState.element.style.transform = 'scale(1) rotate(0deg)';
      this.dragState.element.style.borderColor = '#333';
      
      // Bounce effect
      setTimeout(() => {
        if (this.dragState.originalTile) {
          this.dragState.originalTile.style.transform = 'scale(1.1)';
          setTimeout(() => {
            if (this.dragState.originalTile) {
              this.dragState.originalTile.style.transform = 'scale(1)';
            }
          }, 150);
        }
      }, 200);
    }
  },
  
  /**
   * FIXED: Clean up drag state thoroughly
   */
  cleanup() {
    console.log('DragDrop: Cleaning up');
    
    // Remove dragged element
    if (this.dragState.element && this.dragState.element.parentNode) {
      this.dragState.element.remove