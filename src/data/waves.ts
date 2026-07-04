import type { WaveDef } from './types';

/**
 * 百鬼夜行・本番ウェーブ表 (MECHANICS.md §2) — one row per run-minute.
 * minAlive is the alive floor the spawner tops up (× Curse);
 * interval is ticks between top-up batches; pool is this minute's roster.
 * Swarms: one-shot ring/wall of 夜雀. Bosses: minute-boundary miniboss
 * with a guaranteed chest.
 */
const W = (
  minAlive: number,
  interval: number,
  pool: readonly string[],
  extra?: Partial<WaveDef>,
): WaveDef => ({ minAlive, interval, pool, ...extra });

export const STAGE_WAVES: readonly WaveDef[] = [
  /* 00 */ W(24, 44, ['hitodama']),
  /* 01 */ W(36, 40, ['hitodama', 'chochin']),
  /* 02 */ W(50, 38, ['hitodama', 'chochin', 'kasa'], { swarm: { enemy: 'yosuzume', count: 34, formation: 'wall' } }),
  /* 03 */ W(64, 36, ['chochin', 'kasa', 'yosuzume']),
  /* 04 */ W(78, 34, ['chochin', 'kasa', 'hitotsume']),
  /* 05 */ W(92, 32, ['kasa', 'hitotsume', 'gaikotsu'], { boss: 'gashadokuro' }),
  /* 06 */ W(108, 30, ['hitotsume', 'gaikotsu', 'onibi'], { swarm: { enemy: 'yosuzume', count: 50, formation: 'ring' } }),
  /* 07 */ W(124, 30, ['gaikotsu', 'onibi']),
  /* 08 */ W(140, 28, ['gaikotsu', 'onibi', 'kappa']),
  /* 09 */ W(156, 28, ['onibi', 'kappa']),
  /* 10 */ W(172, 26, ['kappa', 'tsuchigumo'], { boss: 'gashadokuro' }),
  /* 11 */ W(190, 26, ['kappa', 'tsuchigumo'], { swarm: { enemy: 'yosuzume', count: 66, formation: 'wall' } }),
  /* 12 */ W(206, 25, ['tsuchigumo', 'hannya']),
  /* 13 */ W(222, 24, ['tsuchigumo', 'hannya', 'nurikabe']),
  /* 14 */ W(238, 24, ['hannya', 'nurikabe']),
  /* 15 */ W(224, 24, ['hannya', 'nurikabe', 'tengu'], { boss: 'shuten' }),
  /* 16 */ W(240, 23, ['hannya', 'tengu']),
  /* 17 */ W(256, 22, ['tengu', 'nurikabe'], { swarm: { enemy: 'yosuzume', count: 84, formation: 'ring' } }),
  /* 18 */ W(272, 22, ['tengu', 'omukade']),
  /* 19 */ W(288, 21, ['tengu', 'omukade']),
  /* 20 */ W(304, 20, ['omukade', 'nue'], { boss: 'gashadokuro' }),
  /* 21 */ W(320, 20, ['omukade', 'nue']),
  /* 22 */ W(336, 20, ['nue']),
  /* 23 */ W(352, 20, ['nue', 'oni'], { swarm: { enemy: 'yosuzume', count: 100, formation: 'wall' } }),
  /* 24 */ W(366, 19, ['nue', 'oni']),
  /* 25 */ W(380, 19, ['oni'], { boss: 'shuten' }),
  /* 26 */ W(394, 18, ['oni', 'nue']),
  /* 27 */ W(406, 18, ['oni'], { swarm: { enemy: 'yosuzume', count: 120, formation: 'ring' } }),
  /* 28 */ W(418, 18, ['oni', 'nurikabe']),
  /* 29 */ W(430, 18, ['oni', 'nue', 'tengu'], { boss: 'gashadokuro' }),
];

/** Enemies beyond this distance from the player teleport back to the spawn ring (VS despawn/respawn rule). */
export const DESPAWN_RADIUS = 800;
export const SPAWN_RING_RADIUS = 620;
