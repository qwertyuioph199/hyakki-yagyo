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
  /* 00 */ W(30, 40, ['yukinko']),
  /* 01 */ W(44, 36, ['yukinko', 'hitodama']),
  /* 02 */ W(58, 34, ['yukinko', 'kasa'], { swarm: { enemy: 'yukinko', count: 44, formation: 'wall' } }),
  /* 03 */ W(72, 32, ['yukinko', 'kasa', 'yosuzume']),
  /* 04 */ W(88, 30, ['kasa', 'yosuzume', 'hitotsume']),
  /* 05 */ W(104, 28, ['hitotsume', 'onibi'], { boss: 'gashadokuro' }),
  /* 06 */ W(120, 28, ['hitotsume', 'onibi', 'gaikotsu'], { swarm: { enemy: 'yukinko', count: 60, formation: 'ring' } }),
  /* 07 */ W(136, 26, ['onibi', 'gaikotsu']),
  /* 08 */ W(152, 26, ['onibi', 'kappa'], { boss: 'yukionna' }),
  /* 09 */ W(168, 25, ['kappa', 'onibi']),
  /* 10 */ W(186, 24, ['kappa', 'tsuchigumo'], { swarm: { enemy: 'yukinko', count: 76, formation: 'wall' } }),
  /* 11 */ W(204, 24, ['tsuchigumo', 'onibi']),
  /* 12 */ W(222, 23, ['tsuchigumo', 'hannya']),
  /* 13 */ W(240, 22, ['hannya', 'nurikabe']),
  /* 14 */ W(258, 22, ['hannya', 'tengu']),
  /* 15 */ W(244, 22, ['tengu', 'nurikabe'], { boss: 'shuten' }),
  /* 16 */ W(260, 21, ['tengu', 'hannya']),
  /* 17 */ W(276, 20, ['tengu', 'omukade'], { swarm: { enemy: 'yukinko', count: 96, formation: 'ring' } }),
  /* 18 */ W(292, 20, ['tengu', 'omukade'], { boss: 'yukionna' }),
  /* 19 */ W(308, 20, ['omukade', 'nue']),
  /* 20 */ W(324, 19, ['omukade', 'nue'], { boss: 'gashadokuro' }),
  /* 21 */ W(340, 19, ['nue']),
  /* 22 */ W(356, 19, ['nue', 'oni']),
  /* 23 */ W(372, 18, ['nue', 'oni'], { swarm: { enemy: 'yukinko', count: 116, formation: 'wall' } }),
  /* 24 */ W(388, 18, ['oni']),
  /* 25 */ W(404, 18, ['oni'], { boss: 'shuten' }),
  /* 26 */ W(418, 18, ['oni', 'nue'], { boss: 'yukionna' }),
  /* 27 */ W(432, 18, ['oni'], { swarm: { enemy: 'yukinko', count: 130, formation: 'ring' } }),
  /* 28 */ W(446, 17, ['oni', 'nurikabe']),
  /* 29 */ W(460, 17, ['oni', 'nue', 'tengu'], { boss: 'gashadokuro' }),
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
