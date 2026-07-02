import { TICK_DT, TICK_RATE } from '../../engine/loop';
import type { TickInput } from '../../engine/input';
import type { World } from './world';

const BASE_MOVE_SPEED = 130;

export function playerSystem(world: World, input: TickInput): void {
  const p = world.player;
  p.px = p.x;
  p.py = p.y;

  if (input.moveX !== 0 || input.moveY !== 0) {
    p.x += input.moveX * BASE_MOVE_SPEED * p.stats.moveSpeed * TICK_DT;
    p.y += input.moveY * BASE_MOVE_SPEED * p.stats.moveSpeed * TICK_DT;
    p.dirX = input.moveX;
    p.dirY = input.moveY;
  }

  if (p.iframes > 0) p.iframes--;

  if (p.stats.recovery > 0 && p.hp < p.stats.maxHp) {
    p.regenAcc += p.stats.recovery / TICK_RATE;
    if (p.regenAcc >= 1) {
      const heal = Math.floor(p.regenAcc);
      p.regenAcc -= heal;
      p.hp = Math.min(p.stats.maxHp, p.hp + heal);
    }
  }
}
