import { SPRITES } from '../../art/spriteDefs';
import { buildAtlas } from '../../engine/atlas';
import { Camera } from '../../engine/camera';
import { Input } from '../../engine/input';
import { GameLoop } from '../../engine/loop';
import { Renderer } from '../../engine/renderer';
import { PerfHud } from '../../debug/perfHud';
import { RunPresenter } from '../presentation/renderRun';
import { stepRun } from '../sim/step';
import { createRun } from '../sim/world';
import { DraftUi } from '../../ui/draft';
import { Hud } from '../../ui/hud';

const VIEW_W = 960;
const VIEW_H = 540;

/** Wire sim + presentation + UI into a playable run (P2 vertical slice). */
export function startRunScene(canvas: HTMLCanvasElement, uiRoot: HTMLElement, seed: number): void {
  const renderer = new Renderer(canvas, VIEW_W, VIEW_H);
  renderer.setAtlas(buildAtlas(SPRITES));
  const camera = new Camera();
  const input = new Input();
  input.attach(window);

  const world = createRun({ seed });
  const presenter = new RunPresenter(renderer, camera);
  const hud = new Hud(uiRoot);
  const draft = new DraftUi(uiRoot);
  const perf = new PerfHud(uiRoot);
  if (location.hash !== '#debug') perf.toggle(); // hidden unless #debug (F3 toggles)

  let simMs = 0;
  let lastFrame = performance.now();

  const loop = new GameLoop({
    tick() {
      const t0 = performance.now();
      const snapshot = input.sample();
      if (input.wasPressed('F3')) perf.toggle();
      stepRun(world, snapshot);
      presenter.consumeEvents(world);
      camera.tick();
      simMs = performance.now() - t0;
    },
    render(alpha) {
      const t0 = performance.now();
      presenter.render(world, alpha);
      hud.update(world);
      draft.sync(world);
      const now = performance.now();
      perf.record(now - lastFrame, simMs, now - t0);
      lastFrame = now;
    },
  });

  // Debug hooks for automated verification (preview_eval / bot comparison).
  (window as unknown as Record<string, unknown>)['__hyakki'] = {
    world,
    loop,
    setTimeScale: (x: number) => {
      loop.timeScale = x;
    },
  };

  loop.start();
}
