import { startStress } from './debug/stress';
import { GameLoop, TICK_DT } from './engine/loop';
import { Input } from './engine/input';

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
  startSquareDemo();
}

// P0 placeholder scene; replaced by the scene manager in P2.
function startSquareDemo(): void {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const input = new Input();
  input.attach(window);

  const SPEED = 260;
  let x = VIEW_W / 2;
  let y = VIEW_H / 2;
  let prevX = x;
  let prevY = y;

  new GameLoop({
    tick() {
      const t = input.sample();
      prevX = x;
      prevY = y;
      x += t.moveX * SPEED * TICK_DT;
      y += t.moveY * SPEED * TICK_DT;
    },
    render(alpha) {
      ctx.fillStyle = '#0b0b12';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const ix = prevX + (x - prevX) * alpha;
      const iy = prevY + (y - prevY) * alpha;
      ctx.fillStyle = '#e8a33d';
      ctx.fillRect(Math.round(ix) - 12, Math.round(iy) - 12, 24, 24);
    },
  }).start();
}
