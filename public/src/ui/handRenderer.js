/* ==================================================================== *
 * HandRenderer  —  renders all four hands, CSS-driven                  *
 * -------------------------------------------------------------------- *
 * • No inline layout styles. Orientation/rotation purely via CSS.     *
 * • Uses DominoUtils for playability checks.                          *
 * • Adds `.playable` when a tile is legal this turn.                  *
 * • Click → quick-play; if both ends open, defers to BoardRenderer.    *
 * • Drag hooks hand off to global DragDropManager.                    *
 * ==================================================================== */

(function () {
  /* utilities ------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);

  /* public API ------------------------------------------------------ */
  window.HandRenderer = {
    /** Re-render every seat (0-3) */
    renderAll() {
      for (let seat = 0; seat < 4; seat++) {
        clearSeat(seat);
        renderSeat(seat);
      }
    }
  };

  /* render helpers -------------------------------------------------- */

  function clearSeat(seat) {
    const c = $(`hand${seat}`);
    if (c) c.innerHTML = '';
  }

  function renderSeat(seat) {
    const container = $(`hand${seat}`);
    if (!container) return;

    const isMe = seat === GameState.mySeat;
    const tiles = isMe ? GameState.myHand
      : new Array(GameState.handSizes[seat] || 0).fill(null);

    // highlight turn
    container.parentElement.classList.toggle('current-player', seat === GameState.currentTurn);

    tiles.forEach((domino) => {
      const node = domino ? createDominoTile(domino) : createDominoBack();
      container.appendChild(node);
    });
  }

  /* DOM-creation ---------------------------------------------------- */

  function createDominoTile([a, b]) {
    const el = document.createElement('div');
    el.className = 'domino';
    el.dataset.tile = `${a}-${b}`;

    el.appendChild(createHalf(a));
    el.appendChild(createHalf(b));

    // ---- interactivity only for my hand + my turn ----
    if (GameState.mySeat !== GameState.currentTurn) return el;
    if (!window.DominoUtils.isTilePlayable([a, b], GameState.board)) return el;

    el.classList.add('playable');
    el.title = 'Click or drag to play';

    el.addEventListener('click', () => handleClick([a, b]));
    el.addEventListener('mousedown', (e) => DragDropManager.startDrag(e, [a, b], el));
    el.addEventListener('touchstart', (e) => DragDropManager.startDrag(e, [a, b], el), { passive: false });

    return el;
  }

  function createDominoBack() {
    const d = document.createElement('div');
    d.className = 'domino domino--back';
    return d;
  }

  /* half & pips ----------------------------------------------------- */

  function createHalf(value) {
    const half = document.createElement('div');
    half.className = 'domino-half';

    const patterns = {
      0: [],
      1: [[.5, .5]],
      2: [[.3, .3], [.7, .7]],
      3: [[.3, .3], [.5, .5], [.7, .7]],
      4: [[.3, .3], [.3, .7], [.7, .3], [.7, .7]],
      5: [[.3, .3], [.3, .7], [.5, .5], [.7, .3], [.7, .7]],
      6: [[.25, .2], [.25, .5], [.25, .8], [.75, .2], [.75, .5], [.75, .8]],
    };

    patterns[value].forEach(([x, y]) => {
      const pip = document.createElement('div');
      pip.className = 'domino-pip';
      pip.style.left = `${x * 100}%`;
      pip.style.top = `${y * 100}%`;
      half.appendChild(pip);
    });

    return half;
  }

  /* click-to-play --------------------------------------------------- */

  function handleClick(tile) {
    if (!GameState.isMyTurn()) return;
    if (!window.DominoUtils.isTilePlayable(tile, GameState.board)) return;

    const sides = window.DominoUtils.playableSides(tile, GameState.board);

    if (sides.length === 1) {
      emitPlay(tile, sides[0]);
    } else {
      // let BoardRenderer visually ask
      BoardRenderer.promptSideChoice(tile, sides, emitPlay);
    }
  }

  function emitPlay(tile, side) {
    socket.emit('playTile', {
      roomId: GameState.roomId,
      seat: GameState.mySeat,
      tile,
      side
    });
  }
})();
