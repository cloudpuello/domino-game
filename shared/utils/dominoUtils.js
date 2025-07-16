/* =====================================================================
 * shared/utils/dominoUtils.js
 *
 * AI NOTES - WHY THIS FILE
 * ---------------------------------------------------------------------
 * • All pure / stateless helpers that both client and server need:
 * – basic tile comparisons / flips
 * – board-end calculations
 * – legal-move detection (no socket, no DOM)
 * • Keeps GameState & GameManager skinny – they just call these helpers.
 * =================================================================== */

(function (root, factory) {
  /* eslint-disable no-undef */
  const lib = factory(
    (typeof module === 'object' && module.exports)
      ? require('../constants/gameConstants')          // Node path
      : root.GameConstants                             // Browser global
  );

  if (typeof module === 'object' && module.exports) {
    module.exports = lib;           // CommonJS export
  } else {
    root.DominoUtils = lib;         // Browser global
  }
})(typeof self !== 'undefined' ? self : this, (GC) => {
  /* GC = GameConstants (imported above) */

  /* ----------------------------------------------------------------- */
  /* BASIC TILE HELPERS                                                */
  /* ----------------------------------------------------------------- */
  /** Return `true` if two tiles have identical values (order agnostic). */
  const sameTile = (t1, t2) =>
    (t1[0] === t2[0] && t1[1] === t2[1]) ||
    (t1[0] === t2[1] && t1[1] === t2[0]);

  /** Return a *new* array with the values swapped: [a,b] → [b,a]. */
  const flipped = ([a, b]) => [b, a];

  /** Quick check for doubles. */
  const isDouble = ([a, b]) => a === b;

  /** Sum of pips on a tile (handy for scoring). */
  const pipSum = ([a, b]) => a + b;

  /** Returns a canonical version of a tile, e.g. [5,2] -> [2,5] */
  const normalizeTile = ([a, b]) => (a <= b ? [a, b] : [b, a]);


  /* ----------------------------------------------------------------- */
  /* BOARD-RELATED HELPERS                                             */
  /* ----------------------------------------------------------------- */
  /**
   * Given the current linear board array of tiles, return the exposed
   * numbers at both ends, e.g. `{ left: 3, right: 5 }`.
   * If the board is empty → `null`.
   */
  const boardEnds = (board) => {
    if (!board || board.length === 0) return null;
    const leftMost  = board[0];
    const rightMost = board[board.length - 1];
    return {
      left:  leftMost[0],
      right: rightMost[1]
    };
  };

  /**
   * Determine if `tile` can legally be played given the current board.
   * - Empty board → only the highest double allowed.
   * - Otherwise one of the tile’s numbers must match an exposed end.
   */
  const isTilePlayable = (tile, board) => {
    if (!board || board.length === 0) {
      // First move must be the highest double in the set.
      return tile[0] === GC.MAX_PIP_VALUE && tile[1] === GC.MAX_PIP_VALUE;
    }
    const ends = boardEnds(board);
    return tile.includes(ends.left) || tile.includes(ends.right);
  };

  /**
   * Get the side(s) (`'left'`, `'right'`) on which this tile can be placed.
   * Returns empty array if not playable.
   */
  const playableSides = (tile, board) => {
    if (!isTilePlayable(tile, board)) return [];

    if (!board || board.length === 0) return ['center']; // first move

    const ends = boardEnds(board);
    const sides = [];
    if (tile.includes(ends.left))  sides.push('left');
    if (tile.includes(ends.right)) sides.push('right');
    return sides;
  };

  /* ----------------------------------------------------------------- */
  /* PUBLIC API                                                        */
  /* ----------------------------------------------------------------- */
  return Object.freeze({
    sameTile,
    flipped,
    isDouble,
    pipSum,
    normalizeTile, // Exposed as per suggestion
    boardEnds,
    isTilePlayable,
    playableSides
  });
});
