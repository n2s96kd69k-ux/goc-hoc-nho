// Shared simulation, not real attendance. Seeded by Vietnam calendar day so
// reloads, accounts and browser timezones all replay the same 12-second walk.
const STEP = 12000, DAY = 86400000, VN = 7 * 3600000;
const curves = [[0,40],[2,25],[4.5,13],[5,25],[8,40],[10,52],[12,55],[13,65],[15,85],[17.5,115],[18.5,170],[20.5,255],[22,220],[23,165],[23.5,50],[24,40]];
const cache = new Map();
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function target(hour) {
  for (let i = 1; i < curves.length; i++) {
    const [a, x] = curves[i - 1], [b, y] = curves[i];
    if (hour <= b) return x + (y - x) * (hour - a) / (b - a);
  }
  return 40;
}
function bounds(h) {
  if (h >= 5 && h <= 8) return [20,45];
  if (h >= 13 && h <= 17.5) return [60,120];
  if (h >= 18.5 && h <= 23) return [150,280];
  if (h >= 23.5 || h <= 4.5) return [10,50];
  return [10,280];
}
function dailyWalk(day) {
  let seed = (day ^ 0x9e3779b9) >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const values = new Uint16Array(DAY / STEP);
  let value = 40, burst = 0, beats = 0;
  for (let i = 0; i < values.length; i++) {
    const hour = i * STEP / 3600000, base = target(hour);
    // Occasional gentle waves: drops spread over 15 beats (3 minutes).
    if (!beats && random() < 0.04) {
      burst = random() < 0.5 ? 15 + Math.floor(random() * 16) : -(10 + Math.floor(random() * 6));
      beats = burst < 0 ? 15 : 8;
    }
    let delta = clamp(Math.floor(random() * 4) - 1 + Math.round((base - value) * 0.08), -1, 2);
    if (beats) {
      delta = Math.round(burst / beats);
      burst -= delta; beats--;
    }
    const [lo, hi] = bounds(hour);
    value = clamp(value + delta, lo, hi);
    // Meet at midnight without a daily seed-reset jump.
    const fade = Math.min(1, i * STEP / 120000, (DAY - i * STEP) / 120000);
    const desired = Math.round(clamp(base + (value - base) * fade, lo, hi));
    // Also limit boundary corrections; changing time bands must not cause a cliff.
    // Band limits are targets: allow a short settling period at their edges.
    values[i] = i ? clamp(desired, values[i - 1] - 2, values[i - 1] + 4) : desired;
  }
  return values;
}
export function studyBaseline(at = Date.now()) {
  const local = at + VN, day = Math.floor(local / DAY);
  if (!cache.has(day)) {
    if (cache.size >= 2) cache.delete(cache.keys().next().value);
    cache.set(day, dailyWalk(day));
  }
  return cache.get(day)[Math.floor((local - day * DAY) / STEP)];
}
