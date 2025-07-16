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
   * AI NOTE: Initializes the module by setting up listeners for all game-related
   * socket events. This acts as the central hub for the client's game logic.
   */
  init() {
    console.log('GameManager: Initializing');

    if (!window.socket) {
      console.error('GameManager: Socket not available');
      return;
    }
    this.setupSocketListeners();
  },

  /**
   * AI NOTE: Dynamically sets up listeners for a predefined list of events.
   * This is a clean pattern that avoids having a long, repetitive list of
   * `socket.on(...)` calls.
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
   * AI NOTE: Handles the start of a new round. It resets all local state,
   * updates the UI to show the game board, and renders the initial hands.
   */
  handleRoundStart(data) {
    console.log('GameManager: Round starting', data);
    this.clearAutoPassTimer();

    if (UIManager.showLobby) {
      UIManager.showLobby(false);
    }

    GameState.reset();
    GameState.isGameActive = true;
    GameState.updateMyHand(data.yourHand);
    GameState.setCurrentTurn(data.startingSeat);
    GameState.updateScores(data.scores);

    this.updateHandSizes(data.handSizes, data.yourHand.length);
    this.clearMessages();
    this.updateAllDisplays();
    this.setInitialStatus(data.startingSeat);

    UIManager.addMessage('New round started!');
  },

  /**
   * AI NOTE: Handles the server sending an updated hand for the player.
   * This is typically used after a move is made or if a correction is needed.
   */
  handleUpdateHand(newHand) {
    console.log('GameManager: Hand updated');
    GameState.updateMyHand(newHand);
    this.updateHandDisplays();
  },

  /**
   * AI NOTE: Handles a move made by any player. It updates the board state
   * and the hand sizes of opponents.
   */
  handleBroadcastMove(data) {
    console.log('GameManager: Move broadcast', data);
    GameState.updateBoard(data.boardState); // Corrected to use boardState

    if (data.seat >= 0 && data.seat !== GameState.mySeat) {
        GameState.syncHandSizes(data.handSizes);
    }

    this.updateAllDisplays();
    this.addMoveMessage(data);
  },

  /**
   * AI NOTE: Central logic for when the turn changes. It clears any pending
   * auto-pass timers and determines if it's now the local player's turn.
   */
  handleTurnChanged(turn) {
    console.log('GameManager: Turn changed to', turn);
    this.clearAutoPassTimer();
    GameState.setCurrentTurn(turn);

    if (GameState.isMyTurn()) {
      this.handleMyTurn();
    } else {
      this.handleOtherPlayerTurn(turn);
    }

    // A single call to renderAll() will handle highlighting the current player.
    this.updateHandDisplays();
  },

  /**
   * AI NOTE: Logic for when it becomes the local player's turn. It updates
   * the status message and schedules a check to see if the player has any
   * valid moves.
   */
  handleMyTurn() {
    UIManager.setStatus('Your turn!');
    this.autoPassTimer = setTimeout(() => {
      this.checkForValidMovesAndAutoPass();
    }, 800);
  },

  handleOtherPlayerTurn(turn) {
    const playerName = this.getPlayerName(turn);
    UIManager.setStatus(`${playerName}'s turn...`);
  },

  /**
   * AI NOTE: Checks if the player has any playable tiles. If not, it
   * triggers the auto-pass sequence. This prevents the game from getting stuck.
   */
  checkForValidMovesAndAutoPass() {
    if (!GameState.isMyTurn()) return;

    if (!GameState.hasPlayableTiles()) {
      this.initiateAutoPass();
    } else {
      this.showPlayableOptions();
    }
  },

  initiateAutoPass() {
    UIManager.setStatus('🚫 No valid moves - Auto-passing in 3 seconds...');
    UIManager.addMessage('No valid moves available - you will pass automatically');

    if (UIManager.showNotification) {
      UIManager.showNotification('No valid moves! Passing automatically...', 'warning', 3000);
    }

    this.autoPassTimer = setTimeout(() => {
      if (GameState.isMyTurn()) {
        this.executePass();
      }
    }, 3000);
  },

  showPlayableOptions() {
    const ends = GameState.getBoardEnds();
    if (ends) {
      UIManager.setStatus(`Your turn! Play on ${ends.left} or ${ends.right}`);
    } else {
      UIManager.setStatus('Your turn! Play the double-six (6|6)');
    }
  },

  executePass() {
    window.socket.emit('passPlay', {
      roomId: GameState.roomId,
      seat: GameState.mySeat
    });
    UIManager.addMessage('You passed (no valid moves)');
  },

  handlePlayerPassed(data) {
    const playerName = this.getPlayerName(data.seat);
    UIManager.addMessage(`${playerName} passed`);

    if (data.seat === GameState.mySeat && UIManager.showNotification) {
      UIManager.showNotification('You passed your turn', 'info', 1500);
    }
  },

  handleRoundEnded(data) {
    console.log('GameManager: Round ended', data);
    this.clearAutoPassTimer();

    GameState.updateBoard(data.boardState);
    GameState.updateScores(data.scores);
    GameState.syncHandSizes(data.finalHandSizes);

    this.updateAllDisplays();
    this.showRoundResults(data);
  },

  handleGameOver(data) {
    console.log('GameManager: Game over', data);
    this.clearAutoPassTimer();
    this.clearSession();
    this.showGameOverResults(data);
  },

  handleErrorMessage(errorMessage) {
    console.error('GameManager: Error received:', errorMessage);
    if (UIManager.showError) {
      UIManager.showError(errorMessage);
    }
  },

  /* ----------------- UTILITIES ----------------- */

  clearAutoPassTimer() {
    if (this.autoPassTimer) {
      clearTimeout(this.autoPassTimer);
      this.autoPassTimer = null;
    }
  },

  updateHandSizes(serverHandSizes, myHandSize) {
    GameState.syncHandSizes(serverHandSizes);
  },

  clearMessages() {
    const messagesElement = document.getElementById('messages');
    if (messagesElement) {
      messagesElement.innerHTML = '';
    }
  },

  updateAllDisplays() {
    if (BoardRenderer.render) {
      BoardRenderer.render();
    }
    this.updateHandDisplays();
    if (UIManager.updateScores) {
      UIManager.updateScores(GameState.scores);
    }
  },

  updateHandDisplays() {
    if (HandRenderer.renderAll) {
      HandRenderer.renderAll();
    }
  },

  setInitialStatus(startingSeat) {
    if (GameState.isMyTurn()) {
      UIManager.setStatus('Your turn! Play the double-six (6|6)');
      this.autoPassTimer = setTimeout(() => {
        this.checkForValidMovesAndAutoPass();
      }, 800);
    } else {
      const playerName = this.getPlayerName(startingSeat);
      UIManager.setStatus(`Waiting for ${playerName} to play...`);
    }
  },

  addMoveMessage(data) {
    if (data.seat >= 0 && data.tile) {
      const playerName = this.getPlayerName(data.seat);
      UIManager.addMessage(`${playerName} played ${data.tile[0]}|${data.tile[1]}`);
    }
  },

  getPlayerName(seat) {
    if (LobbyManager && LobbyManager.players) {
      const player = LobbyManager.players.find(p => p && p.seat === seat);
      return player ? player.name : `Seat ${seat}`;
    }
    return `Seat ${seat}`;
  },

  showRoundResults(data) {
    const winnerName = this.getPlayerName(data.winner);
    const winnerTeam = data.winner % 2;

    const message = `🏆 ${winnerName} wins the round! (${data.reason})`;
    const scoreMessage = `+${data.points} points to Team ${winnerTeam + 1}`;
    const totalMessage = `Scores: Team 1: ${data.scores[0]}, Team 2: ${data.scores[1]}`;

    UIManager.setStatus(message);
    UIManager.addMessage(message);
    UIManager.addMessage(scoreMessage);
    UIManager.addMessage(totalMessage);
  },

  showGameOverResults(data) {
    const message = `🎉 GAME OVER! Team ${data.winningTeam + 1} wins!`;
    UIManager.setStatus(message);
    UIManager.addMessage(message);
    UIManager.addMessage(`Final Scores - Team 1: ${data.scores[0]}, Team 2: ${data.scores[1]}`);

    setTimeout(() => {
      const newGame = confirm(
        `${message}\n\nFinal Scores:\nTeam 1: ${data.scores[0]}\nTeam 2: ${data.scores[1]}\n\nStart a new game?`
      );
      if (newGame) {
        location.reload();
      }
    }, 1500);
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
