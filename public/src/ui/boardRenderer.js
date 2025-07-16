/* ====================================================================
 * BoardRenderer — Renders the train and drop-zones
 * ==================================================================== */

(function () {
  const BOARD_ID = 'board';
  const $ = (id) => document.getElementById(id);

  window.BoardRenderer = {
    render(board = null) {
      const root = $(BOARD_ID);
      if (!root) return;

      // Use provided board, or fallback to global GameState
      const tiles = board && board.length ? board : (window.GameState?.boardState || []);
      
      root.innerHTML = '';
      if (tiles.length === 0) return; // Don't render if board is empty

      const startX = root.clientWidth / 2;
      const startY = root.clientHeight / 2;
      const dx = 54;

      // Loop over the resolved 'tiles' array
      tiles.forEach((tile, idx) => {
        const el = createBoardTile(tile);
        // This simple layout needs to be replaced with a real train algorithm later
        el.style.left = `${startX + (idx - tiles.length / 2) * dx}px`;
        el.style.top = `${startY - parseInt(getComputedStyle(el).height) / 2}px`;
        root.appendChild(el);
      });
    },

    promptSideChoice(tile, sides, onChosen) {
      const zones = [...document.querySelectorAll('.drop-zone')];
      zones.forEach((z) => {
        if (!sides.includes(z.dataset.side)) return;
        z.classList.add('drop-zone--active');
        z.addEventListener('click', () => {
          this.hideDropZones();
          onChosen(tile, z.dataset.side);
        }, { once: true });
      });
    },

    // --- NEW & FIXED METHODS ---

    /**
     * Renders the drop zones at the ends of the current board state.
     * Called by DragDropManager.
     */
    showDropZones() {
        const root = $(BOARD_ID);
        if (!root) return;
        const board = window.GameState?.boardState || [];
        drawDropZones(root, board);
    },

    /**
     * Removes all drop zones from the board.
     * Called by DragDropManager.
     */
    hideDropZones() {
        clearZones();
    },

    clear() {
        const root = $(BOARD_ID);
        if (root) root.innerHTML = '';
        clearZones();
    }
  };

  /* private helpers */
  function createBoardTile([a, b]) {
    const el = document.createElement('div');
    el.className = 'domino domino--board';
    el.appendChild(createHalf(a));
    el.appendChild(createHalf(b));
    return el;
  }

  function createHalf(val) {
    const half = document.createElement('div');
    half.className = 'domino-half';
    pipPatterns[val].forEach(([x, y]) => {
      const pip = document.createElement('div');
      pip.className = 'domino-pip';
      pip.style.left = `${x * 100}%`;
      pip.style.top = `${y * 100}%`;
      half.appendChild(pip);
    });
    return half;
  }

  const pipPatterns = { 0: [], 1: [[.5, .5]], 2: [[.3, .3], [.7, .7]], 3: [[.3, .3], [.5, .5], [.7, .7]], 4: [[.3, .3], [.3, .7], [.7, .3], [.7, .7]], 5: [[.3, .3], [.3, .7], [.5, .5], [.7, .3], [.7, .7]], 6: [[.25, .2], [.25, .5], [.25, .8], [.75, .2], [.75, .5], [.75, .8]], };

  function drawDropZones(root, board) {
    if (board.length === 0) return;
    clearZones();
    const firstLeft = getDominoEnd(root, 0, 'left');
    const lastRight = getDominoEnd(root, board.length - 1, 'right');
    root.appendChild(makeZone(firstLeft.x - 70, firstLeft.y, 'left'));
    root.appendChild(makeZone(lastRight.x + 10, lastRight.y, 'right'));
  }

  function makeZone(x, y, side) {
    const z = document.createElement('div');
    z.className = 'drop-zone';
    z.dataset.side = side;
    z.style.left = `${x}px`;
    z.style.top = `${y}px`;
    return z;
  }

  function getDominoEnd(root, idx, side) {
    const dom = root.children[idx];
    if (!dom) return { x: 0, y: 0 };
    const rect = dom.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    return { x: side === 'left' ? rect.left - rootRect.left : rect.right - rootRect.left, y: rect.top - rootRect.top };
  }

  function clearZones() {
    document.querySelectorAll('.drop-zone').forEach((z) => z.remove());
  }
})();
