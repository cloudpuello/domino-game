/* =====================================================================
 * src/ui/boardRenderer.js — Renders the Game Board
 * 
 * AI NOTES:
 * - Handles snake formation layout
 * - Creates domino elements on board
 * - Only reads from GameState, never modifies it
 * =================================================================== */

const BoardRenderer = {
  /**
   * Render the game board
   */
  render() {
    const board = document.getElementById('board');
    if (!board) return;
    
    board.innerHTML = '';
    
    if (GameState.boardState.length === 0) {
      this.renderPlaceholder();
      return;
    }
    
    // Get board dimensions
    const rect = board.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Calculate positions
    const positions = this.calculateSnakePositions(
      GameState.boardState, 
      centerX, 
      centerY
    );
    
    // Create domino elements
    GameState.boardState.forEach((domino, index) => {
      const position = positions[index];
      if (position) {
        const element = this.createBoardDomino(domino, position);
        board.appendChild(element);
      }
    });
  },
  
  /**
   * Calculate snake formation positions
   */
  calculateSnakePositions(board, centerX, centerY) {
    const positions = [];
    if (board.length === 0) return positions;
    
    const DOMINO_WIDTH = 40;
    const DOMINO_HEIGHT = 80;
    const GAP = 2;
    const MAX_WIDTH = 300;
    const ROW_HEIGHT = DOMINO_HEIGHT + 20;
    
    let currentRow = 0;
    let x = centerX - MAX_WIDTH;
    let y = centerY;
    let dominoesInRow = 0;
    const maxPerRow = Math.floor((MAX_WIDTH * 2) / (DOMINO_WIDTH + GAP));
    
    for (let i = 0; i < board.length; i++) {
      const domino = board[i];
      const isDouble = domino[0] === domino[1];
      
      // Check if need new row
      if (dominoesInRow >= maxPerRow && i > 0) {
        currentRow++;
        x = centerX - MAX_WIDTH;
        y = centerY + (currentRow * ROW_HEIGHT);
        dominoesInRow = 0;
      }
      
      // Calculate rotation
      let rotation = isDouble ? 90 : 0;
      
      positions.push({
        x: x,
        y: y - DOMINO_HEIGHT / 2,
        rotation: rotation
      });
      
      x += DOMINO_WIDTH + GAP;
      dominoesInRow++;
    }
    
    // Center the formation
    const bounds = this.getBounds(positions);
    const offsetX = (bounds.minX + bounds.maxX) / 2 - centerX;
    
    positions.forEach(pos => {
      pos.x -= offsetX;
    });
    
    return positions;
  },
  
  /**
   * Get bounds of positions
   */
  getBounds(positions) {
    if (positions.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    
    const xs = positions.map(p => p.x);
    const ys = positions.map(p => p.y);
    
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs) + 40, // Add domino width
      minY: Math.min(...ys),
      maxY: Math.max(...ys) + 80  // Add domino height
    };
  },
  
  /**
   * Create board domino element
   */
  createBoardDomino(domino, position) {
    const element = document.createElement('div');
    element.className = 'board-domino';
    element.style.left = `${position.x}px`;
    element.style.top = `${position.y}px`;
    element.style.transform = `rotate(${position.rotation}deg)`;
    
    // Top section
    const topSection = document.createElement('div');
    topSection.className = 'domino-section top';
    topSection.textContent = domino[0];
    
    // Bottom section
    const bottomSection = document.createElement('div');
    bottomSection.className = 'domino-section bottom';
    bottomSection.textContent = domino[1];
    
    element.appendChild(topSection);
    element.appendChild(bottomSection);
    
    return element;
  },
  
  /**
   * Render placeholder for empty board
   */
  renderPlaceholder() {
    const board = document.getElementById('board');
    const placeholder = document.createElement('div');
    placeholder.className = 'tile-placeholder';
    placeholder.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 48px; margin-bottom: 10px;">🁣</div>
        <div style="font-size: 24px; font-weight: bold;">6 | 6</div>
        <div style="font-size: 14px; opacity: 0.7; margin-top: 10px;">
          Waiting for first move...
        </div>
      </div>
    `;
    placeholder.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      padding: 30px;
      border: 3px dashed rgba(255,255,255,0.3);
      border-radius: 15px;
      background: rgba(255,255,255,0.05);
    `;
    board.appendChild(placeholder);
  }
};