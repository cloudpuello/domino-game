/* =====================================================================
 * src/game/dragDropManager.js — Handles Domino Dragging
 *
 * AI NOTES:
 * - Drag/drop interface using GameState and BoardRenderer
 * - Uses GameState.getBoardEnds() to render accurate drop zones
 * - Only allows drops on left/right ends, UI emits side to server
 * - Claude: You may improve animations or tile rotations, but keep logic
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
   * Start dragging a tile from player's hand
   */
  startDrag(event, tile, tileElement) {
    if (event.type === 'touchstart') event.preventDefault();
    if (this.dragState.isDragging || !GameState.isMyTurn()) return;
    if (!GameState.isTilePlayable(tile)) return;

    const pos = this.getEventPosition(event);
    const rect = tileElement.getBoundingClientRect();

    this.dragState = {
      ...this.dragState,
      tileData: tile,
      originalTile: tileElement,
      isDragging: true,
      offsetX: pos.x - rect.left,
      offsetY: pos.y - rect.top
    };

    // Clone dragged tile for smooth drag experience
    const ghost = tileElement.cloneNode(true);
    ghost.style.cssText = `
      position: fixed;
      z-index: 999;
      pointer-events: none;
      opacity: 0.9;
      transform: scale(1.05);
      width: ${tileElement.offsetWidth}px;
      height: ${tileElement.offsetHeight}px;
      left: ${pos.x - this.dragState.offsetX}px;
      top: ${pos.y - this.dragState.offsetY}px;
    `;
    document.body.appendChild(ghost);
    this.dragState.element = ghost;

    tileElement.style.opacity = '0.3';

    document.addEventListener('mousemove', this.handleDragMove.bind(this));
    document.addEventListener('mouseup', this.handleDragEnd.bind(this));
    document.addEventListener('touchmove', this.handleDragMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.handleDragEnd.bind(this));

    // AI NOTE: Show only valid ends using current board state
    BoardRenderer.showDropZones(GameState.getBoardEnds());
  },

  /**
   * Move tile as user drags it
   */
  handleDragMove(event) {
    if (!this.dragState.isDragging) return;
    event.preventDefault();

    const pos = this.getEventPosition(event);
    const { element, offsetX, offsetY } = this.dragState;

    element.style.left = `${pos.x - offsetX}px`;
    element.style.top = `${pos.y - offsetY}px`;

    // Detect drop zone collision
    const zones = document.querySelectorAll('.drop-zone');
    let hovered = null;

    zones.forEach(zone => {
      const rect = zone.getBoundingClientRect();
      const isOver = pos.x >= rect.left && pos.x <= rect.right &&
                     pos.y >= rect.top && pos.y <= rect.bottom;
      if (isOver) {
        hovered = zone;
        zone.classList.add('active-drop-zone');
      } else {
        zone.classList.remove('active-drop-zone');
      }
    });

    this.dragState.hoveredZone = hovered;
    document.body.style.cursor = hovered ? 'pointer' : 'not-allowed';
  },

  /**
   * End of drag event
   */
  handleDragEnd(event) {
    if (!this.dragState.isDragging) return;

    const zone = this.dragState.hoveredZone;

    if (zone) {
      const side = zone.dataset.side;

      // Emit tile and side to server
      window.socket.emit('playTile', {
        roomId: GameState.roomId,
        seat: GameState.mySeat,
        tile: this.dragState.tileData,
        side: side
      });
    } else {
      // Animate back if drop was invalid
      this.animateBack();
    }

    this.cleanup();
  },

  /**
   * Animate tile return if dropped outside
   */
  animateBack() {
    const { element, originalTile } = this.dragState;
    if (!element || !originalTile) return;

    const rect = originalTile.getBoundingClientRect();
    element.style.transition = 'all 0.3s ease';
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.transform = 'scale(1)`;

    setTimeout(() => this.cleanup(), 300);
  },

  /**
   * Reset drag state and cleanup UI
   */
  cleanup() {
    const { element, originalTile } = this.dragState;

    if (element) element.remove();
    if (originalTile) originalTile.style.opacity = '1';

    BoardRenderer.hideDropZones();
    document.body.style.cursor = 'default';

    document.removeEventListener('mousemove', this.handleDragMove);
    document.removeEventListener('mouseup', this.handleDragEnd);
    document.removeEventListener('touchmove', this.handleDragMove);
    document.removeEventListener('touchend', this.handleDragEnd);

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
   * Get mouse/touch position
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

export default DragDropManager;
