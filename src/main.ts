import { GameLoop, TICK_DT } from './engine/loop';
import { Input } from './engine/input';

// P0 bootstrap: fixed-timestep loop + movable square. Replaced by the scene
// manager in P2.
const VIEW_W = 960;
const VIEW_H = 540;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = VIEW_W;
canvas.height = VIEW_H;
ctx.imageSmoothingEnabled = false;

function fitCanvas(): void {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const input = new Input();
input.attach(window);

const SPEED = 260;
let x = VIEW_W / 2;
let y = VIEW_H / 2;
let prevX = x;
let prevY = y;

const loop = new GameLoop({
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
});
loop.start();
