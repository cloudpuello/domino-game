/* =====================================================================
 * src/ui/handRenderer.js — Renders Player Hands with Interaction
 * 
 * AI NOTES:
 * - Renders hand based on GameState.hand and seat position
 * - For local player (seat 0): shows draggable/clickable tiles
 * - For opponents (seats 1–3): shows tile backs, spaced horizontally or vertically
 * - Uses drag-and-drop AND click fallback to support both play styles
 * =================================================================== */

const HandRenderer = {
  /**
   * Render all hands (player + opponents)
   */
  renderHands() {
    for (let seat = 0; seat < 4; seat++) {
      this.renderSeatHand(seat);
    }
  },

  /**
   * Render a single seat's hand
   */
  renderSeatHand(seat) {
    const handContainer = document.getElementById(`hand${seat}`);
    if (!handContainer) return;

    handContainer.innerHTML = '';

    // Local player — render real hand with interaction
    if (seat === GameState.mySeat) {
      GameState.hand.forEach((domino, index) => {
        const tile = this.createDominoTile(domino, true, index);
        handContainer.appendChild(tile);
      });
    } 
    // Other players — render tile backs
    else {
      const opponent = GameState.players.find(p => p && p.seat === seat);
      const tileCount = opponent?.handSize || 0;

      for (let i = 0; i < tileCount; i++) {
        const tile = this.createDominoTile(null, false, i);
        handContainer.appendChild(tile);
      }
    }

    this.styleHandLayout(handContainer, seat);
  },

  /**
   * Create visual domino tile
   */
  createDominoTile(domino, isLocalPlayer, index) {
    const tile = document.createElement('div');
    tile.className = 'hand-domino';
    tile.style.cssText = `
      width: 40px;
      height: 80px;
      margin: 4px;
      background: ${isLocalPlayer ? 'white' : '#ccc'};
      border: 2px solid #333;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
      cursor: ${isLocalPlayer ? 'grab' : 'default'};
    `;

    if (isLocalPlayer) {
      // Top and bottom faces
      const top = document.createElement('div');
      top.style.flex = '1';
      top.style.display = 'flex';
      top.style.alignItems = 'center';
      top.style.justifyContent = 'center';
      top.style.borderBottom = '1px solid #333';
      top.style.fontWeight = 'bold';
      top.textContent = domino[0];

      const bottom = document.createElement('div');
      bottom.style.flex = '1';
      bottom.style.display = 'flex';
      bottom.style.alignItems = 'center';
      bottom.style.justifyContent = 'center';
      bottom.style.fontWeight = 'bold';
      bottom.textContent = domino[1];

      tile.appendChild(top);
      tile.appendChild(bottom);

      // Add drag/click logic
      tile.draggable = true;
      tile.dataset.index = index;

      tile.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', index);
        BoardRenderer.showDropZones();
      });

      tile.addEventListener('dragend', () => {
        BoardRenderer.hideDropZones();
      });

      tile.addEventListener('click', () => {
        DragDropManager.playTile(index); // fallback for mobile
      });
    }

    return tile;
  },

  /**
   * Apply layout styles per seat position
   */
  styleHandLayout(container, seat) {
    const horizontal = seat === 0 || seat === 2;
    container.style.display = 'flex';
    container.style.flexDirection = horizontal ? 'row' : 'column';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.flexWrap = 'nowrap';
    container.style.height = '100%';
    container.style.width = '100%';
  }
};

window.HandRenderer = HandRenderer;
