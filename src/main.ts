import { startSpriteReview } from './debug/spriteReview';
import { startStress } from './debug/stress';
import { startGame } from './game/scenes/game';

const VIEW_W = 960;
const VIEW_H = 540;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-root') as HTMLElement;

function fitCanvas(): void {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

if (location.hash === '#perf') {
  startStress(canvas, uiRoot);
} else if (location.hash === '#sprites') {
  startSpriteReview(canvas);
} else {
  startGame(canvas, uiRoot);
}
