// Event token math, ported from LumaLibre/luma-events (JobsListener, TokenExchanging, TokenPayout).
// The numbers themselves live in src/data/event.json (scripts/build-event.mjs reads them from the source).

/** JobsListener: a token drops when nextInt(bound) < chance, so the odds are chance / bound. Tree Feller multiplies the bound. */
export function jobTokenChance(chance: number, bound: number, boundFactor = 1): number {
  return Math.min(1, Math.max(0, chance) / (bound * boundFactor));
}

/** Chance of at least one token in `actions` paid job actions. */
export function chanceWithin(p: number, actions: number): number {
  return 1 - Math.pow(1 - p, actions);
}

/** Paid job actions until you have a `chance` (e.g. 0.5, 0.9) of at least one token. */
export function actionsForChance(p: number, chance: number): number {
  return p >= 1 ? 1 : Math.ceil(Math.log(1 - chance) / Math.log(1 - p));
}

/** Average tokens an hour: every paid action rolls once (JobsListener runs on each JobsPrePaymentEvent). */
export const tokensPerHour = (p: number, actionsPerHour: number) => p * Math.max(0, actionsPerHour);

/** Average hours between tokens. */
export function hoursPerToken(p: number, actionsPerHour: number): number {
  const t = tokensPerHour(p, actionsPerHour);
  return t > 0 ? 1 / t : Infinity;
}

/** Hours of play until you have a `chance` (e.g. 0.9) of at least 1 token. */
export function hoursForChance(p: number, actionsPerHour: number, chance: number): number {
  return actionsPerHour > 0 && p > 0 ? actionsForChance(p, chance) / actionsPerHour : Infinity;
}

/** How staff started a minigame: NORMAL is { amount: 1, flat: false }. */
export interface Payout {
  amount: number;
  flat: boolean;
}

/** TokenPayout.apply: what the minigame hands to the token giver for a formula result of `earned`. Java Math.round rounds .5 up, like JS. */
export function applyPayout(earned: number, payout: Payout): number {
  if (payout.amount <= 0) return 0;
  if (payout.flat) return Math.round(payout.amount);
  if (earned < 1) return 0;
  if (payout.amount === 1) return earned;
  return Math.round(earned * payout.amount);
}

/**
 * TokenExchanging.give: the server multiplier is applied and rounded up, then at most `cap` tokens are handed over.
 * `shown` is what the chat message says (it uses the uncapped number), `given` is what lands in your inventory.
 */
export function deliver(amount: number, multiplier: number, cap: number): { shown: number; given: number } {
  if (amount < 1) return { shown: 0, given: 0 };
  const shown = Math.ceil(multiplier * amount);
  return { shown, given: Math.min(shown, cap) };
}
