import type { CharacterId } from '../../data/characters';
import type { PowerUpRanks } from './shop';

/**
 * Versioned localStorage save (MECHANICS.md §9).
 * - Single key; schema carries `version`.
 * - MIGRATIONS run sequentially at load; unknown/corrupt data is
 *   QUARANTINED under a separate key (never silently destroyed).
 * - base64 export/import for user backups.
 */
export const SAVE_KEY = 'hyakki_save';
export const QUARANTINE_KEY = 'hyakki_save_corrupt';
export const SAVE_VERSION = 1;

export interface SaveData {
  version: number;
  gold: number;
  /** Total gold ever spent in the shop (for full refunds). */
  goldSpent: number;
  powerUps: PowerUpRanks;
  unlockedCharacters: CharacterId[];
  stats: {
    totalKills: number;
    totalRuns: number;
    victories: number;
    bestSurvivalTicks: number;
    maxLevel: number;
  };
  settings: {
    masterVolume: number;
    musicVolume: number;
    screenShake: boolean;
  };
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    gold: 0,
    goldSpent: 0,
    powerUps: {},
    unlockedCharacters: ['onmyoji'],
    stats: { totalKills: 0, totalRuns: 0, victories: 0, bestSurvivalTicks: 0, maxLevel: 1 },
    settings: { masterVolume: 0.8, musicVolume: 0.7, screenShake: true },
  };
}

/** version → migration to version+1. Tested even while empty. */
export const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {};

export function migrate(raw: Record<string, unknown>): SaveData {
  let data = raw;
  let v = typeof data['version'] === 'number' ? (data['version'] as number) : 0;
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) break;
    data = step(data);
    v = typeof data['version'] === 'number' ? (data['version'] as number) : v + 1;
  }
  // Merge over defaults so missing fields never crash the game.
  const base = defaultSave();
  const merged: SaveData = {
    ...base,
    ...data,
    stats: { ...base.stats, ...(data['stats'] as object | undefined) },
    settings: { ...base.settings, ...(data['settings'] as object | undefined) },
    version: SAVE_VERSION,
  } as SaveData;
  if (!merged.unlockedCharacters.includes('onmyoji')) merged.unlockedCharacters.push('onmyoji');
  return merged;
}

export function loadSave(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): SaveData {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return defaultSave();
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
    return migrate(parsed);
  } catch {
    // Quarantine, never destroy.
    storage.setItem(QUARANTINE_KEY, raw);
    return defaultSave();
  }
}

export function persistSave(data: SaveData, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function exportSave(data: SaveData): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

export function importSave(encoded: string): SaveData | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded.trim())));
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return migrate(parsed);
  } catch {
    return null;
  }
}
