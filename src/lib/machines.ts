// Machine-driven actions (Smelt, Brew) are paced by the block, not the player.
// Timings are vanilla: furnace 200 ticks, smoker/blast furnace 100 ticks, brewing stand 400 ticks.
// Default/max counts are Luma's job-block limits (LumaLibre/JobsAddons JobsBlockConstant.kt).

export type MachineId = 'furnace' | 'smoker' | 'blast_furnace' | 'brewing_stand';

export interface Machine {
  id: MachineId;
  label: string;
  perHour: number;
  defaultCount: number;
  maxCount: number;
}

const TICKS_PER_HOUR = 20 * 3600;

export const MACHINES: Record<MachineId, Machine> = {
  furnace: { id: 'furnace', label: 'Furnaces', perHour: TICKS_PER_HOUR / 200, defaultCount: 20, maxCount: 30 },
  smoker: { id: 'smoker', label: 'Smokers', perHour: TICKS_PER_HOUR / 100, defaultCount: 10, maxCount: 20 },
  blast_furnace: { id: 'blast_furnace', label: 'Blast furnaces', perHour: TICKS_PER_HOUR / 100, defaultCount: 10, maxCount: 20 },
  brewing_stand: { id: 'brewing_stand', label: 'Brewing stands', perHour: TICKS_PER_HOUR / 400, defaultCount: 20, maxCount: 30 },
};

/** Which machines can perform a job's action. Smokers only cook food; blast furnaces only smelt ores/metal. */
export function machinesFor(job: string, action: string): Machine[] {
  if (action === 'Brew') return [MACHINES.brewing_stand];
  if (action !== 'Smelt') return [];
  if (job === 'Cook') return [MACHINES.furnace, MACHINES.smoker];
  if (job === 'Blacksmith') return [MACHINES.furnace, MACHINES.blast_furnace];
  return [MACHINES.furnace];
}

/** Items (or brews) per hour for a set of always-fed machines. */
export function machineRate(counts: Partial<Record<MachineId, number>>): number {
  let total = 0;
  for (const [id, n] of Object.entries(counts)) total += MACHINES[id as MachineId].perHour * (n ?? 0);
  return total;
}
