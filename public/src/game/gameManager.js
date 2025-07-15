/* =====================================================================
 * src/game/gameManager.js — PERFECT Game Manager
 * 
 * FEATURES:
 * - Clean socket event handling
 * - Non-blocking auto-pass
 * - Proper timer cleanup
 * - Reliable state management
 * - Complete error handling
 * =================================================================== */

const GameManager = {
  autoPassTimer: null,
  
  /**
   * Initialize game event listeners
   */
  init() {
    console.log('GameManager: Initializing');
    
    // Validate dependencies
    if (!window.socket) {
      console.error('GameManager: Socket not available');
      return;
    }
    
    // Set up all socket listeners
    this.setupSocketListeners();
  },
  
  /**
   * Set up socket event listeners
   */
  setupSocketListeners() {
    const events = [
      'roundStart', 'updateHand', 'broadcastMove', 'turnChanged',
      'playerPassed', 'roundEnded', 'gameOver', 'errorMessage'
    ];
    
    events.forEach(event => {
      const handler = this[`handle${event.charAt(0).toUpperCase() + event.slice(1)}`];
      if (handler) {
        window.socket.on(event, handler.bind(this));
      }
    });
  },
  
  /**
   * Handle round start
   */
  handleRoundStart(data) {
    console.log('GameManager: Round starting', data);
    
    // Clear any pending timers
    this.clearAutoPassTimer();
    
    // Hide lobby
    if (UIManager.showLobby) {
      UIManager.showLobby(false);
    }
    
    // Reset and update game state
    GameState.reset();
    GameState.isGameActive = true;
    GameState.updateMyHand(data.yourHand);
    GameState.setCurrentTurn(data.startingSeat);
    GameState.updateScores(data.scores);
    
    // Set hand sizes (server data or fallback)
    this.updateHandSizes(data.handSizes, data.yourHand.length);
    
    // Clear messages
    this.clearMessages();
    
    // Update all displays
    this.updateAllDisplays();
    
    // Set initial status
    this.setInitialStatus(data.startingSeat);
    
    UIManager.addMessage('New round started!');
  },
  
  /**
   * Handle hand update
   */
  handleUpdateHand(newHand) {
    console.log('GameManager: Hand updated');
    GameState.updateMyHand(newHand);
    
    if (HandRenderer.renderAllHands) {
      HandRenderer.renderAllHands();
    }
  },
  
  /**
   * Handle move broadcast
   */
  handleBroadcastMove(data) {
    console.log('GameManager: Move broadcast', data);
    
    // Update game state
    GameState.updateBoard(data.board);
    
    // Update hand sizes
    if (data.seat >= 0 && data.seat !== GameState.mySeat) {
      if (data.handSizes) {
        GameState.handSizes = { ...data.handSizes };
      } else {
        // Fallback: decrement hand size
        GameState.handSizes[data.seat] = Math.max(0, (GameState.handSizes[data.seat] || 0) - 1);
      }
    }
    
    // Update displays
    this.updateAllDisplays();
    
    // Add move message
    this.addMoveMessage(data);
  },
  
  /**
   * Handle turn change
   */
  handleTurnChanged(turn) {
    console.log('GameManager: Turn changed to', turn);
    
    // Clear any existing timer
    this.clearAutoPassTimer();
    
    // Update turn
    GameState.setCurrentTurn(turn);
    
    // Update UI based on whose turn it is
    if (GameState.isMyTurn()) {
      this.handleMyTurn();
    } else {
      this.handleOtherPlayerTurn(turn);
    }
    
    // Update displays
    this.updateHandDisplays();
    this.highlightCurrentPlayer(turn);
  },
  
  /**
   * Handle my turn
   */
  handleMyTurn() {
    UIManager.setStatus('Your turn!');
    
    // Schedule move validation check
    this.autoPassTimer = setTimeout(() => {
      this.checkForValidMovesAndAutoPass();
    }, 800);
  },
  
  /**
   * Handle other player's turn
   */
  handleOtherPlayerTurn(turn) {
    const playerName = this.getPlayerName(turn);
    UIManager.setStatus(`${playerName}'s turn...`);
  },
  
  /**
   * Check for valid moves and auto-pass if none
   */
  checkForValidMovesAndAutoPass() {
    if (!GameState.isMyTurn()) return;
    
    const hasValidMoves = GameState.myHand.some(tile => 
      GameState.isTilePlayable(tile)
    );
    
    if (!hasValidMoves) {
      this.initiateAutoPass();
    } else {
      this.showPlayableOptions();
    }
  },
  
  /**
   * Initiate auto-pass sequence
   */
  initiateAutoPass() {
    UIManager.setStatus('🚫 No valid moves - Auto-passing in 3 seconds...');
    UIManager.addMessage('No valid moves available - you will pass automatically');
    
    // Show notification if available
    if (UIManager.showNotification) {
      UIManager.showNotification('No valid moves! Passing automatically...', 'warning', 3000);
    }
    
    // Auto-pass after 3 seconds
    this.autoPassTimer = setTimeout(() => {
      if (GameState.isMyTurn()) {
        this.executePass();
      }
    }, 3000);
  },
  
  /**
   * Show playable options to user
   */
  showPlayableOptions() {
    const ends = GameState.getBoardEnds();
    if (ends) {
      UIManager.setStatus(`Your turn! Play on ${ends.left} or ${ends.right}`);
    } else {
      UIManager.setStatus('Your turn! Play the double-six (6|6)');
    }
  },
  
  /**
   * Execute pass move
   */
  executePass() {
    window.socket.emit('passPlay', {
      roomId: GameState.roomId,
      seat: GameState.mySeat
    });
    UIManager.addMessage('You passed (no valid moves)');
  },
  
  /**
   * Handle player passed
   */
  handlePlayerPassed(data) {
    const playerName = this.getPlayerName(data.seat);
    UIManager.addMessage(`${playerName} passed`);
    
    if (data.seat === GameState.mySeat && UIManager.showNotification) {
      UIManager.showNotification('You passed your turn', 'info', 1500);
    }
  },
  
  /**
   * Handle round end
   */
  handleRoundEnded(data) {
    console.log('GameManager: Round ended', data);
    
    // Clear timers
    this.clearAutoPassTimer();
    
    // Update state
    GameState.updateBoard(data.board);
    GameState.updateScores(data.scores);
    
    if (data.finalHandSizes) {
      GameState.handSizes = { ...data.finalHandSizes };
    }
    
    // Update displays
    this.updateAllDisplays();
    
    // Show round results
    this.showRoundResults(data);
  },
  
  /**
   * Handle game over
   */
  handleGameOver(data) {
    console.log('GameManager: Game over', data);
    
    // Clear timers and session
    this.clearAutoPassTimer();
    this.clearSession();
    
    // Show final results
    this.showGameOverResults(data);
  },
  
  /**
   * Handle error message
   */
  handleErrorMessage(errorMessage) {
    console.error('GameManager: Error received:', errorMessage);
    if (UIManager.showError) {
      UIManager.showError(errorMessage);
    }
  },
  
  /**
   * Utility: Clear auto-pass timer
   */
  clearAutoPassTimer() {
    if (this.autoPassTimer) {
      clearTimeout(this.autoPassTimer);
      this.autoPassTimer = null;
    }
  },
  
  /**
   * Utility: Update hand sizes
   */
  updateHandSizes(serverHandSizes, myHandSize) {
    if (serverHandSizes) {
      GameState.handSizes = { ...serverHandSizes };
    } else {
      // Default to 7 for all players
      for (let i = 0; i < 4; i++) {
        GameState.handSizes[i] = 7;
      }
    }
    
    // Ensure my hand size is accurate
    if (GameState.mySeat !== null) {
      GameState.handSizes[GameState.mySeat] = myHandSize;
    }
  },
  
  /**
   * Utility: Clear messages
   */
  clearMessages() {
    const messagesElement = document.getElementById('messages');
    if (messagesElement) {
      messagesElement.innerHTML = '';
    }
  },
  
  /**
   * Utility: Update all displays
   */
  updateAllDisplays() {
    if (BoardRenderer.render) {
      BoardRenderer.render();
    }
    
    if (HandRenderer.renderAllHands) {
      HandRenderer.renderAllHands();
    }
    
    if (UIManager.updateScores) {
      UIManager.updateScores(GameState.scores);
    }
  },
  
  /**
   * Utility: Update hand displays only
   */
  updateHandDisplays() {
    if (HandRenderer.renderAllHands) {
      HandRenderer.renderAllHands();
    }
  },
  
  /**
   * Utility: Set initial status
   */
  setInitialStatus(startingSeat) {
    if (GameState.isMyTurn()) {
      UIManager.setStatus('Your turn! Play the double-six (6|6)');
      this.autoPassTimer = setTimeout(() => {
        this.checkForValidMovesAndAutoPass();
      }, 800);
    } else {
      UIManager.setStatus(`Waiting for Seat ${startingSeat} to play...`);
    }
  },
  
  /**
   * Utility: Add move message
   */
  addMoveMessage(data) {
    if (data.seat >= 0 && data.tile) {
      const playerName = this.getPlayerName(data.seat);
      UIManager.addMessage(`${playerName} played ${data.tile[0]}|${data.tile[1]}`);
    }
  },
  
  /**
   * Utility: Get player name
   */
  getPlayerName(seat) {
    if (LobbyManager && LobbyManager.players) {
      const player = LobbyManager.players.find(p => p && p.seat === seat);
      return player ? player.name : `Seat ${seat}`;
    }
    return `Seat ${seat}`;
  },
  
  /**
   * Utility: Highlight current player
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
   * Utility: Show round results
   */
  showRoundResults(data) {
    const winnerName = this.getPlayerName(data.winner);
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
   * Utility: Show game over results
   */
  showGameOverResults(data) {
    const message = `🎉 GAME OVER! Team ${data.winningTeam} wins!`;
    UIManager.setStatus(message);
    UIManager.addMessage(message);
    UIManager.addMessage(`Final Scores - Team 0: ${data.scores[0]}, Team 1: ${data.scores[1]}`);
    
    // Non-blocking game over dialog
    setTimeout(() => {
      const newGame = confirm(
        `${message}\n\nFinal Scores:\nTeam 0: ${data.scores[0]}\nTeam 1: ${data.scores[1]}\n\nStart a new game?`
      );
      if (newGame) {
        location.reload();
      }
    }, 1500);
  },
  
  /**
   * Utility: Clear session data
   */
  clearSession() {
    sessionStorage.removeItem('domino_roomId');
    sessionStorage.removeItem('domino_mySeat');
  },
  
  /**
   * Cleanup method for proper teardown
   */
  cleanup() {
    this.clearAutoPassTimer();
  },
  
  /**
   * Get current game status for debugging
   */
  getGameStatus() {
    return {
      isGameActive: GameState.isGameActive,
      currentTurn: GameState.currentTurn,
      isMyTurn: GameState.isMyTurn(),
      myHandSize: GameState.myHand ? GameState.myHand.length : 0,
      boardSize: GameState.boardState ? GameState.boardState.length : 0,
      scores: GameState.scores,
      hasAutoPassTimer: !!this.autoPassTimer
    };
  }
};

// CRITICAL: Make GameManager globally available
window.GameManager = GameManager;