import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import meta from '../../data/jobs-meta.json';
import { moneyAt, moneyBase, PAY_CAP, xpAt, xpBase } from './scaling';

// Cross-level checks: the same job read at two levels. Each item's earlier reading, projected to the later level with
// the job's formulas, must land on the later reading within the game's 2-decimal rounding.
interface Row { key: string; money: number; xp: number }

function readDump(path: string): { level: number; rows: Row[] } {
  const text = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  const level = Number(/^# level: (\d+)/m.exec(text)![1]);
  const rows: Row[] = [];
  const seen = new Map<string, number>();
  let action = '';
  for (const line of text.split('\n')) {
    if (line.startsWith('#')) continue;
    const head = /^\s?([A-Z][A-Za-z]*(?: [A-Za-z]+)*):\s*$/.exec(line);
    if (head) { action = head[1]; continue; }
    const m = /^\s+(.+?) ->\s+([\d,.]+)\$\s+([\d,.]+)xp\s*$/.exec(line);
    if (!m) continue;
    const base = `${action}/${m[1]}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    rows.push({ key: `${base}#${n}`, money: Number(m[2].replace(/,/g, '')), xp: Number(m[3].replace(/,/g, '')) });
  }
  return { level, rows };
}

// Items the server re-priced between readings, so a reading from before `since` can't project onto one taken after it.
// Pairs that straddle `since` skip these items, and the 'really changed' test below fails if an entry goes stale.
const REPRICED: Record<string, { key: string; since: number; note: string }[]> = {
  Farmer: [{ key: 'Break/Lily Pad#1', since: 61, note: 'nerfed by 2026-10-19: 36.43$ 41.28xp at L60, 3.23$ 6.12xp at L61' }],
};

function repricedBetween(job: string, earlier: string, later: string): string[] {
  const a = readDump(earlier).level, b = readDump(later).level;
  return (REPRICED[job] ?? []).filter((r) => a < r.since && b >= r.since).map((r) => r.key);
}

const JOBS = (meta as unknown as { jobs: Record<string, { xpOffset: number; readLevels: number[]; confidence: string }> }).jobs;

/** Items whose projection misses the later reading by more than the 2-decimal rounding of both readings allows. */
function misses(earlier: string, later: string, c: number, field: 'money' | 'xp', skip: string[] = [], cap = PAY_CAP) {
  const a = readDump(earlier), b = readDump(later);
  const after = new Map(b.rows.map((r) => [r.key, r]));
  const out: string[] = [];
  let checked = 0;
  for (const r of a.rows) {
    const s = after.get(r.key);
    if (!s || r[field] < 0.5 || skip.includes(r.key)) continue; // tiny values say little through rounding
    checked++;
    const projected = field === 'money'
      ? moneyAt(moneyBase(r.money, a.level, cap), b.level, cap)
      : xpAt(xpBase(r.xp, a.level, c, cap), b.level, c, cap);
    const slack = 0.005 * (projected / r[field]) + 0.0051;
    if (Math.abs(projected - s[field]) > slack) out.push(`${r.key}: ${r[field]} at L${a.level} -> ${projected.toFixed(3)}, read ${s[field]} at L${b.level}`);
  }
  return { checked, out };
}

// near: levels so close that both offsets round to the same 2 decimals on most items, so the pair can't tell them apart.
// Builder 32 -> 33 and Fisherman 47 -> 48 are 1 level apart but still tell them apart: (L + 5) misses most of their items.
const PAIRS = [
  { job: 'Hunter', earlier: 'data/readings/hunter-23.txt', later: 'data/raw/hunter.txt' },
  { job: 'Farmer', earlier: 'data/readings/farmer-54.txt', later: 'data/raw/farmer.txt' },
  { job: 'Farmer', earlier: 'data/readings/farmer-58.txt', later: 'data/raw/farmer.txt', near: true },
  { job: 'Farmer', earlier: 'data/readings/farmer-59.txt', later: 'data/raw/farmer.txt', near: true },
  { job: 'Farmer', earlier: 'data/readings/farmer-60.txt', later: 'data/raw/farmer.txt', near: true },
  // Read at 85 from another player's screenshots; it only fits with pay capped at PAY_CAP = 70 (see the test below).
  { job: 'Farmer', earlier: 'data/readings/farmer-85.txt', later: 'data/raw/farmer.txt' },
  { job: 'Builder', earlier: 'data/readings/builder-32.txt', later: 'data/raw/builder.txt' },
  { job: 'Fisherman', earlier: 'data/readings/fisherman-46.txt', later: 'data/raw/fisherman.txt' },
  { job: 'Fisherman', earlier: 'data/readings/fisherman-47.txt', later: 'data/raw/fisherman.txt' },
  { job: 'Blacksmith', earlier: 'data/raw/blacksmith.txt', later: 'data/readings/blacksmith-26.txt' },
  { job: 'Cook', earlier: 'data/readings/cook-41.txt', later: 'data/raw/cook.txt' },
  { job: 'Cook', earlier: 'data/readings/cook-44.txt', later: 'data/raw/cook.txt', near: true },
  { job: 'Cook', earlier: 'data/readings/cook-45.txt', later: 'data/raw/cook.txt', near: true },
];
/** What each job's readings pin XP to, and the other candidate that must not fit. */
const MEASURED: Record<string, { c: number; other: number }> = {
  Hunter: { c: 10 / 7, other: 5 }, Farmer: { c: 10 / 7, other: 5 }, Blacksmith: { c: 10 / 7, other: 5 }, Builder: { c: 10 / 7, other: 5 },
  Fisherman: { c: 10 / 7, other: 5 }, Cook: { c: 5, other: 10 / 7 },
};

describe('jobs read at two levels', () => {
  it.each(PAIRS)('$job ($earlier): money ∝ (L + 9) fits every item', ({ job, earlier, later }) => {
    const r = misses(earlier, later, 0, 'money', repricedBetween(job, earlier, later));
    expect(r.checked).toBeGreaterThan(15);
    expect(r.out).toEqual([]);
  });

  it.each(PAIRS)('$job ($earlier): XP ∝ (L + its xpOffset) fits every item', ({ job, earlier, later }) => {
    const r = misses(earlier, later, JOBS[job].xpOffset, 'xp', repricedBetween(job, earlier, later));
    expect(JOBS[job].xpOffset).toBeCloseTo(MEASURED[job].c, 12);
    expect(r.checked).toBeGreaterThan(5);
    expect(r.out).toEqual([]);
  });

  it.each(PAIRS.filter((p) => !p.near))('$job ($earlier): the other offset does not fit, so the readings tell (L + 10/7) and (L + 5) apart', ({ job, earlier, later }) => {
    const r = misses(earlier, later, MEASURED[job].other, 'xp', repricedBetween(job, earlier, later));
    expect(r.out.length).toBeGreaterThan(r.checked / 2);
  });

  it.each(PAIRS.filter((p) => repricedBetween(p.job, p.earlier, p.later).length))(
    '$job ($earlier): each re-priced item really changed, so the skip hides nothing',
    ({ job, earlier, later }) => {
      for (const key of repricedBetween(job, earlier, later)) {
        const hit = (m: { out: string[] }) => m.out.some((o) => o.startsWith(`${key}:`));
        expect(hit(misses(earlier, later, 0, 'money')) || hit(misses(earlier, later, JOBS[job].xpOffset, 'xp')), key).toBe(true);
      }
    },
  );

  it('every confirmed job was read at 2+ levels, and every assumed job at exactly 1', () => {
    for (const [job, m] of Object.entries(JOBS)) {
      expect(m.readLevels.length > 1, job).toBe(m.confidence === 'confirmed');
    }
  });
});

// Farmer read at 85 pays exactly what the formulas give at 70, so pay per action stops growing there (the server's rule
// for every job; only Farmer has been read past 70).
describe('pay cap', () => {
  const R85 = 'data/readings/farmer-85.txt', RAW = 'data/raw/farmer.txt';
  it('is 70', () => expect(PAY_CAP).toBe(70));

  it.each([[Infinity], [69], [71]])('cap %s misses most of the Farmer 85 items, so the reading pins it to exactly 70', (cap) => {
    for (const [field, c] of [['money', 0], ['xp', JOBS.Farmer.xpOffset]] as const) {
      const r = misses(R85, RAW, c, field, [], cap);
      expect(r.out.length, field).toBeGreaterThan(r.checked / 2);
    }
  });
});
