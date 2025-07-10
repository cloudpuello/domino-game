/* =====================================================================
 * style.css — Dominican Domino CSS (Updated for Snake Formation)
 * =================================================================== */

/* ────────────────────────────────────────────────────────────────────────
 * Reset and Base Styles
 * ────────────────────────────────────────────────────────────────────── */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Poppins', sans-serif;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  color: #fff;
  min-height: 100vh;
  overflow: hidden;
}

/* ────────────────────────────────────────────────────────────────────────
 * Main Game Container
 * ────────────────────────────────────────────────────────────────────── */
.game-container {
  display: flex;
  height: 100vh;
  position: relative;
}

/* ────────────────────────────────────────────────────────────────────────
 * Left Sidebar - Info Panel
 * ────────────────────────────────────────────────────────────────────── */
.info-panel {
  width: 300px;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 15px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.info-section h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #ffd700;
}

.info-section h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #ffd700;
}

.info-section p {
  font-size: 14px;
  line-height: 1.5;
}

/* ────────────────────────────────────────────────────────────────────────
 * Score Display
 * ────────────────────────────────────────────────────────────────────── */
.score-display {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.score-box {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  text-align: center;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.score-box span {
  display: block;
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 5px;
}

.score-box strong {
  display: block;
  font-size: 24px;
  font-weight: 600;
}

.your-team-color {
  background: rgba(76, 175, 80, 0.2);
  border-color: #4caf50;
}

.opponent-team-color {
  background: rgba(244, 67, 54, 0.2);
  border-color: #f44336;
}

/* ────────────────────────────────────────────────────────────────────────
 * Messages and Errors
 * ────────────────────────────────────────────────────────────────────── */
.message-log {
  max-height: 200px;
  overflow-y: auto;
  font-size: 12px;
  opacity: 0.9;
}

.message-log div {
  padding: 5px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.message-log div:last-child {
  border-bottom: none;
}

.error-display {
  color: #ff6b6b;
  font-weight: 600;
  font-size: 14px;
  min-height: 20px;
}

/* ────────────────────────────────────────────────────────────────────────
 * Lobby List
 * ────────────────────────────────────────────────────────────────────── */
#lobbyList {
  list-style: none;
  font-size: 14px;
}

#lobbyList li {
  padding: 5px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

#lobbyList li:last-child {
  border-bottom: none;
}

/* ────────────────────────────────────────────────────────────────────────
 * Game Table - Main Playing Area
 * ────────────────────────────────────────────────────────────────────── */
.game-table {
  flex: 1;
  position: relative;
  display: grid;
  grid-template-areas:
    ". top ."
    "left board right"
    ". bottom .";
  grid-template-columns: 200px 1fr 200px;
  grid-template-rows: 150px 1fr 150px;
  padding: 20px;
  gap: 20px;
}

/* ────────────────────────────────────────────────────────────────────────
 * Player Areas
 * ────────────────────────────────────────────────────────────────────── */
.player-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.player-area.top {
  grid-area: top;
}

.player-area.left {
  grid-area: left;
}

.player-area.right {
  grid-area: right;
}

.player-area.bottom {
  grid-area: bottom;
}

.player-name {
  font-size: 14px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.3);
  padding: 5px 15px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* ────────────────────────────────────────────────────────────────────────
 * Game Board - Snake Formation Area
 * ────────────────────────────────────────────────────────────────────── */
.game-board {
  grid-area: board;
  background: rgba(0, 0, 0, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  position: relative;
  overflow: auto;
  min-height: 600px;
  scroll-behavior: smooth;
}

.game-board.drop-hover {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
  box-shadow: inset 0 0 30px rgba(255, 215, 0, 0.3);
}

/* Board centering when content fits */
.game-board.board-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ────────────────────────────────────────────────────────────────────────
 * Placeholder for First Domino
 * ────────────────────────────────────────────────────────────────────── */
.tile-placeholder {
  width: 80px;
  height: 80px;
  border: 3px dashed rgba(255, 255, 255, 0.5);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
}

.tile-placeholder:hover {
  border-color: #ffd700;
  color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
}

/* ────────────────────────────────────────────────────────────────────────
 * Domino-specific styles (handled in client.js)
 * ────────────────────────────────────────────────────────────────────── */
/* Note: Board and hand domino styles are injected by client.js */

/* Ghost state for dragged dominoes */
.ghost {
  opacity: 0.3 !important;
}

/* Dummy dominoes for opponents */
.hand-domino.dummy {
  cursor: default !important;
}

.hand-domino.dummy:hover {
  transform: none !important;
}

/* ────────────────────────────────────────────────────────────────────────
 * Scrollbar Styling
 * ────────────────────────────────────────────────────────────────────── */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* ────────────────────────────────────────────────────────────────────────
 * Responsive Design
 * ────────────────────────────────────────────────────────────────────── */
@media (max-width: 1200px) {
  .info-panel {
    width: 250px;
  }
  
  .game-table {
    grid-template-columns: 150px 1fr 150px;
    grid-template-rows: 120px 1fr 120px;
  }
}

@media (max-width: 768px) {
  .game-container {
    flex-direction: column;
  }
  
  .info-panel {
    width: 100%;
    height: 200px;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-direction: row;
    overflow-x: auto;
  }
  
  .game-table {
    grid-template-columns: 100px 1fr 100px;
    grid-template-rows: 100px 1fr 100px;
    padding: 10px;
    gap: 10px;
  }
  
  .game-board {
    min-height: 400px;
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * Animations
 * ────────────────────────────────────────────────────────────────────── */
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(255, 215, 0, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 215, 0, 0);
  }
}

.current-player {
  animation: pulse 2s infinite;
}

/* ────────────────────────────────────────────────────────────────────────
 * Utility Classes
 * ────────────────────────────────────────────────────────────────────── */
.hidden {
  display: none !important;
}

.text-center {
  text-align: center;
}

.mt-10 {
  margin-top: 10px;
}

.mb-10 {
  margin-bottom: 10px;
}