import { describe, expect, it } from 'vitest';
import {
  defaultSave,
  exportSave,
  importSave,
  loadSave,
  migrate,
  persistSave,
  QUARANTINE_KEY,
  SAVE_KEY,
  SAVE_VERSION,
} from '../../src/game/meta/save';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  } as Storage;
}

describe('save system (RE §9)', () => {
  it('round-trips through persist/load', () => {
    const storage = memoryStorage();
    const save = defaultSave();
    save.gold = 1234;
    save.powerUps = { might: 3 };
    save.unlockedCharacters.push('miko');
    persistSave(save, storage);
    const loaded = loadSave(storage);
    expect(loaded.gold).toBe(1234);
    expect(loaded.powerUps.might).toBe(3);
    expect(loaded.unlockedCharacters).toContain('miko');
    expect(loaded.version).toBe(SAVE_VERSION);
  });

  it('quarantines corrupt saves instead of destroying them', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, '{not json!!!');
    const loaded = loadSave(storage);
    expect(loaded.gold).toBe(0); // fresh
    expect(storage.getItem(QUARANTINE_KEY)).toBe('{not json!!!');
  });

  it('missing fields merge over defaults (forward compatibility)', () => {
    const migrated = migrate({ version: 1, gold: 50 });
    expect(migrated.gold).toBe(50);
    expect(migrated.settings.screenShake).toBe(true);
    expect(migrated.unlockedCharacters).toContain('onmyoji');
  });

  it('export/import round-trips and rejects garbage', () => {
    const save = defaultSave();
    save.gold = 777;
    const encoded = exportSave(save);
    const back = importSave(encoded);
    expect(back?.gold).toBe(777);
    expect(importSave('garbage!!!')).toBeNull();
  });

  it('starter character is always unlocked', () => {
    expect(migrate({ version: 1, unlockedCharacters: [] }).unlockedCharacters).toContain('onmyoji');
  });
});
