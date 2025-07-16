/* =====================================================================
 * src/game/gameManager.js — Dominican Domino Game Manager
 *
 * IMPLEMENTS DOMINICAN RULES ON CLIENT:
 * - Counter-clockwise turn order display
 * - Proper hand rendering after round start
 * - Dominican-specific messaging
 * - Fixed auto-pass logic for Dominican rules
 * =================================================================== */

const GameManager = {
  autoPassTimer: null,
  gameRules: 'dominican', // Set to Dominican rules

  init() {
    console.log('GameManager: Initializing Dominican Domino client');

    if (!window.socket) {
      console.error('GameManager: Socket not available');
      return;
    }
    this.setupSocketListeners();
  },

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
   * Enhanced round start for Dominican rules with validation
   */
  handleRoundStart(data) {
    console.log('GameManager: Dominican round starting', data);
    
    // Clear any existing timers
    this.clearAutoPassTimer();

    // Hide lobby and show game
    if (UIManager.showLobby) {
      UIManager.showLobby(false);
    }

    // Reset and update game state
    GameState.reset();
    GameState.isGameActive = true;
    GameState.gameRules = 'dominican';
    GameState.isFirstRound = data.isFirstRound || false;
    
    // CRITICAL: Update hand before rendering
    if (data.yourHand && data.yourHand.length > 0) {
      GameState.updateMyHand(data.yourHand);
      console.log(`GameManager: Received hand with ${data.yourHand.length} tiles:`, data.yourHand);
    } else {
      console.error('GameManager: No hand received in roundStart!');
    }
    
    // Update game state
    GameState.setCurrentTurn(data.startingSeat);
    GameState.updateScores(data.scores);
    
    // Update hand sizes
    if (data.handSizes) {
      GameState.syncHandSizes(data.handSizes);
    }
    
    // Clear messages and update displays
    this.clearMessages();
    this.updateAllDisplays();
    
    // CRITICAL: Validate first round logic
    if (data.isFirstRound) {
      this.validateFirstRoundLogic(data.startingSeat);
    }
    
    // Set initial status - NO AUTO-PASS CHECK YET
    this.setInitialDominicanStatus(data.startingSeat, data.isFirstRound);
    
    // Add Dominican-specific message
    const gameMessage = data.isFirstRound ? 
      'New Dominican game started! First round: Must play [6|6]' : 
      'New round started! Winner opens with any tile';
    UIManager.addMessage(gameMessage);
    
    console.log('GameManager: Dominican round initialized successfully');
  },

  /**
   * Validate first round logic - check if the right player was chosen
   */
  validateFirstRoundLogic(startingSeat) {
    console.log('=== FIRST ROUND VALIDATION ===');
    
    const myHand = GameState.myHand;
    const hasDoubleSix = myHand.some(tile => tile[0] === 6 && tile[1] === 6);
    const mySeat = GameState.mySeat;
    
    console.log(`My seat: ${mySeat}`);
    console.log(`Starting seat: ${startingSeat}`);
    console.log(`I have [6|6]: ${hasDoubleSix}`);
    console.log(`My hand:`, myHand);
    
    if (hasDoubleSix && startingSeat !== mySeat) {
      console.error('❌ VALIDATION ERROR: I have [6|6] but server chose someone else to start!');
      UIManager.addMessage('❌ ERROR: I have [6|6] but it\'s not my turn!');
      UIManager.showError('Server error: Wrong player chosen to start');
    } else if (!hasDoubleSix && startingSeat === mySeat) {
      console.error('❌ VALIDATION ERROR: Server chose me to start but I don\'t have [6|6]!');
      UIManager.addMessage('❌ ERROR: It\'s my turn but I don\'t have [6|6]!');
      UIManager.showError('Server error: You don\'t have [6|6] but were chosen to start');
    } else if (hasDoubleSix && startingSeat === mySeat) {
      console.log('✅ VALIDATION SUCCESS: I have [6|6] and it\'s my turn');
      UIManager.addMessage('✅ You have [6|6] and will start the game');
    } else {
      console.log('⏳ VALIDATION: I don\'t have [6|6], waiting for correct player');
      UIManager.addMessage('⏳ Waiting for player with [6|6] to start');
    }
  },

  handleUpdateHand(newHand) {
    console.log('GameManager: Hand updated', newHand);
    GameState.updateMyHand(newHand);
    this.updateHandDisplays();
  },

  handleBroadcastMove(data) {
    console.log('GameManager: Dominican move broadcast', data);
    
    // Update board state
    GameState.updateBoard(data.boardState);
    
    // Update hand sizes
    if (data.handSizes && data.seat !== GameState.mySeat) {
      GameState.syncHandSizes(data.handSizes);
    }
    
    // Update displays
    this.updateAllDisplays();
    
    // Add move message
    this.addDominicanMoveMessage(data);
  },

  handleTurnChanged(turn) {
    console.log('GameManager: Dominican turn changed to', turn);
    
    this.clearAutoPassTimer();
    GameState.setCurrentTurn(turn);

    if (GameState.isMyTurn()) {
      this.handleMyDominicanTurn();
    } else {
      this.handleOtherPlayerTurn(turn);
    }

    // Update hand display to show current player
    this.updateHandDisplays();
  },

  handleMyDominicanTurn() {
    console.log('GameManager: My Dominican turn');
    
    // Show basic status
    UIManager.setStatus('Your turn! 🇩🇴');
    
    // Check for valid moves after a short delay
    this.autoPassTimer = setTimeout(() => {
      this.checkDominicanMoves();
    }, 1000);
  },

  handleOtherPlayerTurn(turn) {
    const playerName = this.getPlayerName(turn);
    UIManager.setStatus(`${playerName}'s turn... 🇩🇴`);
  },

  /**
   * Check for valid moves in Dominican rules - FIXED for first round
   */
  checkDominicanMoves() {
    if (!GameState.isMyTurn()) {
      console.log('GameManager: Not my turn, skipping move check');
      return;
    }

    console.log('GameManager: Checking Dominican moves...');
    console.log('GameManager: Board length:', GameState.boardState.length);
    console.log('GameManager: Is first round:', GameState.isFirstRound);
    console.log('GameManager: My hand:', GameState.myHand);

    // For first round, only check if player has [6|6]
    if (GameState.boardState.length === 0 && GameState.isFirstRound) {
      const hasDoubleSix = GameState.myHand.some(tile => tile[0] === 6 && tile[1] === 6);
      console.log(`GameManager: First round - checking for [6|6]: ${hasDoubleSix}`);
      
      if (hasDoubleSix) {
        this.showDominicanPlayableOptions();
        return;
      } else {
        // This should NEVER happen if opener detection works correctly
        console.error('GameManager: ERROR - It\'s my turn in first round but I don\'t have [6|6]!');
        UIManager.addMessage('ERROR: Turn order problem - I don\'t have [6|6]!');
        return;
      }
    }

    // For regular moves, check normal playability
    const hasPlayableTiles = GameState.hasPlayableTiles();
    console.log(`GameManager: Has playable tiles: ${hasPlayableTiles}`);
    
    if (!hasPlayableTiles) {
      this.initiateDominicanAutoPass();
    } else {
      this.showDominicanPlayableOptions();
    }
  },

  initiateDominicanAutoPass() {
    console.log('GameManager: Initiating Dominican auto-pass');
    
    UIManager.setStatus('🚫 No valid moves - Auto-passing in 3 seconds... 🇩🇴');
    UIManager.addMessage('No valid moves available (Dominican rules) - passing automatically');

    if (UIManager.showNotification) {
      UIManager.showNotification('No valid moves! Passing automatically... 🇩🇴', 'warning', 3000);
    }

    this.autoPassTimer = setTimeout(() => {
      if (GameState.isMyTurn()) {
        this.executeDominicanPass();
      }
    }, 3000);
  },

  showDominicanPlayableOptions() {
    const ends = GameState.getBoardEnds();
    
    if (ends) {
      UIManager.setStatus(`Your turn! 🇩🇴 Play on ${ends.left} or ${ends.right}`);
    } else {
      // First move
      if (GameState.gameRules === 'dominican') {
        UIManager.setStatus('Your turn! 🇩🇴 Play the double-six [6|6]');
      } else {
        UIManager.setStatus('Your turn! 🇩🇴 Play any tile');
      }
    }
  },

  executeDominicanPass() {
    console.log('GameManager: Executing Dominican pass');
    
    window.socket.emit('passPlay', {
      roomId: GameState.roomId,
      seat: GameState.mySeat
    });
    
    UIManager.addMessage('You passed (Dominican rules - no drawing) 🇩🇴');
  },

  handlePlayerPassed(data) {
    const playerName = this.getPlayerName(data.seat);
    const passMessage = `${playerName} passed 🇩🇴`;
    
    if (data.passCount) {
      UIManager.addMessage(`${passMessage} (${data.passCount}/4 passes)`);
    } else {
      UIManager.addMessage(passMessage);
    }

    if (data.seat === GameState.mySeat && UIManager.showNotification) {
      UIManager.showNotification('You passed your turn 🇩🇴', 'info', 1500);
    }
  },

  handleRoundEnded(data) {
    console.log('GameManager: Dominican round ended', data);
    
    this.clearAutoPassTimer();
    
    // Update game state
    GameState.updateBoard(data.boardState);
    GameState.updateScores(data.scores);
    GameState.syncHandSizes(data.finalHandSizes);
    
    // Update displays
    this.updateAllDisplays();
    
    // Show Dominican-specific results
    this.showDominicanRoundResults(data);
  },

  handleGameOver(data) {
    console.log('GameManager: Dominican game over', data);
    
    this.clearAutoPassTimer();
    this.clearSession();
    this.showDominicanGameOverResults(data);
  },

  handleErrorMessage(errorMessage) {
    console.error('GameManager: Error received:', errorMessage);
    if (UIManager.showError) {
      UIManager.showError(`🇩🇴 ${errorMessage}`);
    }
  },

  /* ----------------- DOMINICAN-SPECIFIC UTILITIES ----------------- */

  setInitialDominicanStatus(startingSeat, isFirstRound) {
    if (GameState.isMyTurn()) {
      if (isFirstRound) {
        UIManager.setStatus('Your turn! 🇩🇴 Play the double-six [6|6]');
      } else {
        UIManager.setStatus('Your turn! 🇩🇴 Play any tile');
      }
      
      // Check for moves after a delay
      this.autoPassTimer = setTimeout(() => {
        this.checkDominicanMoves();
      }, 1000);
    } else {
      const playerName = this.getPlayerName(startingSeat);
      UIManager.setStatus(`Waiting for ${playerName} to start... 🇩🇴`);
    }
  },

  addDominicanMoveMessage(data) {
    if (data.seat >= 0 && data.tile) {
      const playerName = this.getPlayerName(data.seat);
      const tile = `[${data.tile[0]}|${data.tile[1]}]`;
      UIManager.addMessage(`${playerName} played ${tile} 🇩🇴`);
    }
  },

  showDominicanRoundResults(data) {
    const winnerName = this.getPlayerName(data.winner);
    const winnerTeam = data.winner % 2;
    
    let message = `🏆 ${winnerName} wins the round! 🇩🇴`;
    
    // Add reason-specific messaging
    switch (data.reason) {
      case 'capicu':
        message += ' (Capicú!)';
        break;
      case 'paso':
        message += ' (Paso!)';
        break;
      case 'capicu_paso':
        message += ' (Capicú + Paso!)';
        break;
      case 'tranca':
        message += ' (Tranca - blocked board)';
        break;
    }
    
    const scoreMessage = `+${data.points} points to Team ${winnerTeam + 1}`;
    const totalMessage = `Scores: Team 1: ${data.scores[0]}, Team 2: ${data.scores[1]}`;
    
    UIManager.setStatus(message);
    UIManager.addMessage(message);
    UIManager.addMessage(scoreMessage);
    UIManager.addMessage(totalMessage);
    
    // Show details if available
    if (data.details && data.details.length > 0) {
      data.details.forEach(detail => UIManager.addMessage(`  ${detail}`));
    }
  },

  showDominicanGameOverResults(data) {
    const message = `🎉 DOMINICAN DOMINO GAME OVER! 🇩🇴 Team ${data.winningTeam + 1} wins!`;
    
    UIManager.setStatus(message);
    UIManager.addMessage(message);
    UIManager.addMessage(`Final Scores - Team 1: ${data.scores[0]}, Team 2: ${data.scores[1]}`);

    setTimeout(() => {
      const newGame = confirm(
        `🇩🇴 DOMINICAN DOMINO GAME OVER! 🇩🇴\n\n${message}\n\nFinal Scores:\nTeam 1: ${data.scores[0]}\nTeam 2: ${data.scores[1]}\n\nStart a new Dominican game?`
      );
      if (newGame) {
        location.reload();
      }
    }, 2000);
  },

  /* ----------------- STANDARD UTILITIES ----------------- */

  clearAutoPassTimer() {
    if (this.autoPassTimer) {
      clearTimeout(this.autoPassTimer);
      this.autoPassTimer = null;
    }
  },

  clearMessages() {
    const messagesElement = document.getElementById('messages');
    if (messagesElement) {
      messagesElement.innerHTML = '';
    }
  },

  updateAllDisplays() {
    // Update board
    if (window.BoardRenderer && window.BoardRenderer.render) {
      window.BoardRenderer.render();
    }
    
    // Update hands
    this.updateHandDisplays();
    
    // Update scores
    if (UIManager.updateScores) {
      UIManager.updateScores(GameState.scores);
    }
  },

  updateHandDisplays() {
    if (window.HandRenderer && window.HandRenderer.renderAll) {
      window.HandRenderer.renderAll();
    }
  },

  getPlayerName(seat) {
    if (window.LobbyManager && window.LobbyManager.players) {
      const player = window.LobbyManager.players.find(p => p && p.seat === seat);
      return player ? player.name : `Seat ${seat}`;
    }
    return `Seat ${seat}`;
  },

  clearSession() {
    sessionStorage.removeItem('domino_roomId');
    sessionStorage.removeItem('domino_mySeat');
  },

  cleanup() {
    this.clearAutoPassTimer();
  },

  getGameStatus() {
    return {
      gameRules: this.gameRules,
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

window.GameManager = GameManager;