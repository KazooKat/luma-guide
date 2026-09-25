import type { Job, JobItem } from '../../data/types';
import type { JobPrefs } from '../JobsTab';
import { Icon } from '../../components/Icon';
import { fmt2, fmtCompact, fmtDays, fmtInt, fmtMoney } from '../../lib/format';
import { machineRate, machinesFor, type Machine } from '../../lib/machines';
import { moneyAt, xpAt, type Plan as PlanResult } from '../../lib/scaling';

export interface Rate {
  perHour: number;
  machines: { machine: Machine; count: number }[];
}

/** Smelt and Brew are paced by machines; everything else by how fast the player acts. */
export function resolveRate(job: Job, item: JobItem, prefs: JobPrefs): Rate {
  const machines = machinesFor(job.job, item.action).map((machine) => ({
    machine,
    count: Math.max(0, prefs.machines[machine.id] ?? machine.defaultCount),
  }));
  if (machines.length) {
    return { perHour: machineRate(Object.fromEntries(machines.map((m) => [m.machine.id, m.count]))), machines };
  }
  return { perHour: Math.max(1, Number(prefs.handRate) || job.defaultRate), machines: [] };
}

const NOUNS: Record<string, string> = {
  Break: 'Blocks to break', Place: 'Blocks to place', Smelt: 'Items to smelt', Brew: 'Brews', Craft: 'Crafts',
  Kill: 'Kills', Fish: 'Catches', Breed: 'Breeds', Tame: 'Tames', Shear: 'Shears', Milk: 'Milkings',
  Collect: 'Harvests', 'Strip logs': 'Logs to strip', TNTBreak: 'Blocks blown up',
};
export const actionNoun = (action: string) => NOUNS[action] ?? 'Actions';

const RATE_NOUNS: Record<string, string> = {
  Break: 'Blocks broken', Place: 'Blocks placed', Craft: 'Crafts', Kill: 'Kills', Fish: 'Catches', Breed: 'Breeds',
  Tame: 'Tames', Shear: 'Sheep sheared', Milk: 'Cows milked', Collect: 'Harvests', 'Strip logs': 'Logs stripped',
  TNTBreak: 'Blocks blown up',
};
const rateNoun = (action: string) => RATE_NOUNS[action] ?? 'Actions';

export function heroTime(h: number): string {
  if (!isFinite(h)) return '—';
  if (h < 1) {
    const m = Math.max(1, Math.round(h * 60));
    return `${m} minute${m === 1 ? '' : 's'}`;
  }
  if (h < 10) return `${h.toFixed(1)} hours`;
  return `${fmtInt(h)} hours`;
}

interface Props {
  job: Job;
  item: JobItem;
  from: number;
  to: number;
  hoursPerDay: number;
  rate: Rate;
  plan: PlanResult;
  prefs: JobPrefs;
  set: (p: Partial<JobPrefs>) => void;
}

export function Plan({ job, item, from, to, hoursPerDay, rate, plan, prefs, set }: Props) {
  const next = plan.rows[0];
  const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value);
  return (
    <section class="card" aria-label="Your plan">
      <div class="card-title"><h3>Your plan: {from} → {to}</h3></div>

      <div class="selected-item">
        <Icon id={item.icon} size={36} />
        <div>
          <b>{item.item}</b>
          <span>{item.action} · {fmtMoney(moneyAt(item.moneyBase, from))} and {fmt2(xpAt(item.xpBase, from))} XP each at level {from}</span>
        </div>
      </div>

      {rate.machines.length ? (
        <div style={{ display: 'grid', gap: '10px' }}>
          <span class="sub-label">Your {item.action === 'Brew' ? 'brewing stands' : 'smelters'} (always fed)</span>
          <div class="machines">
            {rate.machines.map(({ machine, count }) => (
              <label class="machine" key={machine.id}>
                <Icon id={machine.id} size={24} />
                <span>{machine.label}</span>
                <input
                  type="number" inputMode="numeric" min={0} max={999} value={count} aria-label={machine.label}
                  onInput={(e) => set({ machines: { ...prefs.machines, [machine.id]: num(e) } })}
                />
              </label>
            ))}
          </div>
          <p class="note">
            = {fmtInt(rate.perHour)} {item.action === 'Brew' ? 'brews' : 'items'} per hour. Defaults are Luma's job-block limits
            ({rate.machines.map((m) => `${m.machine.defaultCount} ${m.machine.label.toLowerCase()}`).join(', ')}; max {rate.machines.map((m) => m.machine.maxCount).join('/')}).
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '6px' }}>
          <label class="field">{rateNoun(item.action)} per hour
            <input
              type="number" inputMode="numeric" min={1} value={prefs.handRate} style={{ width: '140px' }}
              onInput={(e) => set({ handRate: num(e) })}
            />
          </label>
          <p class="note">
            Default {fmtInt(job.defaultRate)}/h is a guess for {job.rateNote}. Time yourself for a few minutes and put your own number in.
            {prefs.handRate !== job.defaultRate && (
              <> <button class="link-btn" onClick={() => set({ handRate: job.defaultRate })}>Reset</button></>
            )}
          </p>
        </div>
      )}

      <div class="hero">
        <span class="label">Time to reach level {to}</span>
        <span class="value">{heroTime(plan.totalHours)}</span>
        <span class="sub">{fmtDays(plan.totalHours / hoursPerDay)} at {hoursPerDay} h a day</span>
      </div>

      <div class="tiles">
        <div class="tile"><span class="label">{actionNoun(item.action)}</span><span class="value">{fmtCompact(plan.totalActions)}</span></div>
        <div class="tile"><span class="label">Money earned</span><span class="value">{fmtMoney(plan.totalMoney)}</span></div>
        <div class="tile"><span class="label">XP still needed</span><span class="value">{fmtCompact(plan.totalXp)}</span></div>
        <div class="tile"><span class="label">Next level ({from + 1}) in</span><span class="value">{heroTime(next.hours)}</span></div>
      </div>
      {item.dupe && (
        <p class="note flag">The server lists {item.item.replace(/ \(\d+\)$/, '')} more than once under {item.action} with different pay. Which entry applies isn't known.</p>
      )}
    </section>
  );
}
