import { Game } from './game/Game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const uiOverlay = document.getElementById('ui-overlay') as HTMLDivElement;

if (!canvas || !uiOverlay) {
  throw new Error('Missing DOM elements');
}

const game = new Game(canvas, uiOverlay);
game.start();

// Expose for debug
(window as any).__game = game;
