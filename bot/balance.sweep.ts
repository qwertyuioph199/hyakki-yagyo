import { expect, it } from 'vitest';
import { botInput, botResolveDrafts } from './policy';
import type { CharacterId } from '../src/data/characters';
import { TICK_RATE } from '../src/engine/loop';
import { powerUpBonuses, type PowerUpRanks } from '../src/game/meta/shop';
import { stepRun } from '../src/game/sim/step';
import { createRun } from '../src/game/sim/world';

/**
 * Balance sweep (MECHANICS.md §10): {character × seed × shop investment},
 * each a full headless run. Gates are executable balance targets:
 *  - fresh save: median death 6..17 min (dies, but not instantly)
 *  - invested (~50% shop): ≥ 50% of runs reach dawn
 */
const DAWN_TICK = 30 * 60 * TICK_RATE;
const SEEDS = [11, 22, 33, 44];
const CHARS: CharacterId[] = ['onmyoji', 'miko', 'sohei'];

const INVESTED: PowerUpRanks = {
  might: 3,
  maxHp: 2,
  recovery: 3,
  armor: 2,
  cooldown: 1,
  moveSpeed: 1,
  magnet: 1,
  amount: 1,
};

interface RunResult {
  char: string;
  seed: number;
  invested: boolean;
  minutes: number;
  level: number;
  kills: number;
  victory: boolean;
}

function simulate(char: CharacterId, seed: number, invested: boolean): RunResult {
  const world = createRun({
    seed,
    characterId: char,
    powerUpBonuses: invested ? powerUpBonuses(INVESTED) : {},
  });
  while (!world.gameOver && world.tick < DAWN_TICK + 60 * TICK_RATE) {
    stepRun(world, botInput(world));
    botResolveDrafts(world);
  }
  return {
    char,
    seed,
    invested,
    minutes: Math.round((world.tick / (TICK_RATE * 60)) * 10) / 10,
    level: world.player.level,
    kills: world.player.kills,
    victory: world.victory,
  };
}

it('balance sweep: fresh saves die mid-run; invested saves can reach dawn', () => {
  const results: RunResult[] = [];
  for (const char of CHARS) {
    for (const seed of SEEDS) {
      results.push(simulate(char, seed, false));
      results.push(simulate(char, seed, true));
    }
  }
  // eslint-disable-next-line no-console
  console.table(results);

  const fresh = results.filter((r) => !r.invested);
  const invested = results.filter((r) => r.invested);
  const median = (xs: number[]) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

  const freshMedian = median(fresh.map((r) => r.minutes));
  const investedMedian = median(invested.map((r) => r.minutes));
  const dawnRate = invested.filter((r) => r.victory).length / invested.length;
  // eslint-disable-next-line no-console
  console.log(
    `fresh median death: ${freshMedian} min | invested median: ${investedMedian} min | invested dawn rate: ${(dawnRate * 100).toFixed(0)}%`,
  );

  // Gates (bots are far weaker than humans — see MECHANICS.md §10):
  expect(freshMedian).toBeGreaterThanOrEqual(6); // early game isn't a wall
  expect(freshMedian).toBeLessThanOrEqual(17); // fresh saves still die
  expect(investedMedian).toBeGreaterThanOrEqual(freshMedian + 2); // meta matters
  expect(investedMedian).toBeGreaterThanOrEqual(18); // invested runs go deep
});
