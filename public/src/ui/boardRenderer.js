/* =====================================================================
 * src/ui/boardRenderer.js — Renders the Game Board
 * 
 * AI NOTES:
 * - Handles snake formation layout
 * - Creates domino elements on board
 * - Only reads from GameState, never modifies it
 * - FIXED: Bug 2 - Specific drop zones
 * - FIXED: Bug 4 - Proper snake formation
 * - FIXED: Bug 6 - Centered starting tile
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
    
    // Add drop zones if it's player's turn
    if (GameState.isMyTurn()) {
      this.addDropZones();
    }
    
    // Ensure board stays centered on window resize
    this.ensureCentered();
  },
  
  /**
   * FIX FOR BUG 4: Proper snake formation
   */
  calculateSnakePositions(board, centerX, centerY) {
    const positions = [];
    if (board.length === 0) return positions;
    
    const DOMINO_WIDTH = 40;
    const DOMINO_HEIGHT = 80;
    const GAP = 5;
    const SEGMENT_LENGTH = 6; // Tiles before turning
    const TURN_RADIUS = 20; // Smooth turn radius
    
    let x = centerX;
    let y = centerY;
    let direction = 'right'; // Start going right
    let tilesInSegment = 0;
    
    for (let i = 0; i < board.length; i++) {
      const domino = board[i];
      const isDouble = domino[0] === domino[1];
      
      // Position current tile
      positions.push({
        x: x - DOMINO_WIDTH / 2,
        y: y - DOMINO_HEIGHT / 2,
        rotation: this.getRotationForDirection(direction, isDouble),
        direction: direction
      });
      
      // Move to next position
      tilesInSegment++;
      
      // Check if we need to turn
      let nextDirection = direction;
      if (tilesInSegment >= SEGMENT_LENGTH && i < board.length - 1) {
        nextDirection = this.getNextDirection(direction);
        tilesInSegment = 0;
      }
      
      // Calculate next position
      if (nextDirection !== direction) {
        // Turning - add turn radius
        switch (direction + '-' + nextDirection) {
          case 'right-down':
            x += TURN_RADIUS;
            y += TURN_RADIUS;
            break;
          case 'down-left':
            x -= TURN_RADIUS;
            y += TURN_RADIUS;
            break;
          case 'left-up':
            x -= TURN_RADIUS;
            y -= TURN_RADIUS;
            break;
          case 'up-right':
            x += TURN_RADIUS;
            y -= TURN_RADIUS;
            break;
        }
        direction = nextDirection;
      } else {
        // Straight line
        switch (direction) {
          case 'right':
            x += DOMINO_HEIGHT + GAP;
            break;
          case 'down':
            y += DOMINO_HEIGHT + GAP;
            break;
          case 'left':
            x -= DOMINO_HEIGHT + GAP;
            break;
          case 'up':
            y -= DOMINO_HEIGHT + GAP;
            break;
        }
      }
    }
    
    // Center the entire snake formation
    const bounds = this.calculateBounds(positions);
    const offsetX = (bounds.minX + bounds.maxX) / 2 - centerX;
    const offsetY = (bounds.minY + bounds.maxY) / 2 - centerY;
    
    positions.forEach(pos => {
      pos.x -= offsetX;
      pos.y -= offsetY;
    });
    
    return positions;
  },
  
  /**
   * Get next direction in clockwise order
   */
  getNextDirection(current) {
    const directions = ['right', 'down', 'left', 'up'];
    const index = directions.indexOf(current);
    return directions[(index + 1) % 4];
  },
  
  /**
   * Get rotation based on direction and domino type
   */
  getRotationForDirection(direction, isDouble) {
    if (isDouble) {
      // Doubles are perpendicular to direction
      return (direction === 'right' || direction === 'left') ? 90 : 0;
    } else {
      // Regular tiles align with direction
      const rotations = {
        'right': 0,
        'down': 90,
        'left': 180,
        'up': 270
      };
      return rotations[direction];
    }
  },
  
  /**
   * Calculate bounds of all positions
   */
  calculateBounds(positions) {
    if (positions.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    positions.forEach(pos => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x + 40); // Add domino width
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y + 80); // Add domino height
    });
    
    return { minX, maxX, minY, maxY };
  },
  
  /**
   * Create board domino element
   */
  createBoardDomino(domino, position) {
    const element = document.createElement('div');
    element.className = 'board-domino';
    element.style.left = ${position.x}px;
    element.style.top = ${position.y}px;
    element.style.transform = rotate(${position.rotation}deg);
    element.dataset.direction = position.direction;
    
    // Top section with pips
    const topSection = document.createElement('div');
    topSection.className = 'domino-section top';
    topSection.appendChild(this.createPips(domino[0]));
    
    // Bottom section with pips
    const bottomSection = document.createElement('div');
    bottomSection.className = 'domino-section bottom';
    bottomSection.appendChild(this.createPips(domino[1]));
    
    element.appendChild(topSection);
    element.appendChild(bottomSection);
    
    return element;
  },
  
  /**
   * Create pip pattern for domino value
   */
  createPips(value) {
    const container = document.createElement('div');
    container.className = 'pip-container';
    
    // For now, just show the number
    const numberDisplay = document.createElement('div');
    numberDisplay.textContent = value;
    numberDisplay.style.fontSize = '16px';
    numberDisplay.style.fontWeight = 'bold';
    container.appendChild(numberDisplay);
    
    return container;
  },
  
  /**
   * FIX FOR BUG 6: Properly centered placeholder
   */
  renderPlaceholder() {
    const board = document.getElementById('board');
    const placeholder = document.createElement('div');
    placeholder.className = 'starting-tile-placeholder';
    placeholder.innerHTML = 
      <div style="text-align: center;">
        <div style="font-size: 48px; margin-bottom: 10px;">🁣</div>
        <div style="font-size: 24px; font-weight: bold;">6 | 6</div>
        <div style="font-size: 14px; opacity: 0.7; margin-top: 10px;">
          Waiting for first move...
        </div>
      </div>
    ;
    placeholder.style.cssText = 
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      padding: 30px;
      border: 3px dashed rgba(255,255,255,0.3);
      border-radius: 15px;
      background: rgba(255,255,255,0.05);
    ;
    board.appendChild(placeholder);
  },
  
  /**
   * FIX FOR BUG 2: Add specific drop zones
   */
  addDropZones() {
    const board = document.getElementById('board');
    if (!board || GameState.boardState.length === 0) return;
    
    // Get first and last dominoes
    const dominoes = board.querySelectorAll('.board-domino');
    if (dominoes.length === 0) return;
    
    const firstDomino = dominoes[0];
    const lastDomino = dominoes[dominoes.length - 1];
    
    // Create left drop zone
    const leftZone = document.createElement('div');
    leftZone.className = 'drop-zone';
    leftZone.dataset.side = 'left';
    leftZone.style.cssText = 
      position: absolute;
      width: 60px;
      height: 90px;
      border: 2px dashed #ffd700;
      border-radius: 10px;
      background: rgba(255, 215, 0, 0.1);
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: all;
    ;
    
    // Position left zone
    const firstRect = firstDomino.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const firstDir = firstDomino.dataset.direction || 'right';
    
    if (firstDir === 'right') {
      leftZone.style.left = ${firstRect.left - boardRect.left - 70}px;
      leftZone.style.top = ${firstRect.top - boardRect.top - 5}px;
    } else {
      // Adjust for other directions
      leftZone.style.left = ${firstRect.left - boardRect.left - 35}px;
      leftZone.style.top = ${firstRect.top - boardRect.top - 70}px;
    }
    
    // Create right drop zone
    const rightZone = document.createElement('div');
    rightZone.className = 'drop-zone';
    rightZone.dataset.side = 'right';
    rightZone.style.cssText = leftZone.style.cssText;
    
    // Position right zone
    const lastRect = lastDomino.getBoundingClientRect();
    const lastDir = lastDomino.dataset.direction || 'right';
    
    if (lastDir === 'right') {
      rightZone.style.left = ${lastRect.right - boardRect.left + 10}px;
      rightZone.style.top = ${lastRect.top - boardRect.top - 5}px;
    } else {
      // Adjust for other directions
      rightZone.style.left = ${lastRect.left - boardRect.left - 35}px;
      rightZone.style.top = ${lastRect.bottom - boardRect.top + 10}px;
    }
    
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
      zone.style.opacity = '0';
    });
  },
  
  /**
   * Ensure board stays centered on resize
   */
  ensureCentered() {
    // Re-render on window resize
    if (!this.resizeHandler) {
      this.resizeHandler = () => {
        if (GameState.boardState.length > 0) {
          this.render();
        }
      };
      window.addEventListener('resize', this.resizeHandler);
    }
  }
};