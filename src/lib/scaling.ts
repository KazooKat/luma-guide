// Luma Jobs scaling. The server's Jobs config is not public; these formulas were fitted to
// in-game /jobs readings and checked against readings not used in the fit (see scaling.test.ts).

export const MAX_LEVEL = 85;

/** XP required to go from level L to L+1 (what /jobs stats shows at level L). */
export function req(L: number): number {
  return Math.round(4.29 * L ** 3 + 0.3002 * L ** 2 - 0.095);
}

/** Total XP needed to go from the start of level `from` to the start of level `to`. */
export function totalXp(from: number, to: number): number {
  let sum = 0;
  for (let L = from; L < to; L++) sum += req(L);
  return sum;
}

/** XP per action scales with (L + 5). `base` is the level-1 value. */
export const xpAt = (base: number, L: number) => (base * (L + 5)) / 6;
/** Money per action scales with (L + 9). `base` is the level-1 value. */
export const moneyAt = (base: number, L: number) => (base * (L + 9)) / 10;

/** Level-1 base from a reading taken at level L0. */
export const xpBase = (value: number, L0: number) => (value * 6) / (L0 + 5);
export const moneyBase = (value: number, L0: number) => (value * 10) / (L0 + 9);

export interface PlanInput {
  xpBase: number;
  moneyBase: number;
  from: number;
  to: number;
  actionsPerHour: number;
  /** XP already earned into level `from`. */
  xpInto?: number;
}

export interface PlanRow {
  /** Level reached at the end of this row. */
  level: number;
  hours: number;
  cumHours: number;
  actions: number;
  money: number;
  cumMoney: number;
}

export interface Plan {
  rows: PlanRow[];
  totalHours: number;
  totalActions: number;
  totalXp: number;
  totalMoney: number;
}

/**
 * Walks level by level from `from` to `to`, using the per-action XP and money for each level.
 * Treats progress within a level as continuous (ignores the rounding of the final action).
 */
export function planLevels(p: PlanInput): Plan {
  const rows: PlanRow[] = [];
  let cumHours = 0, cumMoney = 0, totalActions = 0, totalXpSum = 0;
  const rate = Math.max(p.actionsPerHour, 1e-9);
  for (let L = p.from; L < p.to; L++) {
    const need = Math.max(req(L) - (L === p.from ? p.xpInto ?? 0 : 0), 0);
    const actions = need / xpAt(p.xpBase, L);
    const hours = actions / rate;
    const money = actions * moneyAt(p.moneyBase, L);
    cumHours += hours;
    cumMoney += money;
    totalActions += actions;
    totalXpSum += need;
    rows.push({ level: L + 1, hours, cumHours, actions, money, cumMoney });
  }
  return { rows, totalHours: cumHours, totalActions, totalXp: totalXpSum, totalMoney: cumMoney };
}
