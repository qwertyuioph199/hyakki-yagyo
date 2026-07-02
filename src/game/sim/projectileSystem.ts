import { TICK_DT } from '../../engine/loop';
import { Ev } from './events';
import type { Enemy, Projectile, World } from './world';

const PROJECTILE_HIT_RADIUS = 10;
/** Query pad so large-radius enemies at the edge are still found. */
const MAX_ENEMY_RADIUS = 24;

export function projectileSystem(world: World): void {
  const projs = world.projectiles;
  for (let i = projs.count - 1; i >= 0; i--) {
    const proj = projs.items[i]!;
    proj.px = proj.x;
    proj.py = proj.y;
    proj.x += proj.vx * TICK_DT;
    proj.y += proj.vy * TICK_DT;
    proj.ttl--;
    if (proj.ttl <= 0) {
      projs.free(i);
      continue;
    }

    const n = world.enemyHash.query(proj.x, proj.y, PROJECTILE_HIT_RADIUS + MAX_ENEMY_RADIUS, world.scratch);
    let died = false;
    for (let k = 0; k < n; k++) {
      const ei = world.scratch[k]!;
      if (ei >= world.enemies.count) continue; // freed earlier this pass
      const enemy = world.enemies.items[ei]!;
      // Swap-remove during this pass can re-point an index at a different
      // enemy; the exact distance re-check keeps hits honest either way.
      const dx = enemy.x - proj.x;
      const dy = enemy.y - proj.y;
      const hitR = PROJECTILE_HIT_RADIUS + enemy.radius;
      if (dx * dx + dy * dy > hitR * hitR) continue;
      if (alreadyHit(proj, enemy.uid)) continue;
      rememberHit(proj, enemy.uid);
      damageEnemy(world, ei, enemy, proj);
      if (proj.hitCount >= proj.pierce) {
        projs.free(i);
        died = true;
        break;
      }
    }
    if (died) continue;
  }
}

function alreadyHit(p: Projectile, uid: number): boolean {
  return p.hit0 === uid || p.hit1 === uid || p.hit2 === uid || p.hit3 === uid;
}

function rememberHit(p: Projectile, uid: number): void {
  // Ring of 4: with pierce capped small, older entries can safely rotate out.
  const slot = p.hitCount % 4;
  if (slot === 0) p.hit0 = uid;
  else if (slot === 1) p.hit1 = uid;
  else if (slot === 2) p.hit2 = uid;
  else p.hit3 = uid;
  p.hitCount++;
}

function damageEnemy(world: World, enemyIdx: number, enemy: Enemy, proj: Projectile): void {
  const dmg = proj.damage;
  enemy.hp -= dmg;
  enemy.hitFlash = 6;
  world.events.emit(Ev.DamageDealt, enemy.x, enemy.y, dmg, proj.weaponIdx);

  if (proj.knockback > 0 && enemy.knockbackResist < 1) {
    const dx = enemy.x - world.player.x;
    const dy = enemy.y - world.player.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const kb = 90 * proj.knockback * (1 - enemy.knockbackResist);
    enemy.kx += (dx / d) * kb;
    enemy.ky += (dy / d) * kb;
  }

  if (enemy.hp <= 0) {
    world.events.emit(Ev.EnemyDied, enemy.x, enemy.y, enemy.typeIdx, 0);
    world.player.kills++;
    spawnGem(world, enemy.x, enemy.y, enemy.xp);
    world.enemies.free(enemyIdx);
  }
}

function spawnGem(world: World, x: number, y: number, value: number): void {
  const gem = world.gems.alloc();
  if (!gem) {
    // Pool exhausted: fold the value into the nearest existing gem
    // (P3 replaces this with the RE'd gem-merge rule).
    if (world.gems.count > 0) world.gems.items[0]!.value += value;
    return;
  }
  gem.x = gem.px = x;
  gem.y = gem.py = y;
  gem.value = value;
  gem.magnetized = false;
  world.events.emit(Ev.GemSpawned, x, y, value, 0);
}
