// The Jobs calculator's per-job settings, shared with the event Tokens page so both work out actions per hour the
// same way (saved under luma-guide:job:<Job> in localStorage).
import type { Job, JobItem } from '../../data/types';
import { loadPref, savePref } from '../../lib/route';
import { MAX_LEVEL } from '../../lib/scaling';

export const itemKey = (it: JobItem) => `${it.action}/${it.item}`;

export interface JobPrefs {
  from: number;
  xpInto: number;
  to: number;
  hoursPerDay: number;
  itemKey: string;
  handRate: number;
  machines: Record<string, number>;
  /** mcMMO Alchemy level (Catalysis brewing speed, Concoctions ingredients). */
  alchemyLevel: number;
  /** Brewing chain from a water bottle, as ingredient materials. Empty = shortest chain for the picked item. */
  brewChain: string[];
  /** mcMMO Fishing level (Master Angler). */
  fishingLevel: number;
  lure: number;
  raining: boolean;
  boat: boolean;
  handlingSeconds: number;
}

export function defaultJobPrefs(job: Job): JobPrefs {
  return {
    from: 1, xpInto: 0, to: MAX_LEVEL, hoursPerDay: 4,
    itemKey: job.defaultItem ?? (job.items[0] ? itemKey(job.items[0]) : ''),
    handRate: job.defaultRate, machines: {},
    alchemyLevel: 0, brewChain: [], fishingLevel: 0, lure: 3, raining: false, boat: false, handlingSeconds: 1.5,
  };
}

const prefKey = (job: Job) => `job:${job.job}`;
export const loadJobPrefs = (job: Job): JobPrefs => loadPref(prefKey(job), defaultJobPrefs(job));
export const saveJobPrefs = (job: Job, prefs: JobPrefs) => savePref(prefKey(job), prefs);

/** The item the calculator has picked for this job (falls back to the first item if the saved one is gone). */
export const pickedItem = (job: Job, prefs: JobPrefs): JobItem | undefined =>
  job.items.find((i) => itemKey(i) === prefs.itemKey) ?? job.items[0];

/** The fishing part of a job's settings, as lib/mcmmo's fishingTiming takes it. */
export const fishingSetupOf = (prefs: JobPrefs) => ({
  level: prefs.fishingLevel, lure: prefs.lure, raining: prefs.raining, boat: prefs.boat, handlingSeconds: prefs.handlingSeconds,
});
