// Kamori's Glasses bloom hour: a port of KamorisGlasses.kt (LumaLibre/LumaItems @ 3c5a717).
// Kotlin uses signed 64-bit Longs that wrap; BigInt.asUintN(64, ...) reproduces the same bits.

const KEY = 'kamoris-glasses';
const U64 = (x: bigint) => BigInt.asUintN(64, x);
const C1 = -0x61c8864680b583ebn;
const C2 = -0x40a7b892e31b1a47n;
const C3 = -0x6b2fb644ecceee15n;

/** Java's String.hashCode (32-bit signed). */
function javaHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
const KEY_HASH = BigInt(javaHash(KEY));

/** Hour (0-23, server local time) of the bloom hour on the given LocalDate.toEpochDay(). */
export function bloomHour(epochDay: number): number {
  let z = U64(BigInt(epochDay) * C1 + KEY_HASH);
  z = U64((z ^ (z >> 30n)) * C2);
  z = U64((z ^ (z >> 27n)) * C3);
  z = z ^ (z >> 31n);
  return Number((z >> 1n) % 24n);
}

/** The server clock runs on US Eastern time (per the player; LocalDateTime.now() uses the JVM default zone). */
export const SERVER_TZ = 'America/New_York';

const etFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: SERVER_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});

/** ET calendar date (YYYY-MM-DD) and hour of an instant. */
export function etParts(ms: number): { date: string; hour: number } {
  const p = Object.fromEntries(etFormat.formatToParts(ms).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

export const epochDayOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 864e5;
export const addDays = (iso: string, n: number) =>
  new Date((epochDayOf(iso) + n) * 864e5).toISOString().slice(0, 10);

/** UTC instants at which the ET wall clock reads `date hour:00`. 0 on spring-forward, 2 on fall-back. */
export function etInstants(date: string, hour: number): number[] {
  const [y, m, d] = date.split('-').map(Number);
  const out = new Set<number>();
  for (const offset of [4, 5]) {
    const t = Date.UTC(y, m - 1, d, hour + offset);
    const p = etParts(t);
    if (p.date === date && p.hour === hour) out.add(t);
  }
  return [...out].sort((a, b) => a - b);
}

export interface BloomWindow {
  date: string;
  hour: number;
  start: number;
  end: number;
}

/** The bloom window for an ET date, or null when that wall-clock hour doesn't exist (DST spring-forward). */
export function bloomWindow(date: string): BloomWindow | null {
  const hour = bloomHour(epochDayOf(date));
  const at = etInstants(date, hour);
  if (at.length === 0) return null;
  return { date, hour, start: at[0], end: at[at.length - 1] + 3_600_000 };
}

/** Upcoming windows starting from an ET date (skipping days that have none). */
export function schedule(fromDate: string, days: number): (BloomWindow | { date: string; hour: number; start: null })[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(fromDate, i);
    return bloomWindow(date) ?? { date, hour: bloomHour(epochDayOf(date)), start: null };
  });
}

export function bloomStatus(now: number): { active: BloomWindow | null; next: BloomWindow } {
  const today = etParts(now).date;
  let active: BloomWindow | null = null;
  for (let i = -1; i <= 400; i++) {
    const w = bloomWindow(addDays(today, i));
    if (!w) continue;
    if (w.start <= now && now < w.end) active = w;
    else if (w.start > now) return { active, next: w };
  }
  throw new Error('no bloom window found within 400 days');
}
