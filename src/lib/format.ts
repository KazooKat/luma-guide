const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const two = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtInt = (n: number) => whole.format(n);
export const fmt2 = (n: number) => two.format(n);
export const fmtCompact = (n: number) => (Math.abs(n) < 10_000 ? whole.format(n) : compact.format(n));
export const fmtMoney = (n: number) => `$${Math.abs(n) < 10_000 ? two.format(n) : compact.format(n)}`;

/** 0.4 -> "24 min", 5.5 -> "5.5 h", 250 -> "250 h" */
export function fmtHours(h: number): string {
  if (!isFinite(h)) return '—';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 10) return `${h.toFixed(1)} h`;
  return `${whole.format(h)} h`;
}

export function fmtDays(days: number): string {
  if (!isFinite(days)) return '—';
  if (days < 1) return 'under a day';
  if (days < 60) return `about ${Math.ceil(days)} day${Math.ceil(days) === 1 ? '' : 's'}`;
  if (days < 730) return `about ${(days / 30.44).toFixed(1)} months`;
  return `about ${(days / 365.25).toFixed(1)} years`;
}
