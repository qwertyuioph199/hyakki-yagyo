import type { WaveDef } from './types';
import { STAGE_WAVES } from './waves';

/**
 * Stage definitions (v1.1). Each stage owns a 30-minute wave table plus
 * presentation colors; sim carries only stageId + the wave table.
 */
export interface StageDef {
  name: string;
  desc: string;
  waves: readonly WaveDef[];
  /** Presentation: background + ground-decal sprite id. */
  bg: string;
  groundSprite: string;
  /** AI-generated tileable ground texture (relative to /play/). */
  groundTexture: string;
  /** Unlock: best survival on ANY stage must reach this many minutes. */
  unlockMinutes: number;
}

const W = (
  minAlive: number,
  interval: number,
  pool: readonly string[],
  extra?: Partial<WaveDef>,
): WaveDef => ({ minAlive, interval, pool, ...extra });

/**
 * 雪女の峠 — faster, frailer, colder: 雪ん子 swarms all night, elite pace
 * is higher, and the 雪女 herself stalks minutes 8/18/26.
 */
const TOGE_WAVES: readonly WaveDef[] = [
  /* 00 */ W(12, 80, ['yukinko']),
  /* 01 */ W(20, 70, ['yukinko', 'hitodama']),
  /* 02 */ W(28, 64, ['yukinko', 'kasa'], { swarm: { enemy: 'yukinko', count: 40, formation: 'wall' } }),
  /* 03 */ W(36, 58, ['yukinko', 'kasa', 'yosuzume']),
  /* 04 */ W(44, 54, ['kasa', 'yosuzume', 'hitotsume']),
  /* 05 */ W(52, 50, ['hitotsume', 'onibi'], { boss: 'gashadokuro' }),
  /* 06 */ W(62, 46, ['hitotsume', 'onibi', 'gaikotsu'], { swarm: { enemy: 'yukinko', count: 55, formation: 'ring' } }),
  /* 07 */ W(72, 44, ['onibi', 'gaikotsu']),
  /* 08 */ W(82, 42, ['onibi', 'kappa'], { boss: 'yukionna' }),
  /* 09 */ W(92, 40, ['kappa', 'onibi']),
  /* 10 */ W(104, 38, ['kappa', 'tsuchigumo'], { swarm: { enemy: 'yukinko', count: 70, formation: 'wall' } }),
  /* 11 */ W(116, 36, ['tsuchigumo', 'onibi']),
  /* 12 */ W(128, 34, ['tsuchigumo', 'hannya']),
  /* 13 */ W(140, 32, ['hannya', 'nurikabe']),
  /* 14 */ W(152, 31, ['hannya', 'tengu']),
  /* 15 */ W(140, 30, ['tengu', 'nurikabe'], { boss: 'shuten' }),
  /* 16 */ W(152, 29, ['tengu', 'hannya']),
  /* 17 */ W(164, 28, ['tengu', 'omukade'], { swarm: { enemy: 'yukinko', count: 90, formation: 'ring' } }),
  /* 18 */ W(176, 27, ['tengu', 'omukade'], { boss: 'yukionna' }),
  /* 19 */ W(190, 26, ['omukade', 'nue']),
  /* 20 */ W(204, 25, ['omukade', 'nue'], { boss: 'gashadokuro' }),
  /* 21 */ W(218, 24, ['nue']),
  /* 22 */ W(232, 23, ['nue', 'oni']),
  /* 23 */ W(246, 22, ['nue', 'oni'], { swarm: { enemy: 'yukinko', count: 110, formation: 'wall' } }),
  /* 24 */ W(260, 21, ['oni']),
  /* 25 */ W(274, 20, ['oni'], { boss: 'shuten' }),
  /* 26 */ W(288, 20, ['oni', 'nue'], { boss: 'yukionna' }),
  /* 27 */ W(302, 19, ['oni'], { swarm: { enemy: 'yukinko', count: 130, formation: 'ring' } }),
  /* 28 */ W(318, 19, ['oni', 'nurikabe']),
  /* 29 */ W(336, 18, ['oni', 'nue', 'tengu'], { boss: 'gashadokuro' }),
];

export const STAGES = {
  mori: {
    name: '百鬼の森',
    desc: '全てが始まる夜。提灯が揺れ、人魂が漂う。',
    waves: STAGE_WAVES,
    bg: '#101018',
    groundSprite: 'ground_dot',
    groundTexture: '../assets/ground_mori.jpg',
    unlockMinutes: 0,
  },
  toge: {
    name: '雪女の峠',
    desc: '吹雪の夜道。雪ん子の群れと、彼女の視線。(森で15分生存で解放)',
    waves: TOGE_WAVES,
    bg: '#0e141f',
    groundSprite: 'ground_dot_snow',
    groundTexture: '../assets/ground_toge.jpg',
    unlockMinutes: 15,
  },
} as const satisfies Record<string, StageDef>;

export type StageId = keyof typeof STAGES;

export const STAGE_IDS = Object.keys(STAGES) as StageId[];
