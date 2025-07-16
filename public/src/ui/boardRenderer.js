/* =====================================================================
 * src/ui/boardRenderer.js — FIXED Board Renderer
 * 
 * FIXES APPLIED:
 * - Proper board rendering (was showing hand rendering code)
 * - Added missing render() method
 * - Added showDropZones() and hideDropZones()
 * =================================================================== */

const BoardRenderer = {
  /**
   * Render all dominoes currently on the board
   */
  render(boardState = GameState.board) {
    const boardContainer = document.getElementById('board');
    if (!boardContainer) return;

    // Clear board
    boardContainer.innerHTML = '';

    // Render each domino
    boardState.forEach((tile, index) => {
      const dominoEl = this.createDominoElement(tile);
      boardContainer.appendChild(dominoEl);
    });
  },

  /**
   * Create a DOM element for a domino tile
   */
  createDominoElement(tile) {
    const el = document.createElement('div');
    el.className = 'board-domino';
    el.setAttribute('data-left', tile.left);
    el.setAttribute('data-right', tile.right);

    el.innerHTML = `
      <div class="pip">${tile.left}</div>
      <div class="divider"></div>
      <div class="pip">${tile.right}</div>
    `;

    return el;
  },

  /**
   * Show valid drop zones (if applicable)
   */
  showDropZones(validSides = ['left', 'right']) {
    validSides.forEach(side => {
      const dropZone = document.createElement('div');
      dropZone.classList.add('drop-zone');
      dropZone.classList.add(`drop-zone-${side}`);
      dropZone.textContent = `Drop on ${side}`;
      dropZone.dataset.side = side;
      document.getElementById('board').appendChild(dropZone);
    });
  },

  /**
   * Hide all drop zones
   */
  hideDropZones() {
    document.querySelectorAll('.drop-zone').forEach(el => el.remove());
  }
};

window.BoardRenderer = BoardRenderer;
