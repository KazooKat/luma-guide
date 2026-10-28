import { describe, expect, it } from 'vitest';
import meta from '../../../data/jobs-meta.json';
import jobsData from '../../data/jobs.json';
import type { JobsData } from '../../data/types';

const DATA = jobsData as JobsData;
const META = meta.jobs as Record<string, { payChange?: unknown }>;

describe('announced pay changes', () => {
  const withChange = DATA.jobs.filter((j) => j.payChange);

  it('jobs.json carries every payChange from jobs-meta.json (rebuild with build_data.py if not)', () => {
    for (const [job, m] of Object.entries(META)) {
      expect(DATA.jobs.find((j) => j.job === job)?.payChange, job).toEqual(m.payChange);
    }
  });

  it.each(withChange.map((j) => [j.job, j.payChange!] as const))('%s note is well formed', (_job, c) => {
    expect(c.announced).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(c.announced))).toBe(false);
    expect(c.due.trim()).not.toBe('');
    expect(c.lines.length).toBeGreaterThan(0);
    for (const line of c.lines) {
      expect(line.trim()).not.toBe('');
      expect(line).not.toMatch(/[–—]/);
    }
  });
});
