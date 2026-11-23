// Detects a deliberate shake from accelerometer readings (units of g; a phone at rest reads about 1).
// Pure and unit-tested (src/utils/__tests__/shake.test.ts): feed it each reading with the current time in ms.
//
// A shake is TWO strong spikes (magnitude over the threshold) inside a short window, so one bump, a dropped phone or a
// single jolt on a rough road does not count. A trigger starts a cooldown so one shake opens the screen once.

export interface ShakeOptions {
  threshold?: number; // magnitude in g that counts as a strong spike
  windowMs?: number; // both spikes must fall inside this window
  minGapMs?: number; // spikes closer than this are one jolt, not two
  cooldownMs?: number; // after a trigger, ignore everything for this long
}

export function createShakeDetector(options: ShakeOptions = {}) {
  const threshold = options.threshold ?? 1.8;
  const windowMs = options.windowMs ?? 800;
  const minGapMs = options.minGapMs ?? 150;
  const cooldownMs = options.cooldownMs ?? 5000;

  let spikes: number[] = [];
  let lastTrigger = Number.NEGATIVE_INFINITY;

  return {
    // True exactly when this reading completes a shake.
    push(x: number, y: number, z: number, now: number): boolean {
      if (![x, y, z, now].every(Number.isFinite)) return false;
      if (now - lastTrigger < cooldownMs) return false;
      if (Math.sqrt(x * x + y * y + z * z) <= threshold) return false;

      const last = spikes[spikes.length - 1];
      if (last !== undefined && now - last < minGapMs) return false; // the same jolt
      spikes = spikes.filter((t) => now - t <= windowMs);
      spikes.push(now);
      if (spikes.length < 2) return false;

      spikes = [];
      lastTrigger = now;
      return true;
    },
    reset() {
      spikes = [];
      lastTrigger = Number.NEGATIVE_INFINITY;
    },
  };
}

// The name of the screen the person is on, without Expo Router's "(group)" parts: "(tabs)/home" -> "home".
export function screenNameFromSegments(segments: string[]): string {
  const name = segments.filter((s) => !/^\(.*\)$/.test(s)).join('/');
  return name.replace(/[^\w\-/\[\]().: ]/g, '').slice(0, 80) || 'home';
}
