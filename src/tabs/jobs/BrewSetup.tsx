import type { Job, JobItem } from '../../data/types';
import type { JobPrefs } from '../JobsTab';
import { Icon } from '../../components/Icon';
import { fmt2, fmtInt, fmtMoney } from '../../lib/format';
import {
  ingredientName, ingredientTier, materialOf, nextSteps, potionName, shortestChainTo, walkChain, WATER,
} from '../../lib/brewing';
import { brewTicks, catalysisSpeed, CONCOCTIONS_LEVELS, concoctionsTier, MCMMO_MAX_LEVEL } from '../../lib/mcmmo';
import { moneyAt, xpAt } from '../../lib/scaling';
import { MACHINES } from '../../lib/machines';

export interface ChainStepPaid {
  material: string;
  to: string;
  /** The Jobs Brew entry for this ingredient; null when Jobs doesn't pay for it (e.g. Slime Ball). */
  paid: JobItem | null;
}

export interface BrewChain {
  steps: ChainStepPaid[];
  /** Average level-1 base per brew across the chain, for the level planner. */
  xpBase: number;
  moneyBase: number;
}

/** The chain being planned: the saved one if it's still valid, else the shortest chain that uses `item`. */
export function resolveChain(job: Job, item: JobItem, saved: string[] | undefined): BrewChain | null {
  const materials = saved?.length && walkChain(saved).invalidAt === null ? saved : shortestChainTo(materialOf(item.item));
  if (!materials) return null;
  const brewItems = job.items.filter((i) => i.action === 'Brew');
  const steps = walkChain(materials).steps.map((s) => ({
    material: s.material, to: s.to, paid: brewItems.find((i) => materialOf(i.item) === s.material) ?? null,
  }));
  const mean = (f: (i: JobItem) => number) => steps.reduce((a, s) => a + (s.paid ? f(s.paid) : 0), 0) / steps.length;
  return { steps, xpBase: mean((i) => i.xpBase), moneyBase: mean((i) => i.moneyBase) };
}

const iconFor = (job: Job, material: string) =>
  job.items.find((i) => i.action === 'Brew' && materialOf(i.item) === material)?.icon ?? (material === 'SLIME_BALL' ? 'slime_ball' : null);
const potionIcon = (id: string) => (id.startsWith('SPLASH_') ? 'splash_potion' : id.startsWith('LINGERING_') ? 'lingering_potion' : 'potion');
const unlockLevel = (tier: number) => CONCOCTIONS_LEVELS[Math.min(tier, CONCOCTIONS_LEVELS.length) - 1];

interface Props {
  job: Job;
  chain: BrewChain;
  level: number;
  prefs: JobPrefs;
  perHour: number;
  set: (p: Partial<JobPrefs>) => void;
}

