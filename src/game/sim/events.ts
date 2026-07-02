/**
 * Sim → presentation event channel (frozen contract). The sim emits numeric
 * events into a pooled ring buffer each tick; presentation drains them to
 * spawn particles, floating text and SFX. Zero allocation, no callbacks —
 * the sim never knows who is listening (or that anyone is).
 */
export const enum Ev {
  EnemyDied = 0,
  DamageDealt = 1,
  PlayerHurt = 2,
  GemSpawned = 3,
  GemPicked = 4,
  LevelUp = 5,
  WeaponFired = 6,
  ChestSpawned = 7,
  ChestOpened = 8,
  PickupTaken = 9,
  EvolutionUnlocked = 10,
  BossSpawned = 11,
  DawnBreaks = 12,
  PlayerDied = 13,
  PlayerRevived = 14,
  SwarmEvent = 15,
  GoldGained = 16,
}

export interface SimEvent {
  type: Ev;
  x: number;
  y: number;
  /** Primary payload (damage amount, gem value, level, enemy type index...). */
  a: number;
  /** Secondary payload (crit flag, weapon index, chest tier...). */
  b: number;
}

const CAPACITY = 512;

export class EventQueue {
  private readonly buf: SimEvent[] = [];
  count = 0;
  /** Total events dropped due to a full buffer (asserted 0 in integration tests). */
  overflows = 0;

  constructor() {
    for (let i = 0; i < CAPACITY; i++) this.buf.push({ type: Ev.EnemyDied, x: 0, y: 0, a: 0, b: 0 });
  }

  emit(type: Ev, x: number, y: number, a = 0, b = 0): void {
    if (this.count >= CAPACITY) {
      this.overflows++;
      return;
    }
    const e = this.buf[this.count++]!;
    e.type = type;
    e.x = x;
    e.y = y;
    e.a = a;
    e.b = b;
  }

  get(i: number): SimEvent {
    return this.buf[i]!;
  }

  clear(): void {
    this.count = 0;
  }
}
