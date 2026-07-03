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
  /* 00 */ W(8, 90, ['hitodama']),
  /* 01 */ W(14, 80, ['hitodama', 'chochin']),
  /* 02 */ W(20, 75, ['hitodama', 'chochin', 'kasa'], { swarm: { enemy: 'yosuzume', count: 30, formation: 'wall' } }),
  /* 03 */ W(26, 70, ['chochin', 'kasa', 'yosuzume']),
  /* 04 */ W(32, 66, ['chochin', 'kasa', 'hitotsume']),
  /* 05 */ W(38, 62, ['kasa', 'hitotsume', 'gaikotsu'], { boss: 'gashadokuro' }),
  /* 06 */ W(46, 58, ['hitotsume', 'gaikotsu', 'onibi'], { swarm: { enemy: 'yosuzume', count: 45, formation: 'ring' } }),
  /* 07 */ W(54, 54, ['gaikotsu', 'onibi']),
  /* 08 */ W(62, 52, ['gaikotsu', 'onibi', 'kappa']),
  /* 09 */ W(70, 50, ['onibi', 'kappa']),
  /* 10 */ W(80, 48, ['kappa', 'tsuchigumo'], { boss: 'gashadokuro' }),
  /* 11 */ W(90, 46, ['kappa', 'tsuchigumo'], { swarm: { enemy: 'yosuzume', count: 60, formation: 'wall' } }),
  /* 12 */ W(100, 44, ['tsuchigumo', 'hannya']),
  /* 13 */ W(112, 42, ['tsuchigumo', 'hannya', 'nurikabe']),
  /* 14 */ W(124, 40, ['hannya', 'nurikabe']),
  /* 15 */ W(138, 38, ['hannya', 'nurikabe', 'tengu'], { boss: 'shuten' }),
  /* 16 */ W(152, 36, ['hannya', 'tengu']),
  /* 17 */ W(166, 34, ['tengu', 'nurikabe'], { swarm: { enemy: 'yosuzume', count: 80, formation: 'ring' } }),
  /* 18 */ W(180, 32, ['tengu', 'omukade']),
  /* 19 */ W(196, 30, ['tengu', 'omukade']),
  /* 20 */ W(212, 29, ['omukade', 'nue'], { boss: 'gashadokuro' }),
  /* 21 */ W(228, 28, ['omukade', 'nue']),
  /* 22 */ W(244, 27, ['nue']),
  /* 23 */ W(260, 26, ['nue', 'oni'], { swarm: { enemy: 'yosuzume', count: 100, formation: 'wall' } }),
  /* 24 */ W(278, 25, ['nue', 'oni']),
  /* 25 */ W(296, 24, ['oni'], { boss: 'shuten' }),
  /* 26 */ W(314, 23, ['oni', 'nue']),
  /* 27 */ W(332, 22, ['oni'], { swarm: { enemy: 'yosuzume', count: 120, formation: 'ring' } }),
  /* 28 */ W(352, 21, ['oni', 'nurikabe']),
  /* 29 */ W(380, 20, ['oni', 'nue', 'tengu'], { boss: 'gashadokuro' }),
];

/** Enemies beyond this distance from the player teleport back to the spawn ring (VS despawn/respawn rule). */
export const DESPAWN_RADIUS = 800;
export const SPAWN_RING_RADIUS = 620;
