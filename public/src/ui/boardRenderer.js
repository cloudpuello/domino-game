/* =====================================================================
 * src/ui/boardRenderer.js — SIMPLE Board Renderer (Just Works)
 * 
 * ONLY FIXES: Clear drop zones so players know where to play
 * NO FANCY ANIMATIONS - Just working game
 * =================================================================== */

const BoardRenderer = {
  dropZones: [],
  
  /**
   * Render the game board
   */
  render() {
    const board = document.getElementById('board');
    if (!board) return;
    
    board.innerHTML = '';
    this.dropZones = [];
    
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
    
    // Add simple drop zones if it's player's turn
    if (GameState.isMyTurn()) {
      this.addSimpleDropZones(positions);
    }
  },
  
  /**
   * Simple snake formation
   */
  calculateSnakePositions(board, centerX, centerY) {
    const positions = [];
    if (board.length === 0) return positions;
    
    const DOMINO_WIDTH = 40;
    const DOMINO_HEIGHT = 80;
    const GAP = 5;
    
    let x = centerX;
    let y = centerY;
    let direction = 'right';
    let tilesInSegment = 0;
    
    for (let i = 0; i < board.length; i++) {
      // Position current tile
      positions.push({
        x: x - DOMINO_WIDTH / 2,
        y: y - DOMINO_HEIGHT / 2,
        rotation: 0,
        direction: direction
      });
      
      // Move to next position
      tilesInSegment++;
      
      // Simple layout - just go right then down
      if (tilesInSegment >= 8 && direction === 'right') {
        direction = 'down';
        y += DOMINO_HEIGHT + GAP;
        x = centerX - (4 * (DOMINO_WIDTH + GAP));
        tilesInSegment = 0;
      } else if (direction === 'right') {
        x += DOMINO_WIDTH + GAP;
      } else {
        x += DOMINO_WIDTH + GAP;
      }
    }
    
    return positions;
  },
  
  /**
   * Create board domino element
   */
  createBoardDomino(domino, position) {
    const element = document.createElement('div');
    element.className = 'board-domino';
    element.style.cssText = `
      position: absolute;
      left: ${position.x}px;
      top: ${position.y}px;
      width: 40px;
      height: 80px;
      background: white;
      border: 2px solid #333;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    `;
    
    // Top section
    const topSection = document.createElement('div');
    topSection.style.cssText = `
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid #333;
      font-size: 16px;
      font-weight: bold;
    `;
    topSection.textContent = domino[0];
    
    // Bottom section
    const bottomSection = document.createElement('div');
    bottomSection.style.cssText = `
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: bold;
    `;
    bottomSection.textContent = domino[1];
    
    element.appendChild(topSection);
    element.appendChild(bottomSection);
    
    return element;
  },
  
  /**
   * Simple placeholder
   */
  renderPlaceholder() {
    const board = document.getElementById('board');
    const placeholder = document.createElement('div');
    placeholder.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: white;
      font-size: 24px;
      padding: 20px;
      border: 2px dashed rgba(255,255,255,0.5);
      border-radius: 10px;
    `;
    placeholder.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 10px;">6 | 6</div>
      <div>Waiting for first move...</div>
    `;
    board.appendChild(placeholder);
  },
  
  /**
   * SIMPLE: Add clear drop zones
   */
  addSimpleDropZones(positions) {
    if (positions.length === 0) return;
    
    const board = document.getElementById('board');
    const ends = GameState.getBoardEnds();
    
    // Left drop zone
    const leftPos = positions[0];
    const leftZone = document.createElement('div');
    leftZone.className = 'drop-zone';
    leftZone.dataset.side = 'left';
    leftZone.style.cssText = `
      position: absolute;
      left: ${leftPos.x - 60}px;
      top: ${leftPos.y}px;
      width: 50px;
      height: 80px;
      border: 3px dashed #ffd700;
      border-radius: 8px;
      background: rgba(255, 215, 0, 0.2);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #333;
      font-size: 12px;
      font-weight: bold;
      z-index: 50;
    `;
    leftZone.innerHTML = `<div>LEFT</div><div>${ends ? ends.left : ''}</div>`;
    
    // Right drop zone
    const rightPos = positions[positions.length - 1];
    const rightZone = document.createElement('div');
    rightZone.className = 'drop-zone';
    rightZone.dataset.side = 'right';
    rightZone.style.cssText = `
      position: absolute;
      left: ${rightPos.x + 50}px;
      top: ${rightPos.y}px;
      width: 50px;
      height: 80px;
      border: 3px dashed #ffd700;
      border-radius: 8px;
      background: rgba(255, 215, 0, 0.2);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #333;
      font-size: 12px;
      font-weight: bold;
      z-index: 50;
    `;
    rightZone.innerHTML = `<div>RIGHT</div><div>${ends ? ends.right : ''}</div>`;
    
    board.appendChild(leftZone);
    board.appendChild(rightZone);
    
    this.dropZones = [leftZone, rightZone];
  },
  
  /**
   * Show drop zones when dragging
   */
  showDropZones() {
    this.dropZones.forEach(zone => {
      zone.style.opacity = '1';
    });
  },
  
  /**
   * Hide drop zones
   */
  hideDropZones() {
    this.dropZones.forEach(zone => {
      zone.style.opacity = '0.7';
    });
  }
};
window.BoardRenderer = BoardRenderer;

