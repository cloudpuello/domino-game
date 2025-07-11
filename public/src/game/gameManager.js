/* =====================================================================
 * src/game/gameManager.js — Handles Game Events
 * 
 * AI NOTES:
 * - Manages game start, moves, turns
 * - Updates GameState
 * - Calls UIManager for display updates
 * =================================================================== */

const GameManager = {
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
   * Handle round start
   */
  handleRoundStart(data) {
    console.log('GameManager: Round starting', data);
    
    // Hide lobby
    UIManager.showLobby(false);
    
    // Reset game state
    GameState.reset();
    GameState.isGameActive = true;
    GameState.updateMyHand(data.yourHand);
    GameState.setCurrentTurn(data.startingSeat);
    GameState.updateScores(data.scores);
    
    // Set initial hand sizes
    for (let i = 0; i < 4; i++) {
      GameState.handSizes[i] = 7; // Everyone starts with 7 tiles
    }
    
    // Clear messages
    document.getElementById('messages').innerHTML = '';
    
    // Update display
    BoardRenderer.render();
    HandRenderer.renderAllHands();
    UIManager.updateScores(data.scores);
    
    // Set status
    if (GameState.isMyTurn()) {
      UIManager.setStatus('Your turn! Play the double-six (6|6)');
    } else {
      UIManager.setStatus(Waiting for Seat ${data.startingSeat} to play...);
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
   * Handle move broadcast
   */
  handleBroadcastMove(data) {
    console.log('GameManager: Move broadcast', data);
    
    // Update board
    GameState.updateBoard(data.board);
    
    // Update hand size
    if (data.seat >= 0 && data.seat !== GameState.mySeat) {
      GameState.handSizes[data.seat] = Math.max(0, (GameState.handSizes[data.seat] || 0) - 1);
    }
    
    // Update display
    BoardRenderer.render();
    HandRenderer.renderAllHands();
    
    // Add message
    if (data.seat >= 0 && data.tile) {
      UIManager.addMessage(Seat ${data.seat} played ${data.tile[0]}|${data.tile[1]});
    }
  },
  
  /**
   * Handle turn change
   */
  handleTurnChanged(turn) {
    console.log('GameManager: Turn changed to', turn);
    
    GameState.setCurrentTurn(turn);
    
    // Update status
    if (GameState.isMyTurn()) {
      UIManager.setStatus('Your turn!');
      
      // Check for valid moves
      const hasValidMoves = GameState.myHand.some(tile => 
        GameState.isTilePlayable(tile)
      );
      
      if (!hasValidMoves) {
        UIManager.setStatus('Your turn - No valid moves! You must pass.');
        setTimeout(() => {
          if (confirm('You have no valid moves. Pass your turn?')) {
            window.socket.emit('passPlay', {
              roomId: GameState.roomId,
              seat: GameState.mySeat
            });
          }
        }, 500);
      }
    } else {
      UIManager.setStatus(Waiting for Seat ${turn}...);
    }
    
    // Update hand display
    HandRenderer.renderAllHands();
  },
  
  /**
   * Handle player passed
   */
  handlePlayerPassed(data) {
    UIManager.addMessage(Seat ${data.seat} passed);
  },
  
  /**
   * Handle round end
   */
  handleRoundEnded(data) {
    console.log('GameManager: Round ended', data);
    
    GameState.updateBoard(data.board);
    GameState.updateScores(data.scores);
    
    // Update display
    BoardRenderer.render();
    UIManager.updateScores(data.scores);
    
    // Show result
    const message = Seat ${data.winner} wins the round! (${data.reason}) +${data.points} points;
    UIManager.setStatus(message);
    UIManager.addMessage(message);
    UIManager.addMessage(Scores - Team 0: ${data.scores[0]}, Team 1: ${data.scores[1]});
  },
  
  /**
   * Handle game over
   */
  handleGameOver(data) {
    console.log('GameManager: Game over', data);
    
    // Clear session
    sessionStorage.removeItem('domino_roomId');
    sessionStorage.removeItem('domino_mySeat');
    
    // Show result
    const message = Game Over! Team ${data.winningTeam} wins!;
    UIManager.setStatus(message);
    UIManager.addMessage(message);
    UIManager.addMessage(Final Scores - Team 0: ${data.scores[0]}, Team 1: ${data.scores[1]});
    
    // Alert and offer new game
    setTimeout(() => {
      alert(${message}\n\nFinal Scores:\nTeam 0: ${data.scores[0]}\nTeam 1: ${data.scores[1]});
      
      if (confirm('Start a new game?')) {
        location.reload();
      }
    }, 1000);
  },
  
  /**
   * Handle error message
   */
  handleError(errorMessage) {
    UIManager.showError(errorMessage);
  }
};