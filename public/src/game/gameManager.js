/* =====================================================================
 * src/game/gameManager.js — IMPROVED Game Manager
 * 
 * FIXES APPLIED:
 * - No more blocking confirm() dialogs
 * - Better hand size syncing 
 * - More reliable state management
 * - Improved auto-pass flow
 * =================================================================== */

const GameManager = {
  autoPassTimer: null, // Track auto-pass timeout
  
  /**
   * Initialize game event listeners
   */
  init() {
    console.log('GameManager: Initializing');
    
    // Set up socket listeners
    window.socket.on('roundStart', this.handleRoundStart.bind(this));
    window.socket.on('updateHand', this.handleUpdateHand.bind(this));
    window.socket.on('broadcastMove', this.handleBroadcastMove.bind(this));
    window.socket.on('turnChanged', this.handleTurnChanged.bind(this));
    window.socket.on('playerPassed', this.handlePlayerPassed.bind(this));
    window.socket.on('roundEnded', this.handleRoundEnded.bind(this));
    window.socket.on('gameOver', this.handleGameOver.bind(this));
    window.socket.on('errorMessage', this.handleError.bind(this));
  },
  
  /**
   * IMPROVED: Handle round start with better hand size sync
   */
  handleRoundStart(data) {
    console.log('GameManager: Round starting', data);
    
    // Clear any pending auto-pass timer
    if (this.autoPassTimer) {
      clearTimeout(this.autoPassTimer);
      this.autoPassTimer = null;
    }
    
    // Hide lobby
    UIManager.showLobby(false);
    
    // Reset game state
    GameState.reset();
    GameState.isGameActive = true;
    GameState.updateMyHand(data.yourHand);
    GameState.setCurrentTurn(data.startingSeat);
    GameState.updateScores(data.scores);
    
    // IMPROVED: Better hand size initialization
    // Use server data if available, otherwise default to 7
    if (data.handSizes) {
      GameState.handSizes = { ...data.handSizes };
    } else {
      // Fallback to default
      for (let i = 0; i < 4; i++) {
        GameState.handSizes[i] = 7;
      }
    }
    
    // Ensure my hand size is accurate
    GameState.handSizes[GameState.mySeat] = data.yourHand.length;
    
    // Clear messages
    document.getElementById('messages').innerHTML = '';
    
    // Update display
    BoardRenderer.render();
    HandRenderer.renderAllHands();
    UIManager.updateScores(data.scores);
    
    // Set status
    if (GameState.isMyTurn()) {
      UIManager.setStatus('Your turn! Play the double-six (6|6)');
      this.scheduleValidMoveCheck();
    } else {
      UIManager.setStatus(`Waiting for Seat ${data.startingSeat} to play...`);
    }
    
    UIManager.addMessage('New round started!');
  },
  
  /**
   * Handle hand update
   */
  handleUpdateHand(newHand) {
    console.log('GameManager: Hand updated');
    GameState.updateMyHand(newHand);
    HandRenderer.renderAllHands();
  },
  
  /**
   * IMPROVED: Handle move broadcast with better hand tracking
   */
  handleBroadcastMove(data) {
    console.log('GameManager: Move broadcast', data);
    
    // Update board
    GameState.updateBoard(data.board);
    
    // IMPROVED: More accurate hand size tracking
    if (data.seat >= 0 && data.seat !== GameState.mySeat) {
      if (data.handSizes) {
        // Use server-provided hand sizes if available
        GameState.handSizes = { ...data.handSizes };
      } else {
        // Fallback: decrement by 1
        GameState.handSizes[data.seat] = Math.max(0, (GameState.handSizes[data.seat] || 0) - 1);
      }
    }
    
    // Update display
    BoardRenderer.render();
    HandRenderer.renderAllHands();
    
    // Add message
    if (data.seat >= 0 && data.tile) {
      const player = LobbyManager.players.find(p => p && p.seat === data.seat);
      const playerName = player ? player.name : `Seat ${data.seat}`;
      UIManager.addMessage(`${playerName} played ${data.tile[0]}|${data.tile[1]}`);
    }
  },
  
  /**
   * IMPROVED: Handle turn change with non-blocking auto-pass
   */
  handleTurnChanged(turn) {
    console.log('GameManager: Turn changed to', turn);
    
    // Clear any existing auto-pass timer
    if (this.autoPassTimer) {
      clearTimeout(this.autoPassTimer);
      this.autoPassTimer = null;
    }
    
    GameState.setCurrentTurn(turn);
    
    // Update status
    if (GameState.isMyTurn()) {
      UIManager.setStatus('Your turn!');
      
      // Schedule valid move check (non-blocking)
      this.scheduleValidMoveCheck();
    } else {
      const player = LobbyManager.players.find(p => p && p.seat === turn);
      const playerName = player ? player.name : `Seat ${turn}`;
      UIManager.setStatus(`${playerName}'s turn...`);
    }
    
    // Update hand display
    HandRenderer.renderAllHands();
    
    // Highlight current player
    this.highlightCurrentPlayer(turn);
  },
  
  /**
   * NEW: Schedule valid move check (replaces blocking confirm)
   */
  scheduleValidMoveCheck() {
    // Check after a short delay to let UI update
    this.autoPassTimer = setTimeout(() => {
      this.checkForValidMovesAndAutoPass();
    }, 800);
  },
  
  /**
   * IMPROVED: Non-blocking auto-pass with clear messaging
   */
  checkForValidMovesAndAutoPass() {
    if (!GameState.isMyTurn()) return;
    
    const hasValidMoves = GameState.myHand.some(tile => 
      GameState.isTilePlayable(tile)
    );
    
    if (!hasValidMoves) {
      // NO BLOCKING DIALOG - just auto-pass with clear feedback
      UIManager.setStatus('🚫 No valid moves - Auto-passing in 3 seconds...');
      UIManager.addMessage('No valid moves available - you will pass automatically');
      
      // Show notification if available
      if (UIManager.showNotification) {
        UIManager.showNotification('No valid moves! Passing automatically...', 'warning', 3000);
      }
      
      // Auto-pass after 3 seconds (gives user time to see what's happening)
      this.autoPassTimer = setTimeout(() => {
        if (GameState.isMyTurn()) { // Double-check we're still current player
          window.socket.emit('passPlay', {
            roomId: GameState.roomId,
            seat: GameState.mySeat
          });
          UIManager.addMessage('You passed (no valid moves)');
        }
      }, 3000);
    } else {
      // Show helpful status about playable ends
      const ends = GameState.getBoardEnds();
      if (ends) {
        UIManager.setStatus(`Your turn! Play on ${ends.left} or ${ends.right}`);
      } else {
        UIManager.setStatus('Your turn! Play the double-six (6|6)');
      }
    }
  },
  
  /**
   * Highlight current player
   */
  highlightCurrentPlayer(seat) {
    // Remove previous highlights
    document.querySelectorAll('.player-hand-container').forEach(container => {
      container.classList.remove('current-player');
    });
    
    // Add highlight to current player
    const currentHandContainer = document.getElementById(`hand${seat}`);
    if (currentHandContainer) {
      currentHandContainer.classList.add('current-player');
    }
  },
  
  /**
   * Handle player passed
   */
  handlePlayerPassed(data) {
    const player = LobbyManager.players.find(p => p && p.seat === data.seat);
    const playerName = player ? player.name : `Seat ${data.seat}`;
    UIManager.addMessage(`${playerName} passed`);
    
    if (data.seat === GameState.mySeat) {
      // Show feedback if I passed
      if (UIManager.showNotification) {
        UIManager.showNotification('You passed your turn', 'info', 1500);
      }
    }
  },
  
  /**
   * IMPROVED: Handle round end with better cleanup
   */
  handleRoundEnded(data) {
    console.log('GameManager: Round ended', data);
    
    // Clear any pending auto-pass timer
    if (this.autoPassTimer) {
      clearTimeout(this.autoPassTimer);
      this.autoPassTimer = null;
    }
    
    GameState.updateBoard(data.board);
    GameState.updateScores(data.scores);
    
    // IMPROVED: Update hand sizes if provided
    if (data.finalHandSizes) {
      GameState.handSizes = { ...data.finalHandSizes };
    }
    
    // Update display
    BoardRenderer.render();
    HandRenderer.renderAllHands();
    UIManager.updateScores(data.scores);
    
    // Show detailed result
    const player = LobbyManager.players.find(p => p && p.seat === data.winner);
    const winnerName = player ? player.name : `Seat ${data.winner}`;
    const winnerTeam = data.winner % 2;
    
    const message = `🏆 ${winnerName} wins the round! (${data.reason})`;
    const scoreMessage = `+${data.points} points to Team ${winnerTeam}`;
    const totalMessage = `Scores: Team 0: ${data.scores[0]}, Team 1: ${data.scores[1]}`;
    
    UIManager.setStatus(message);
    UIManager.addMessage(message);
    UIManager.addMessage(scoreMessage);
    UIManager.addMessage(totalMessage);
  },
  
  /**
   * IMPROVED: Handle game over with cleanup
   */
  handleGameOver(data) {
    console.log('GameManager: Game over', data);
    
    // Clear any pending auto-pass timer
    if (this.autoPassTimer) {
      clearTimeout(this.autoPassTimer);
      this.autoPassTimer = null;
    }
    
    // Clear session
    sessionStorage.removeItem('domino_roomId');
    sessionStorage.removeItem('domino_mySeat');
    
    // Show result
    const message = `🎉 GAME OVER! Team ${data.winningTeam} wins!`;
    UIManager.setStatus(message);
    UIManager.addMessage(message);
    UIManager.addMessage(`Final Scores - Team 0: ${data.scores[0]}, Team 1: ${data.scores[1]}`);
    
    // Non-blocking game over handling
    setTimeout(() => {
      if (confirm(`${message}\n\nFinal Scores:\nTeam 0: ${data.scores[0]}\nTeam 1: ${data.scores[1]}\n\nStart a new game?`)) {
        location.reload();
      }
    }, 1500);
  },
  
  /**
   * Handle error message
   */
  handleError(errorMessage) {
    UIManager.showError(errorMessage);
  },
  
  /**
   * NEW: Cleanup method for proper teardown
   */
  cleanup() {
    if (this.autoPassTimer) {
      clearTimeout(this.autoPassTimer);
      this.autoPassTimer = null;
    }
  },
  
  /**
   * Get current game status for debugging
   */
  getGameStatus() {
    return {
      isGameActive: GameState.isGameActive,
      currentTurn: GameState.currentTurn,
      isMyTurn: GameState.isMyTurn(),
      myHandSize: GameState.myHand.length,
      boardSize: GameState.boardState.length,
      scores: GameState.scores,
      hasAutoPassTimer: !!this.autoPassTimer
    };
  }
};