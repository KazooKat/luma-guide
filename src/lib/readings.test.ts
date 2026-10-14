import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import meta from '../../data/jobs-meta.json';
import { moneyAt, moneyBase, xpAt, xpBase } from './scaling';

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

const JOBS = (meta as unknown as { jobs: Record<string, { xpOffset: number; readLevels: number[]; confidence: string }> }).jobs;

/** Items whose projection misses the later reading by more than the 2-decimal rounding of both readings allows. */
function misses(earlier: string, later: string, c: number, field: 'money' | 'xp') {
  const a = readDump(earlier), b = readDump(later);
  const after = new Map(b.rows.map((r) => [r.key, r]));
  const out: string[] = [];
  let checked = 0;
  for (const r of a.rows) {
    const s = after.get(r.key);
    if (!s || r[field] < 0.5) continue; // tiny values say little through rounding
    checked++;
    const projected = field === 'money' ? moneyAt(moneyBase(r.money, a.level), b.level) : xpAt(xpBase(r.xp, a.level, c), b.level, c);
    const slack = 0.005 * (projected / r[field]) + 0.0051;
    if (Math.abs(projected - s[field]) > slack) out.push(`${r.key}: ${r[field]} at L${a.level} -> ${projected.toFixed(3)}, read ${s[field]} at L${b.level}`);
  }
  return { checked, out };
}

const PAIRS = [
  { job: 'Hunter', earlier: 'data/readings/hunter-23.txt', later: 'data/raw/hunter.txt' },
  { job: 'Farmer', earlier: 'data/readings/farmer-54.txt', later: 'data/raw/farmer.txt' },
  { job: 'Blacksmith', earlier: 'data/raw/blacksmith.txt', later: 'data/readings/blacksmith-26.txt' },
];

describe('jobs read at two levels', () => {
  it.each(PAIRS)('$job: money ∝ (L + 9) fits every item', ({ earlier, later }) => {
    const r = misses(earlier, later, 0, 'money');
    expect(r.checked).toBeGreaterThan(20);
    expect(r.out).toEqual([]);
  });

  it.each(PAIRS)('$job: XP ∝ (L + its xpOffset) fits every item', ({ job, earlier, later }) => {
    const r = misses(earlier, later, JOBS[job].xpOffset, 'xp');
    expect(JOBS[job].xpOffset).toBeCloseTo(10 / 7, 12);
    expect(r.checked).toBeGreaterThan(20);
    expect(r.out).toEqual([]);
  });

  it.each(PAIRS)('$job: the old (L + 5) does not fit, so the readings tell the two apart', ({ earlier, later }) => {
    const r = misses(earlier, later, 5, 'xp');
    expect(r.out.length).toBeGreaterThan(r.checked / 2);
  });

  it('every confirmed job was read at 2+ levels, and every assumed job at exactly 1', () => {
    for (const [job, m] of Object.entries(JOBS)) {
      expect(m.readLevels.length > 1, job).toBe(m.confidence === 'confirmed');
    }
  });
});