export function BrewSetup({ job, chain, level, prefs, perHour, set }: Props) {
  const stand = MACHINES.brewing_stand;
  const stands = Math.max(0, prefs.machines[stand.id] ?? stand.defaultCount);
  const alchemy = prefs.alchemyLevel;
  const speed = catalysisSpeed(alchemy);
  const ticks = brewTicks(speed);
  const tier = concoctionsTier(alchemy);
  const materials = chain.steps.map((s) => s.material);
  const last = chain.steps.length ? chain.steps[chain.steps.length - 1].to : WATER;
  const options = nextSteps(last);
  const locked = chain.steps.filter((s) => (ingredientTier(s.material) ?? 99) > tier);
  const perChain = chain.steps.reduce(
    (a, s) => ({ money: a.money + (s.paid ? moneyAt(s.paid.moneyBase, level) : 0), xp: a.xp + (s.paid ? xpAt(s.paid.xpBase, level) : 0) }),
    { money: 0, xp: 0 },
  );
  const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value);

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <span class="sub-label">Your brewing stands (always fed)</span>
      <div class="machines">
        <label class="machine">
          <Icon id={stand.id} size={24} />
          <span>{stand.label}</span>
          <input type="number" inputMode="numeric" min={0} max={999} value={stands} aria-label={stand.label}
            onInput={(e) => set({ machines: { ...prefs.machines, [stand.id]: num(e) } })} />
        </label>
        <label class="machine">
          <span>mcMMO Alchemy level</span>
          <input type="number" inputMode="numeric" min={0} max={MCMMO_MAX_LEVEL} value={alchemy} aria-label="mcMMO Alchemy level"
            style={{ width: '76px' }} onInput={(e) => set({ alchemyLevel: num(e) })} />
        </label>
      </div>
      <p class="note">
        Catalysis <b>{speed.toFixed(2)}x</b>: one brew every {fmt2(ticks / 20)} s, so {fmtInt(perHour)} brews per hour
        from {fmtInt(stands)} stand{stands === 1 ? '' : 's'}. Type <code>/alchemy</code> in game for your level;
        speed reaches 4x at {MCMMO_MAX_LEVEL}. Default {stand.defaultCount} stands is Luma's job-block limit (max {stand.maxCount}).
      </p>

      <span class="sub-label chain-head">
        Brewing chain, starting from a water bottle
        {prefs.brewChain.length > 0 && <button class="link-btn" onClick={() => set({ brewChain: [] })}>Start over</button>}
      </span>
      <ol class="chain">
        <li class="chain-row start">
          <Icon id="potion" size={24} />
          <span class="chain-text"><b>Water Bottle</b></span>
        </li>
        {chain.steps.map((s, i) => {
          const t = ingredientTier(s.material) ?? 99;
          const isLast = i === chain.steps.length - 1;
          return (
            <li key={i} class="chain-row">
              <Icon id={iconFor(job, s.material)} size={24} />
              <span class="chain-text">
                <b>+ {ingredientName(s.material)}</b>
                <small>
                  <Icon id={potionIcon(s.to)} size={14} /> {potionName(s.to)}
                  {t > tier && <span class="flag"> · needs Alchemy {fmtInt(unlockLevel(t))}</span>}
                </small>
              </span>
              <span class="chain-pay mono">
                {s.paid ? <>{fmtMoney(moneyAt(s.paid.moneyBase, level))}<small>{fmt2(xpAt(s.paid.xpBase, level))} XP</small></> : <small>no Jobs pay</small>}
              </span>
              {isLast && chain.steps.length > 1 ? (
                <button class="chain-remove" aria-label={`Remove ${ingredientName(s.material)}`} title="Remove this step"
                  onClick={() => set({ brewChain: materials.slice(0, -1) })}>×</button>
              ) : <span class="chain-remove" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
      {options.length > 0 ? (
        <label class="field">Add a step
          <select value="" onChange={(e) => {
            const m = (e.currentTarget as HTMLSelectElement).value;
            if (m) set({ brewChain: [...materials, m] });
          }}>
            <option value="">Choose the next ingredient…</option>
            {options.map((o) => {
              const t = ingredientTier(o.material) ?? 99;
              return (
                <option key={o.material} value={o.material}>
                  {ingredientName(o.material)} → {potionName(o.result)}{t > tier ? ` (Alchemy ${unlockLevel(t)}+)` : ''}
                </option>
              );
            })}
          </select>
        </label>
      ) : (
        <p class="note">{potionName(last)} can't be brewed any further.</p>
      )}
      <p class="note">
        Every step is one brew, and each brew pays for the ingredient you add. This chain is {chain.steps.length} brew{chain.steps.length === 1 ? '' : 's'}:{' '}
        <b>{fmtMoney(perChain.money)}</b> and <b>{fmt2(perChain.xp)} XP</b> per stand-load of 3 potions at level {level}, so the plan uses the average per brew.
      </p>
      {locked.length > 0 && (
        <p class="note flag">
          mcMMO won't brew {locked.map((s) => ingredientName(s.material)).join(', ')} until you have unlocked it
          (Concoctions rank {tier}/8 at Alchemy {fmtInt(alchemy)}). The stand just stops on that step.
        </p>
      )}
    </div>
  );
}
