// How many paid actions an hour a job's calculator setup gives, shared by the Jobs calculator and the event Tokens page.
import type { Job, JobItem } from '../../data/types';
import { machineRate, machinesFor, type Machine } from '../../lib/machines';
import { brewsPerStandHour, fishingTiming } from '../../lib/mcmmo';
import { fishingSetupOf, type JobPrefs } from './prefs';

export interface Rate {
  perHour: number;
  machines: { machine: Machine; count: number }[];
}

/**
 * Smelt and Brew are paced by machines (brewing stands sped up by mcMMO Catalysis), fishing by the hook's
 * timers (mcMMO Master Angler, Lure, rain), everything else by how fast the player acts.
 */
export function resolveRate(job: Job, item: JobItem, prefs: JobPrefs): Rate {
  const machines = machinesFor(job.job, item.action).map((machine) => ({
    machine,
    count: Math.max(0, prefs.machines[machine.id] ?? machine.defaultCount),
  }));
  if (item.action === 'Brew') {
    return { perHour: machines.reduce((a, m) => a + m.count, 0) * brewsPerStandHour(prefs.alchemyLevel), machines };
  }
  if (machines.length) {
    return { perHour: machineRate(Object.fromEntries(machines.map((m) => [m.machine.id, m.count]))), machines };
  }
  if (item.action === 'Fish') {
    return { perHour: fishingTiming(fishingSetupOf(prefs)).catchesPerHour, machines: [] };
  }
  return { perHour: Math.max(1, Number(prefs.handRate) || job.defaultRate), machines: [] };
}
