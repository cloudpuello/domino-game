/* =====================================================================
 * src/game/dragDropManager.js — COMPLETELY REWRITTEN TO FIX DRAG
 * 
 * FIXES:
 * - Drag and drop now works properly
 * - Fixed event binding issues
 * - Better touch support
 * - Proper cleanup
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
    drag.className = 'hand-