import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_IDS, BESTIARY_TARGETS, evaluateAchievements } from '../../src/data/achievements';
import { STAGES } from '../../src/data/stages';
import { ENEMIES, type EnemyId } from '../../src/data/enemies';
import { defaultSave, migrate } from '../../src/game/meta/save';
import { botInput, botResolveDrafts } from '../../bot/policy';
import { stepRun } from '../../src/game/sim/step';
import { createRun } from '../../src/game/sim/world';

describe('save v1 → v2 migration', () => {
  it('upgrades a real v1 save without losing anything', () => {
    const v1 = {
      version: 1,
      gold: 1234,
      goldSpent: 500,
      powerUps: { might: 3 },
      unlockedCharacters: ['onmyoji', 'miko'],
      stats: { totalKills: 999, totalRuns: 7, victories: 1, bestSurvivalTicks: 65_000, maxLevel: 25 },
      settings: { masterVolume: 0.5, musicVolume: 0.4, screenShake: false },
    };
    const v2 = migrate(v1 as unknown as Record<string, unknown>);
    expect(v2.version).toBe(2);
    expect(v2.gold).toBe(1234);
    expect(v2.powerUps.might).toBe(3);
    expect(v2.stats.totalKills).toBe(999); // v1 data preserved
    expect(v2.stats.bestKills).toBe(0); // v2 fields defaulted
    expect(v2.bestiary).toEqual({});
    expect(v2.achievements).toEqual([]);
    expect(v2.settings.screenShake).toBe(false);
  });
});

describe('achievements (v1.1)', () => {
  it('evaluates only unearned achievements and appends them', () => {
    const save = defaultSave();
    save.stats.totalRuns = 1;
    save.stats.bestKills = 150;
    const earned = evaluateAchievements(save);
    expect(earned).toContain('firstNight');
    expect(earned).toContain('hundredKills');
    expect(earned).not.toContain('dawn');
    // Second evaluation earns nothing new.
    expect(evaluateAchievements(save)).toEqual([]);
    expect(save.achievements).toContain('firstNight');
  });

  it('bestiary-complete requires every non-sweeper enemy', () => {
    const save = defaultSave();
    for (const id of BESTIARY_TARGETS) save.bestiary[id] = 1;
    delete save.bestiary[BESTIARY_TARGETS[0]!];
    expect(evaluateAchievements(save)).not.toContain('bestiaryComplete');
    save.bestiary[BESTIARY_TARGETS[0]!] = 1;
    expect(evaluateAchievements(save)).toContain('bestiaryComplete');
  });

  it('all achievement ids are unique and checkable on a default save', () => {
    expect(new Set(ACHIEVEMENT_IDS).size).toBe(ACHIEVEMENT_IDS.length);
    expect(() => evaluateAchievements(defaultSave())).not.toThrow();
  });
});

describe('雪女の峠 stage (v1.1)', () => {
  it('all wave pool/swarm/boss ids reference real enemies (both stages)', () => {
    for (const stage of Object.values(STAGES)) {
      for (const wave of stage.waves) {
        for (const id of wave.pool) expect(ENEMIES[id as EnemyId], id).toBeDefined();
        if (wave.swarm) expect(ENEMIES[wave.swarm.enemy as EnemyId]).toBeDefined();
        if (wave.boss) expect(ENEMIES[wave.boss as EnemyId]).toBeDefined();
      }
      expect(stage.waves.length).toBe(30);
    }
  });

  it('a toge run works headlessly and spawns yukionna-flavored content', () => {
    const world = createRun({ seed: 99, stageId: 'toge' });
    expect(world.waves).toBe(STAGES.toge.waves);
    for (let t = 0; t < 3 * 3600 && !world.gameOver; t++) {
      stepRun(world, botInput(world));
      botResolveDrafts(world);
      world.player.hp = world.player.stats.maxHp;
    }
    expect(world.player.kills).toBeGreaterThan(20);
    expect(world.enemies.count).toBeGreaterThan(0);
  });

  it('stage choice changes the run deterministically (same seed, different world)', () => {
    const a = createRun({ seed: 5, stageId: 'mori' });
    const b = createRun({ seed: 5, stageId: 'toge' });
    for (let t = 0; t < 2000; t++) {
      stepRun(a, { moveX: 1, moveY: 0 });
      stepRun(b, { moveX: 1, moveY: 0 });
    }
    expect(a.enemies.count).not.toBe(b.enemies.count);
  });
});
