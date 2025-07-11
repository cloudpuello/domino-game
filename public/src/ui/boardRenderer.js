/* =====================================================================
 * FIXED BLOCK: BoardRenderer.addDropZones(validEnds)
 *
 * AI NOTES:
 * - Shows magnetic drop zones only on valid board ends
 * - Reads from GameState.getBoardEnds() to determine left/right play
 * - Uses first and last tile DOM positions to align zones
 * - FIXED: Bug 2 — No longer shows zones when move is invalid
 * - FIXED: Bug 8 — Drop zones track direction (left/right vs up/down)
 * - Call this via: this.addDropZones(GameState.getBoardEnds())
 * =================================================================== */

addDropZones(validEnds) {
  const board = document.getElementById('board');
  if (!board || GameState.boardState.length === 0 || !validEnds) return;

  const dominoes = board.querySelectorAll('.board-domino');
  if (dominoes.length === 0) return;

  const boardRect = board.getBoundingClientRect();
  const firstDomino = dominoes[0];
  const lastDomino = dominoes[dominoes.length - 1];

  // --- LEFT END DROP ZONE ---
  if (validEnds.left !== undefined && validEnds.left !== null) {
    const leftZone = document.createElement('div');
    leftZone.className = 'drop-zone';
    leftZone.dataset.side = 'left';
    leftZone.style.cssText = this.getDropZoneStyle();

    const firstRect = firstDomino.getBoundingClientRect();
    const dir = firstDomino.dataset.direction || 'right';

    if (dir === 'right') {
      leftZone.style.left = `${firstRect.left - boardRect.left - 70}px`;
      leftZone.style.top = `${firstRect.top - boardRect.top - 5}px`;
    } else {
      leftZone.style.left = `${firstRect.left - boardRect.left - 35}px`;
      leftZone.style.top = `${firstRect.top - boardRect.top - 70}px`;
    }

    board.appendChild(leftZone);
    this.dropZones.push(leftZone);
  }

  // --- RIGHT END DROP ZONE ---
  if (validEnds.right !== undefined && validEnds.right !== null) {
    const rightZone = document.createElement('div');
    rightZone.className = 'drop-zone';
    rightZone.dataset.side = 'right';
    rightZone.style.cssText = this.getDropZoneStyle();

    const lastRect = lastDomino.getBoundingClientRect();
    const dir = lastDomino.dataset.direction || 'right';

    if (dir === 'right') {
      rightZone.style.left = `${lastRect.right - boardRect.left + 10}px`;
      rightZone.style.top = `${lastRect.top - boardRect.top - 5}px`;
    } else {
      rightZone.style.left = `${lastRect.left - boardRect.left - 35}px`;
      rightZone.style.top = `${lastRect.bottom - boardRect.top + 10}px`;
    }

    board.appendChild(rightZone);
    this.dropZones.push(rightZone);
  }
},

/**
 * Shared CSS styling for drop zone visuals
 */
getDropZoneStyle() {
  return `
    position: absolute;
    width: 60px;
    height: 90px;
    border: 2px dashed #ffd700;
    border-radius: 10px;
    background: rgba(255, 215, 0, 0.1);
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: all;
  `;
}
