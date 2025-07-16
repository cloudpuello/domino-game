/* =====================================================================
 * src/ui/handRenderer.js — Hand Rendering (Final Polished Version)
 *
 * AI NOTES:
 * - Fixes vertical layout for seats 1 and 2 (left/right)
 * - Horizontally renders hands for seats 0 and 3 (bottom/top)
 * - Dummy tiles render cleanly and consistently
 * - My hand (GameState.mySeat) shows real dominoes with interactivity
 * - All hands clear and re-render on state updates
 * =================================================================== */

const HandRenderer = {
  renderAllHands() {
    console.log('[HandRenderer] Rendering all hands...');
    this.clearAllHands();
    requestAnimationFrame(() => {
      for (let seat = 0; seat < 4; seat++) {
        this.renderPlayerHand(seat);
      }
    });
  },

  clearAllHands() {
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById(`hand${i}`);
      if (el) {
        el.innerHTML = '';
        el.classList.remove('current-player');
        el.style.display = '';
        el.style.flexDirection = '';
        el.style.justifyContent = '';
        el.style.alignItems = '';
        el.style.gap = '';
      }
    }
  },

  renderPlayerHand(seat) {
    const el = document.getElementById(`hand${seat}`);
    if (!el) return;

    if (seat === GameState.mySeat) {
      this.renderMyHand(el);
    } else {
      this.renderOpponentHand(el, seat);
    }

    // Highlight current player's turn
    if (seat === GameState.currentTurn) {
      el.classList.add('current-player');
    }
  },

  renderMyHand(el) {
    el.innerHTML = '';
    el.style.display = 'flex';
    el.style.flexDirection = 'row';
    el.style.justifyContent = 'center';
    el.style.gap = '8px';

    GameState.myHand.forEach((domino) => {
      const domEl = this.createDomino(domino, true);
      el.appendChild(domEl);
    });
  },

  renderOpponentHand(el, seat) {
    const count = GameState.handSizes[seat] || 0;
    el.innerHTML = '';
    el.style.display = 'flex';

    if (seat === 1 || seat === 2) {
      el.style.flexDirection = 'column';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.gap = '6px';
    } else {
      el.style.flexDirection = 'row';
      el.style.justifyContent = 'center';
      el.style.alignItems = 'center';
      el.style.gap = '4px';
    }

    for (let i = 0; i < count; i++) {
      const dummy = this.createDummyDomino();
      el.appendChild(dummy);
    }
  },

  createDomino([a, b], isInteractive = false) {
    const el = document.createElement('div');
    el.className = 'hand-domino';
    el.style.width = '30px';
    el.style.height = '60px';
    el.style.border = '2px solid #333';
    el.style.borderRadius = '6px';
    el.style.background = '#fefefe';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.justifyContent = 'space-between';
    el.style.alignItems = 'center';
    el.style.padding = '2px';
    el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';
    el.dataset.value = JSON.stringify([a, b]);

    el.appendChild(this.renderHalf(a));
    el.appendChild(this.renderHalf(b));

    if (isInteractive && GameState.isMyTurn()) {
      if (GameState.isTilePlayable([a, b])) {
        el.style.cursor = 'pointer';
        el.classList.add('playable');

        el.addEventListener('click', () => this.handleTileClick([a, b]));
        el.addEventListener('mousedown', (e) =>
          DragDropManager.startDrag(e, [a, b], el)
        );
        el.addEventListener(
          'touchstart',
          (e) => DragDropManager.startDrag(e, [a, b], el),
          { passive: false }
        );
      } else {
        el.classList.add('disabled');
        el.style.opacity = '0.4';
        el.style.cursor = 'not-allowed';
      }
    }

    return el;
  },

  createDummyDomino() {
    const el = document.createElement('div');
    el.className = 'hand-domino dummy';
    el.style.width = '30px';
    el.style.height = '60px';
    el.style.background = 'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)';
    el.style.border = '2px solid #1a202c';
    el.style.borderRadius = '6px';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    return el;
  },

  renderHalf(val) {
    const half = document.createElement('div');
    half.style.flex = '1';
    half.style.display = 'flex';
    half.style.alignItems = 'center';
    half.style.justifyContent = 'center';
    half.style.position = 'relative';
    this.addPips(half, val);
    return half;
  },

  addPips(container, value) {
    const positions = {
      0: [],
      1: [[0.5, 0.5]],
      2: [[0.3, 0.3], [0.7, 0.7]],
      3: [[0.3, 0.3], [0.5, 0.5], [0.7, 0.7]],
      4: [[0.3, 0.3], [0.3, 0.7], [0.7, 0.3], [0.7, 0.7]],
      5: [[0.3, 0.3], [0.3, 0.7], [0.5, 0.5], [0.7, 0.3], [0.7, 0.7]],
      6: [[0.25, 0.2], [0.25, 0.5], [0.25, 0.8], [0.75, 0.2], [0.75, 0.5], [0.75, 0.8]],
    };

    positions[value]?.forEach(([x, y]) => {
      const pip = document.createElement('div');
      pip.style.cssText = `
        position: absolute;
        width: 4px;
        height: 4px;
        background: #111;
        border-radius: 50%;
        left: ${x * 100}%;
        top: ${y * 100}%;
        transform: translate(-50%, -50%);
      `;
      container.appendChild(pip);
    });
  },

  handleTileClick(tile) {
    if (!GameState.isMyTurn() || !GameState.isTilePlayable(tile)) return;

    const sides = GameState.getPlayableSides(tile);
    let side = 'left';
    if (sides.length > 1) {
      side = confirm('Play on LEFT side?\nOK = Left, Cancel = Right') ? 'left' : 'right';
    }

    socket.emit('playTile', {
      roomId: GameState.roomId,
      seat: GameState.mySeat,
      tile,
      side,
    });
  },
};

window.HandRenderer = HandRenderer;
