// Luma Jobs scaling. The server's Jobs config is not public; these formulas were fitted to
// in-game /jobs readings and checked against readings not used in the fit (see scaling.test.ts).

export const MAX_LEVEL = 85;
/** Pay per action stops growing at this level, for every job (Farmer read at 85 pays exactly its level 70 values). */
export const PAY_CAP = 70;

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

/**
 * XP per action scales with (L + c), where c is the job's `xpOffset`: 10/7 for Hunter, Farmer, Blacksmith, Builder and Fisherman (pinned by
 * readings 1 to 19 levels apart, see scaling.test.ts), 5 for Cook (its 41, 44, 45 and 46 readings, and the 2026-09-24 ones). `base` is the level-1 value.
 */
export const xpAt = (base: number, L: number, c: number, cap = PAY_CAP) => (base * (payLevel(L, cap) + c)) / (1 + c);
/** Money per action scales with (L + 9). `base` is the level-1 value. */
export const moneyAt = (base: number, L: number, cap = PAY_CAP) => (base * (payLevel(L, cap) + 9)) / 10;

/** Level-1 base from a reading taken at level L0. */
export const xpBase = (value: number, L0: number, c: number, cap = PAY_CAP) => (value * (1 + c)) / (payLevel(L0, cap) + c);
export const moneyBase = (value: number, L0: number, cap = PAY_CAP) => (value * 10) / (payLevel(L0, cap) + 9);

/**
 * The level pay is worked out at: pay per action stops growing at PAY_CAP for every job (the server's rule; measured on
 * Farmer, whose level 85 reading matches the formulas at 70, see readings.test.ts). Pass Infinity for the uncapped formulas.
 */
export const payLevel = (L: number, cap = PAY_CAP) => Math.min(L, cap);

export interface PlanInput {
  xpBase: number;
  /** The job's XP offset c, as in xpAt. */
  xpOffset: number;
  /** Level where pay per action stops growing (default PAY_CAP; Infinity for the uncapped formulas). */
  payCap?: number;
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
    const actions = need / xpAt(p.xpBase, L, p.xpOffset, p.payCap);
    const hours = actions / rate;
    const money = actions * moneyAt(p.moneyBase, L, p.payCap);
    cumHours += hours;
    cumMoney += money;
    totalActions += actions;
    totalXpSum += need;
    rows.push({ level: L + 1, hours, cumHours, actions, money, cumMoney });
  }
  return { rows, totalHours: cumHours, totalActions, totalXp: totalXpSum, totalMoney: cumMoney };
}
