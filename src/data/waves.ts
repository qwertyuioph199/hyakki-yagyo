import type { WaveDef } from './types';

/**
 * Stage spawn table (MECHANICS.md §2) — one row per run-minute, mirroring
 * VS's per-minute wave definitions: a minimum-alive floor the spawner keeps
 * topped up, a spawn interval, the minute's enemy pool, and optional
 * one-shot swarm/boss events at the minute boundary.
 *
 * P3 ships a structural placeholder (single enemy type, escalating floors);
 * P4/W-A replaces it with the full RE'd 30-minute table over ~15 enemies.
 */
export const STAGE_WAVES: readonly WaveDef[] = Array.from({ length: 30 }, (_, minute) => ({
  minAlive: Math.min(400, 10 + minute * 12),
  interval: Math.max(20, 90 - minute * 3),
  pool: ['hitodama'],
  ...(minute > 0 && minute % 5 === 0 ? { swarm: { enemy: 'hitodama', count: 40, formation: 'ring' as const } } : {}),
}));

/** Enemies beyond this distance from the player teleport back to the spawn ring (VS despawn/respawn rule). */
export const DESPAWN_RADIUS = 800;
export const SPAWN_RING_RADIUS = 620;
