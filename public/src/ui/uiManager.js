/* ===================================================================== *
 * UI Manager (non‑visual)
 * ---------------------------------------------------------------------
 * ‑ No inline styles ‑ strictly DOM references + small helpers
 * ‑ Works with the new grid‑based HTML & external CSS
 * ‑ Central place the rest of the client code can call:
 *      UIManager.setStatus('Your turn')
 *      UIManager.showError('Bad move')
 *      UIManager.updateScores([15, 28])
 * ===================================================================== */

const UIManager = (() => {
  // -------------------------------------------------------------------
  // Private cached nodes
  // -------------------------------------------------------------------
  const el = {};

  /* ------------------------------------------------------------
     Public API
  ------------------------------------------------------------ */
  return {
    /** Must be called once, right after the DOM is ready */
    init() {
      const $ = (id) => document.getElementById(id);

      // Cache frequently‑touched nodes
      el.status   = $('status');         // <p id="status">
      el.errorBox = $('errors');         // <div id="errors">
      el.msgLog   = $('messages');       // <div id="messages">
      el.score0   = $('team0-score');    // <strong id="team0-score">
      el.score1   = $('team1-score');    // <strong id="team1-score'>

      if (!el.status)  console.warn('[UIManager] #status not found');
      if (!el.errorBox) console.warn('[UIManager] #errors not found');
    },

    /* -------------------------------------------------------- *
     * Lightweight status helpers
     * -------------------------------------------------------- */

    /** Shown in the left info panel – KEEP TEXT SHORT */
    setStatus(txt = '') {
      if (el.status) el.status.textContent = txt;
    },

    /** Red error bar that auto‑clears */
    showError(msg = '', timeout = 3000) {
      if (!el.errorBox) return;
      el.errorBox.textContent = msg;
      el.errorBox.classList.add('flash');       // CSS handles the effect
      setTimeout(() => this.hideError(), timeout);
    },

    hideError() {
      if (!el.errorBox) return;
      el.errorBox.textContent = '';
      el.errorBox.classList.remove('flash');
    },

    /** Append a timestamped log entry (keeps last 50) */
    addMessage(text) {
      if (!el.msgLog) return;
      const line = document.createElement('div');
      const ts   = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      line.innerHTML = `<span class="log-time">[${ts}]</span> ${text}`;
      el.msgLog.prepend(line);
      while (el.msgLog.children.length > 50) el.msgLog.lastChild.remove();
    },

    /** Team scores: array [team0, team1] */
    updateScores([t0 = 0, t1 = 0] = []) {
      if (el.score0) el.score0.textContent = t0;
      if (el.score1) el.score1.textContent = t1;
    }
  };
})();

/* Expose globally so other modules can call it */
window.UIManager = UIManager;
