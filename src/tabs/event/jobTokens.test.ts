import { describe, expect, it } from 'vitest';
import data from '../../data/event.json';
import type { EventData } from '../../data/types';
import { jobTokenChance } from '../../lib/event';
import { brewsPerStandHour, fishingTiming } from '../../lib/mcmmo';
import { defaultJobPrefs, fishingSetupOf, pickedItem } from '../jobs/prefs';
import { resolveRate } from '../jobs/rate';
import { alchemistTokensAt, alchemyLevelToReach, calcJob, jobTokenRow } from './jobTokens';

const EVENT = data as unknown as EventData; // see src/tabs/event/common.tsx
const { bound } = EVENT.jobs;
const chanceOf = (job: string) => EVENT.jobs.list.find((j) => j.job === job)!.chance;
const prefsOf = (job: string) => defaultJobPrefs(calcJob(job)!);

describe('job tokens per hour', () => {
  it('every event job has a Jobs calculator setup to take its rate from', () => {
    for (const j of EVENT.jobs.list) expect(jobTokenRow(j.job, j.chance, bound, 1, prefsOf(j.job)), j.job).not.toBeNull();
  });

  it('uses exactly the rate the Jobs calculator works out for the same settings', () => {
    for (const j of EVENT.jobs.list) {
      const job = calcJob(j.job)!;
      const prefs = { ...defaultJobPrefs(job), alchemyLevel: 420, fishingLevel: 300, machines: { brewing_stand: 7, furnace: 12 } };
      const row = jobTokenRow(j.job, j.chance, bound, 1, prefs)!;
      expect(row.actionsPerHour, j.job).toBeCloseTo(resolveRate(job, pickedItem(job, prefs)!, prefs).perHour, 9);
    }
  });

  it('Alchemist: 20 stands brew 3,609 times an hour at Alchemy 0, 5,294 at 155 and 14,400 at 1000', () => {
    const p = jobTokenChance(chanceOf('Alchemist'), bound);
    expect(p).toBeCloseTo(1 / 10_000, 12);
    // 399, 272 and 100 ticks per brew (mcMMO counts a 400 tick timer down by the Catalysis speed).
    expect(20 * brewsPerStandHour(0)).toBeCloseTo((20 * 72_000) / 399, 6);
    expect(20 * brewsPerStandHour(155)).toBeCloseTo((20 * 72_000) / 272, 6);
    expect(20 * brewsPerStandHour(1000)).toBeCloseTo(14_400, 6);
    for (const [level, perHour] of [[0, 0.3609], [155, 0.5294], [1000, 1.44]]) {
      const row = jobTokenRow('Alchemist', chanceOf('Alchemist'), bound, 1, { ...prefsOf('Alchemist'), alchemyLevel: level })!;
      expect(row.tokensPerHour, `Alchemy ${level}`).toBeCloseTo(perHour, 4);
      expect(row.tokensPerHour).toBeCloseTo(alchemistTokensAt(p, 20, level), 9);
      expect(row.basis).toBe(`20 brewing stands, Alchemy ${level}`);
    }
  });

  it('Fisherman per hour follows the fishing setup, and Master Angler raises it', () => {
    const base = prefsOf('Fisherman');
    const at0 = jobTokenRow('Fisherman', chanceOf('Fisherman'), bound, 1, base)!;
    expect(at0.actionsPerHour).toBeCloseTo(fishingTiming(fishingSetupOf(base)).catchesPerHour, 9);
    const at600 = jobTokenRow('Fisherman', chanceOf('Fisherman'), bound, 1, { ...base, fishingLevel: 600 })!;
    expect(at600.tokensPerHour).toBeGreaterThan(at0.tokensPerHour);
    expect(at0.basis).toBe('Fishing 0, Lure III');
  });

  it('finds the lowest Alchemy level where the Alchemist overtakes a target rate', () => {
    const p = jobTokenChance(chanceOf('Alchemist'), bound);
    const fisher = jobTokenRow('Fisherman', chanceOf('Fisherman'), bound, 1, prefsOf('Fisherman'))!.tokensPerHour;
    const level = alchemyLevelToReach(p, 20, fisher)!;
    expect(level).toBeGreaterThan(0);
    expect(alchemistTokensAt(p, 20, level)).toBeGreaterThanOrEqual(fisher);
    expect(alchemistTokensAt(p, 20, level - 1)).toBeLessThan(fisher);
    expect(alchemyLevelToReach(p, 20, 99)).toBeNull();
    expect(alchemyLevelToReach(p, 0, 0.01)).toBeNull();
  });

  it('Tree Feller divides Lumberjack odds by 3 at the same pace', () => {
    const prefs = prefsOf('Lumberjack');
    const normal = jobTokenRow('Lumberjack', chanceOf('Lumberjack'), bound, 1, prefs)!;
    const feller = jobTokenRow('Lumberjack', chanceOf('Lumberjack'), bound, EVENT.jobs.treeFellerFactor, prefs)!;
    expect(feller.tokensPerHour).toBeCloseTo(normal.tokensPerHour / 3, 12);
    expect(feller.actionsPerHour).toBe(normal.actionsPerHour);
  });
});
