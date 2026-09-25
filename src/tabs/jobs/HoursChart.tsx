import { useState } from 'preact/hooks';
import type { JobItem } from '../../data/types';
import { fmtCompact, fmtDays, fmtHours, fmtInt, fmtMoney } from '../../lib/format';
import type { Plan } from '../../lib/scaling';

/** Round a max up to a clean axis top with 4 steps (0 / 25 / 50 / 75 / 100). */
function niceTop(max: number): number {
  const rough = max / 4;
  const mag = 10 ** Math.floor(Math.log10(rough || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough)!;
  return step * 4;
}

export function HoursChart({ plan, item, perHour }: { plan: Plan; item: JobItem; perHour: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const rows = plan.rows;
  if (rows.length < 3) return null; // one or two bars say less than the numbers already shown
  const top = niceTop(Math.max(...rows.map((r) => r.hours)));
  const ticks = [0, 1, 2, 3, 4].map((k) => (top / 4) * k);
  const last = rows[rows.length - 1];
  const first = rows[0];
  // Label the first level, round tens, and the last level; bars are indexed by the level they finish.
  const xLabels = rows
    .map((r, idx) => ({ r, idx }))
    .filter(({ r, idx }) => idx === 0 || idx === rows.length - 1 || (r.level % 10 === 0 && idx > rows.length / 16 && idx < rows.length - 1 - rows.length / 16));
  const pos = (idx: number) => `${((idx + 0.5) / rows.length) * 100}%`;
  const hovered = hover === null ? null : rows[hover];

  return (
    <section class="card" aria-label="Hours to clear each level">
      <div class="card-title">
        <h3>Hours to clear each level</h3>
        <span>{item.item} at {fmtInt(perHour)}/h. XP needed grows faster than pay, so each level takes a bit longer.</span>
      </div>
      <div class="chart">
        <div class="chart-y" aria-hidden="true">
          {ticks.map((t) => <span key={t} style={{ top: `${100 - (t / top) * 100}%` }}>{t === 0 ? '0' : fmtHours(t)}</span>)}
        </div>
        <div class="chart-plot" onMouseLeave={() => setHover(null)}>
          {ticks.slice(1).map((t) => <div key={t} class="gridline" style={{ top: `${100 - (t / top) * 100}%` }} />)}
          <div class="bars" role="img" aria-label={`Bar chart: hours per level from ${first.level - 1} to ${last.level}. Values are in the milestones table.`}>
            {rows.map((r, idx) => (
              <div key={r.level} class={`bar-slot${hover === idx ? ' active' : ''}`} onMouseEnter={() => setHover(idx)} onClick={() => setHover(idx)}>
                <div class="bar" style={{ height: `${(r.hours / top) * 100}%` }} />
              </div>
            ))}
          </div>
          {hovered ? (
            <div class="tooltip" style={{ left: pos(hover!), top: `${100 - (hovered.hours / top) * 100}%` }}>
              Level {hovered.level - 1} → {hovered.level}: <b>{fmtHours(hovered.hours)}</b> · {fmtMoney(hovered.money)}
            </div>
          ) : (
            <span class="tip-label">{last.level - 1} → {last.level}: {fmtHours(last.hours)}</span>
          )}
        </div>
        <div class="chart-x" aria-hidden="true">
          {xLabels.map(({ r, idx }) => <span key={r.level} style={{ left: pos(idx) }}>{r.level}</span>)}
        </div>
      </div>
    </section>
  );
}

export function Milestones({ plan, from, hoursPerDay }: { plan: Plan; from: number; hoursPerDay: number }) {
  const rows = plan.rows.filter((r, i) => r.level % 5 === 0 || i === plan.rows.length - 1);
  return (
    <section class="card" aria-label="Milestones">
      <div class="card-title"><h3>Milestones</h3><span>from level {from}</span></div>
      <table class="mtable">
        <thead>
          <tr><th scope="col">Level</th><th scope="col">Hours</th><th scope="col">At {hoursPerDay} h/day</th><th scope="col">Earned</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.level}>
              <td>{r.level}</td>
              <td>{fmtHours(r.cumHours)}</td>
              <td class="soft">{fmtDays(r.cumHours / hoursPerDay).replace(/^about /, '')}</td>
              <td>{fmtMoney(r.cumMoney)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="note">Actions for the whole plan: {fmtCompact(plan.totalActions)}.</p>
    </section>
  );
}
