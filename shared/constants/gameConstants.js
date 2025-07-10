// shared/constants/gameConstants.js
// 
// NOTE FOR AI: These constants are currently duplicated in client.js and server.js
// to avoid ES6 module import issues. In the future, you can use a build tool
// like Webpack to properly share these constants between client and server.

// Game timing
export const HIT_PADDING = 25;
export const ERROR_DISPLAY_TIME = 4000;

// Game rules
export const OPENING_TILE = [6, 6];
export const HAND_SIZE = 7;
export const WINNING_SCORE = 200;

// Domino dimensions - Board
export const DOMINO_WIDTH = 40;
export const DOMINO_HEIGHT = 80;
export const DOMINO_GAP = 2;

// Domino dimensions - Hand
export const HAND_DOMINO_WIDTH = 30;
export const HAND_DOMINO_HEIGHT = 60;