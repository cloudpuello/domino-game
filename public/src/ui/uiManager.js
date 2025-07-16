/* ===================================================================== *
 * UI Manager (non-visual) - CORRECTED & EXPANDED
 * ===================================================================== */
const UIManager = (() => {
  const el = {};

  return {
    init() {
      const $ = (id) => document.getElementById(id);

      // Cache all required nodes
      el.status = $('status');
      el.errorBox = $('errors');
      el.msgLog = $('messages');
      el.score0 = $('team0-score');
      el.score1 = $('team1-score');
      el.playerInfo = $('playerInfo');
      el.lobbyContainer = $('lobbyContainer');
      el.gameView = $('gameView');

      if (!el.status) console.warn('[UIManager] #status not found');
      if (!el.errorBox) console.warn('[UIManager] #errors not found');
      if (!el.lobbyContainer) console.warn('[UIManager] #lobbyContainer not found');
    },

    setStatus(txt = '') {
      if (el.status) el.status.textContent = txt;
    },

    showError(msg = '', timeout = 3000) {
      if (!el.errorBox) return;
      el.errorBox.textContent = msg;
      el.errorBox.classList.add('flash');
      setTimeout(() => this.hideError(), timeout);
    },

    hideError() {
      if (!el.errorBox) return;
      el.errorBox.textContent = '';
      el.errorBox.classList.remove('flash');
    },

    addMessage(text) {
      if (!el.msgLog) return;
      const line = document.createElement('div');
      const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      line.innerHTML = `<span class="log-time">[${ts}]</span> ${text}`;
      el.msgLog.prepend(line);
      while (el.msgLog.children.length > 50) el.msgLog.lastChild.remove();
    },

    updateScores([t0 = 0, t1 = 0] = []) {
      if (el.score0) el.score0.textContent = t0;
      if (el.score1) el.score1.textContent = t1;
    },

    // --- NEW & FIXED METHODS ---

    /**
     * Toggles between the lobby and the main game view.
     */
    showLobby(show) {
      if (el.lobbyContainer) el.lobbyContainer.style.display = show ? 'block' : 'none';
      if (el.gameView) el.gameView.style.display = show ? 'none' : 'flex';
    },

    /**
     * Updates the player info text in the UI panel.
     */
    updatePlayerInfo(text = '') {
      if (el.playerInfo) el.playerInfo.textContent = text;
    },

    /**
     * Shows a temporary notification banner at the top of the screen.
     */
    showNotification(text, type = 'info', duration = 3000) {
      const notification = document.createElement('div');
      notification.className = `notification notification--${type}`;
      notification.textContent = text;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.classList.add('notification--out');
        notification.addEventListener('transitionend', () => notification.remove());
      }, duration);
    }
  };
})();

window.UIManager = UIManager;
