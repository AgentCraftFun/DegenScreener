// Seedable PRNG (mulberry32) for deterministic test mode.
let state = Math.floor(Math.random() * 0xffffffff);

export function seedRng(seed: number) {
  state = seed >>> 0;
}

export function rand(): number {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (((t ^ (t >>> 14)) >>> 0) % 0xffffffff) / 0xffffffff;
}

export function randInt(min: number, max: number): number {
  // inclusive
  return Math.floor(rand() * (max - min + 1)) + min;
}

export function randChoice<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(rand() * arr.length)];
}

export function randomHexTicker(len = 4): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(rand() * chars.length)];
  return s;
}
