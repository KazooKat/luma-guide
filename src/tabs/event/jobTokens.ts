// Job token odds per hour for the event Tokens page. Actions per hour come from each job's Jobs calculator setup
// (saved settings or the calculator's defaults), so the two pages always agree.
import jobsData from '../../data/jobs.json';
import type { Job, JobItem, JobsData } from '../../data/types';
import { actionsForChance, hoursForChance, hoursPerToken, jobTokenChance, tokensPerHour } from '../../lib/event';
import { brewsPerStandHour, MCMMO_MAX_LEVEL } from '../../lib/mcmmo';
import { pickedItem, type JobPrefs } from '../jobs/prefs';
import { resolveRate, type Rate } from '../jobs/rate';

export const CALC_JOBS = (jobsData as JobsData).jobs;
export const calcJob = (name: string): Job | undefined => CALC_JOBS.find((j) => j.job === name);

const LURE = ['no Lure', 'Lure I', 'Lure II', 'Lure III', 'Lure IV', 'Lure V'];
const plural = (n: number, word: string) => `${n} ${n === 1 ? word.replace(/s$/, '') : word}`;

/** What a job's actions-per-hour figure is based on, in a few words ("20 brewing stands, Alchemy 0"). */
export function rateBasis(item: JobItem, prefs: JobPrefs, rate: Rate): { unit: string; basis: string } {
  if (item.action === 'Brew') {
    const stands = rate.machines.reduce((a, m) => a + m.count, 0);
    return { unit: 'brews', basis: `${plural(stands, 'brewing stands')}, Alchemy ${prefs.alchemyLevel}` };
  }
  if (rate.machines.length) {
    return { unit: 'smelts', basis: rate.machines.map((m) => plural(m.count, m.machine.label.toLowerCase())).join(', ') };
  }
  if (item.action === 'Fish') {
    const extra = [prefs.boat && 'boat', prefs.raining && 'rain'].filter(Boolean).join(', ');
    return { unit: 'catches', basis: `Fishing ${prefs.fishingLevel}, ${LURE[prefs.lure] ?? LURE[0]}${extra ? `, ${extra}` : ''}` };
  }
  return { unit: 'actions', basis: `${item.item} by hand` };
}

export interface JobTokenRow {
  job: string;
  icon: string;
  /** Chance of a token per paid action. */
  p: number;
  actionsPerHour: number;
  unit: string;
  basis: string;
  tokensPerHour: number;
  hoursPerToken: number;
  /** Actions and hours until a 90% chance of at least 1 token. */
  actions90: number;
  hours90: number;
}

/** One row of the table: a job's odds per action, and per hour with its calculator setup. */
export function jobTokenRow(name: string, chance: number, bound: number, boundFactor: number, prefs: JobPrefs): JobTokenRow | null {
  const job = calcJob(name);
  const item = job && pickedItem(job, prefs);
  if (!job || !item) return null;
  const rate = resolveRate(job, item, prefs);
  const p = jobTokenChance(chance, bound, boundFactor);
  return {
    job: name, icon: job.icon, p, actionsPerHour: rate.perHour, ...rateBasis(item, prefs, rate),
    tokensPerHour: tokensPerHour(p, rate.perHour), hoursPerToken: hoursPerToken(p, rate.perHour),
    actions90: actionsForChance(p, 0.9), hours90: hoursForChance(p, rate.perHour, 0.9),
  };
}

/** Alchemist tokens an hour at an Alchemy level, with `stands` always-fed brewing stands (1 paid action per brew). */
export const alchemistTokensAt = (p: number, stands: number, level: number) => tokensPerHour(p, Math.max(0, stands) * brewsPerStandHour(level));

/** The lowest Alchemy level at which the Alchemist earns at least `target` tokens an hour, or null if it never does. */
export function alchemyLevelToReach(p: number, stands: number, target: number): number | null {
  for (let level = 0; level <= MCMMO_MAX_LEVEL; level++) if (alchemistTokensAt(p, stands, level) >= target) return level;
  return null;
}
