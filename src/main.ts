import { startStress } from './debug/stress';
import { startRunScene } from './game/scenes/runScene';

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
} else {
  // Title scene + character select arrive in P4; until then boot straight
  // into a run with a fixed seed.
  startRunScene(canvas, uiRoot, 20260702);
}
