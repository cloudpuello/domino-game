/* ====================================================================
 * BoardRenderer  —  super‑light train + drop‑zone demo
 * --------------------------------------------------------------------
 * • Renders a flat horizontal “train” centred on #board.
 * • Hard‑coded demo state if none supplied ( [[6,6], [6,1], [1,4]] ).
 * • Adds .drop-zone elements at each playable end.
 * • Exposes promptSideChoice() so HandRenderer can flash / pick ends.
 * ==================================================================== */

(function () {
  const BOARD_ID = 'board';
  const $ = (id) => document.getElementById(id);

  /* public ---------------------------------------------------------- */
  window.BoardRenderer = {
    /** Render a board array e.g. [[6,6],[6,1],[1,4]] */
    render(board = demoState) {
      const root = $(BOARD_ID);
      if (!root) return;

      root.innerHTML = '';                // clear previous tiles / zones
      const startX = root.clientWidth  / 2;
      const startY = root.clientHeight / 2;
      const dx     = 54;                  // spacing between tiles

      board.forEach((tile, idx) => {
        const el = createBoardTile(tile);
        el.style.left = `${startX + (idx - board.length / 2) * dx}px`;
        el.style.top  = `${startY - parseInt(getComputedStyle(el).height) / 2}px`;
        root.appendChild(el);
      });

      drawDropZones(root, board);
    },

    /** Called by HandRenderer when both ends are legal. */
    promptSideChoice(tile, sides, onChosen) {
      const zones = [...document.querySelectorAll('.drop-zone')];
      zones.forEach((z) => {
        if (!sides.includes(z.dataset.side)) return;   // ignore blocked end
        z.classList.add('drop-zone--active');
        z.addEventListener('click', () => {
          clearZones();
          onChosen(tile, z.dataset.side);
        }, { once: true });
      });
    },

    clear: clearZones          // utility if you need it elsewhere
  };

  /* helpers --------------------------------------------------------- */

  const demoState = [[6, 6], [6, 1], [1, 4]];   // visible on first load

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
      pip.style.top  = `${y * 100}%`;
      half.appendChild(pip);
    });
    return half;
  }

  const pipPatterns = {
    0: [], 1: [[.5,.5]], 2: [[.3,.3],[.7,.7]],
    3: [[.3,.3],[.5,.5],[.7,.7]],
    4: [[.3,.3],[.3,.7],[.7,.3],[.7,.7]],
    5: [[.3,.3],[.3,.7],[.5,.5],[.7,.3],[.7,.7]],
    6: [[.25,.2],[.25,.5],[.25,.8],[.75,.2],[.75,.5],[.75,.8]],
  };

  /* drop‑zones ------------------------------------------------------ */

  function drawDropZones(root, board) {
    clearZones();

    const first = board[0], last = board[board.length - 1];
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
    z.style.top  = `${y}px`;
    return z;
  }

  function getDominoEnd(root, idx, side) {
    const dom = root.children[idx];
    const rect = dom.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    return {
      x: side === 'left'  ? rect.left  - rootRect.left
                          : rect.right - rootRect.left,
      y: rect.top - rootRect.top
    };
  }

  function clearZones() {
    document.querySelectorAll('.drop-zone').forEach((z) => z.remove());
  }
})();
