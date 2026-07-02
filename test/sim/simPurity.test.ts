import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Determinism guard: wall-clock and ambient randomness are banned inside the
 * sim and data layers. One stray Math.random() silently breaks replay
 * identity, the bot harness, and every balance sweep.
 */
const BANNED = [/Math\.random/, /Date\.now/, /performance\.now/, /new Date\(/];
const SCAN_DIRS = ['src/game/sim', 'src/data'];

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...collectTsFiles(p));
    else if (name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Comments may legitimately mention the banned names; only code counts. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('sim purity', () => {
  it('sim and data layers contain no wall-clock or ambient randomness', () => {
    const root = process.cwd();
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of collectTsFiles(join(root, dir))) {
        const text = stripComments(readFileSync(file, 'utf8'));
        for (const pattern of BANNED) {
          if (pattern.test(text)) offenders.push(`${file} matches ${pattern}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('sim layer does not import engine/renderer, atlas, audio, or DOM helpers', () => {
    const root = process.cwd();
    const offenders: string[] = [];
    for (const file of collectTsFiles(join(root, 'src/game/sim'))) {
      const text = stripComments(readFileSync(file, 'utf8'));
      if (/from '.*engine\/(renderer|atlas|camera|audio)/.test(text)) offenders.push(file);
      if (/document\.|window\./.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
