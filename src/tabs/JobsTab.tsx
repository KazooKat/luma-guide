import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import jobsData from '../data/jobs.json';
import perksData from '../data/perks.json';
import type { Job, JobItem, JobsData, Perk } from '../data/types';
import { Icon } from '../components/Icon';
import { loadPref, savePref } from '../lib/route';
import { MAX_LEVEL, planLevels, req } from '../lib/scaling';
import { ItemTable } from './jobs/ItemTable';
import { Plan, resolveRate } from './jobs/Plan';
import { HoursChart, Milestones } from './jobs/HoursChart';
import { Perks } from './jobs/Perks';
import { resolveChain } from './jobs/BrewSetup';
import { materialOf, shortestChainTo } from '../lib/brewing';

const DATA = jobsData as JobsData;
const PERKS = (perksData as { perks: Record<string, Perk[]> }).perks;
const DEFAULT_JOB = 'cook';
const MCMMO_REF = 'e19e043';
const MCMMO_SRC = `https://github.com/LumaLibre/mcMMO/blob/${MCMMO_REF}`;

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

export function JobsTab({ jobSlug }: { jobSlug?: string }) {
  const job = DATA.jobs.find((j) => j.job.toLowerCase() === (jobSlug ?? DEFAULT_JOB)) ?? DATA.jobs.find((j) => j.job.toLowerCase() === DEFAULT_JOB)!;
  const gridRef = useRef<HTMLElement>(null);
  // On phones the job picker scrolls sideways; bring the current job into view.
  useEffect(() => {
    const grid = gridRef.current;
    const tile = grid?.querySelector<HTMLElement>('[aria-current="true"]');
    if (grid && tile && grid.scrollWidth > grid.clientWidth) {
      grid.scrollLeft = tile.offsetLeft - (grid.clientWidth - tile.offsetWidth) / 2;
    }
  }, [job.job]);
  return (
    <>
      <section class="intro">
        <h1>How long does each job take?</h1>
        <p>Pick a job, set your level, choose what you'll grind. Pay and XP scale with your level, so the time per level changes as you climb.</p>
      </section>
      <details class="card newbie">
        <summary>New to jobs? Start here</summary>
        <ul class="facts">
          <li><b>Jobs pay you for normal gameplay.</b> Each job has a list of actions, like placing blocks (Builder) or smelting food (Cook). Every action pays money and job XP. Type <code>/jobs browse</code> in game to see the list.</li>
          <li><b>Higher level, more pay per action.</b> But each level needs much more XP than the last, so levels slow down as you climb. <code>/jobs stats</code> shows your level and XP.</li>
          <li><b>Levels unlock perks:</b> chat tags, commands like <code>/feed</code> or <code>/top</code>, and warehouse upgrades. Each job's perks are listed below.</li>
          <li><b>Using this page:</b> pick a job, type in your level and XP from <code>/jobs stats</code>, then click the item you'll grind. The plan shows how long your goal takes.</li>
        </ul>
      </details>
      <nav class="job-grid" aria-label="Jobs" ref={gridRef}>
        {DATA.jobs.map((j) => (
          <a key={j.job} class="job-tile" href={`#/jobs/${j.job.toLowerCase()}`} aria-current={j.job === job.job ? 'true' : undefined}>
            <Icon id={j.icon} size={32} />
            <span class="job-text">
              <b>{j.job}</b>
              <span class="job-meta">{j.level ? `Lvl ${j.level} data · ${j.items.length} items` : 'No data yet'}</span>
            </span>
          </a>
        ))}
      </nav>
      <JobView key={job.job} job={job} />
    </>
  );
}

function clampInt(v: number, lo: number, hi: number) {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : lo;
}

function JobView({ job }: { job: Job }) {
  const defaults: JobPrefs = {
    from: 1, xpInto: 0, to: MAX_LEVEL, hoursPerDay: 4,
    itemKey: job.defaultItem ?? (job.items[0] ? itemKey(job.items[0]) : ''),
    handRate: job.defaultRate, machines: {},
    alchemyLevel: 0, brewChain: [], fishingLevel: 0, lure: 3, raining: false, boat: false, handlingSeconds: 1.5,
  };
  const [prefs, setPrefs] = useState<JobPrefs>(() => loadPref(`job:${job.job}`, defaults));
  useEffect(() => savePref(`job:${job.job}`, prefs), [prefs]);
  const set = (patch: Partial<JobPrefs>) => setPrefs((p) => ({ ...p, ...patch }));

  // Keep inputs in range without fighting the user while they type.
  const from = clampInt(prefs.from, 1, MAX_LEVEL - 1);
  const to = clampInt(prefs.to, from + 1, MAX_LEVEL);
  const xpInto = clampInt(prefs.xpInto, 0, req(from) - 1);
  const hoursPerDay = Math.min(24, Math.max(0.25, Number(prefs.hoursPerDay) || 4));
  const item = useMemo(() => job.items.find((i) => itemKey(i) === prefs.itemKey) ?? job.items[0], [job, prefs.itemKey]);
  const rate = item ? resolveRate(job, item, prefs) : null;
  // Brewing plans a whole chain: each brew pays for its own ingredient, so use the chain's average per brew.
  const chain = useMemo(() => (item?.action === 'Brew' ? resolveChain(job, item, prefs.brewChain) : null), [job, item, prefs.brewChain]);
  const basis = chain ?? item;
  const plan = useMemo(
    () => (basis && rate ? planLevels({ xpBase: basis.xpBase, moneyBase: basis.moneyBase, from, to, xpInto, actionsPerHour: rate.perHour }) : null),
    [basis, rate?.perHour, from, to, xpInto],
  );
  const selectItem = (key: string) => {
    const picked = job.items.find((i) => itemKey(i) === key);
    set({ itemKey: key, brewChain: picked?.action === 'Brew' ? shortestChainTo(materialOf(picked.item)) ?? [] : prefs.brewChain });
  };

  if (!job.items.length || !item || !rate || !plan) {
    return <section class="card"><p>No pay data for {job.job} yet.</p></section>;
  }

  const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value.replace(/,/g, ''));
  return (
    <>
      <section class="card">
        <div class="job-head">
          <div class="job-name">
            <Icon id={job.icon} size={48} />
            <div>
              <h2>{job.job}</h2>
              <div class="badges">
                {job.confidence === 'confirmed' ? (
                  <span class="badge good" title="Scaling for this job was checked against in-game readings at several levels.">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
                    Scaling confirmed
                  </span>
                ) : (
                  <span class="badge warn" title="Uses the shared Luma scaling formulas; not yet checked at a second level for this job.">Scaling assumed</span>
                )}
                <span class="badge">Read at level {job.level}</span>
              </div>
            </div>
          </div>
          <div class="controls">
            <label class="field">Your level
              <input type="number" inputMode="numeric" min={1} max={MAX_LEVEL - 1} value={prefs.from} onInput={(e) => set({ from: num(e) })} />
            </label>
            <label class="field">XP into level
              <input type="number" inputMode="numeric" min={0} value={prefs.xpInto} onInput={(e) => set({ xpInto: num(e) })} />
            </label>
            <label class="field">Target level
              <input type="number" inputMode="numeric" min={2} max={MAX_LEVEL} value={prefs.to} onInput={(e) => set({ to: num(e) })} />
            </label>
            <label class="field">Hours / day
              <input type="number" inputMode="decimal" min={0.25} max={24} step={0.5} value={prefs.hoursPerDay} onInput={(e) => set({ hoursPerDay: num(e) })} />
            </label>
          </div>
        </div>
      </section>

      <div class="job-layout">
        <ItemTable job={job} level={from} selectedKey={itemKey(item)} onSelect={selectItem} />
        <div class="plan-col">
          <Plan job={job} item={item} chain={chain} from={from} to={to} hoursPerDay={hoursPerDay} rate={rate} plan={plan} prefs={prefs} set={set} />
        </div>
      </div>

      <HoursChart plan={plan} label={chain && chain.steps.length > 1 ? `A ${chain.steps.length}-brew chain` : item.item} perHour={rate.perHour} />

      <div class="pair">
        <Milestones plan={plan} from={from} hoursPerDay={hoursPerDay} />
        <Perks job={job.job} perks={PERKS[job.job] ?? []} level={from} />
      </div>

      <section class="card">
        <div class="card-title"><h3>How these numbers work</h3></div>
        <div class="explain">
          <p>
            XP for the next level is <code>4.29·L³ + 0.3002·L² − 0.095</code>, rounded. That is within 1 XP of all 14 <code>/jobs stats</code> readings we have.
            XP per action grows with <code>(L + 5)</code> and money with <code>(L + 9)</code>, so the {job.job} values above were read at level {job.level} and projected to yours.
          </p>
          <p>
            The server's Jobs config isn't public, so these formulas are fitted from in-game readings. Game values are rounded to 2 decimals, so projections can be off by about half a percent.
            Rank multipliers, boosts, events and payment caps aren't included. Machine rates assume vanilla timings and machines that never sit idle.
          </p>
          {job.job === 'Alchemist' && (
            <p>
              Brewing speed and ingredients come from Luma's mcMMO (<a href={`${MCMMO_SRC}/src/main/resources/potions.yml`} target="_blank" rel="noopener noreferrer">LumaLibre/mcMMO @ {MCMMO_REF}</a>).
              Catalysis speeds up every brewing stand you own from 1x at Alchemy 0 to 4x at 1000, matching <code>/alchemy</code> in game.
              Jobs pays once per finished brew for the ingredient in it, so a chain pays for every step. Red Mushroom is on the Jobs list, but no mcMMO recipe uses it.
            </p>
          )}
          {job.job === 'Fisherman' && (
            <p>
              Catch speed follows vanilla fishing plus Luma's mcMMO (<a href={`${MCMMO_SRC}/src/main/java/com/gmail/nossr50/skills/fishing/FishingManager.java`} target="_blank" rel="noopener noreferrer">LumaLibre/mcMMO @ {MCMMO_REF}</a>):
              Master Angler shortens the wait by 0.5 s (minimum) and 1.5 s (maximum) per rank, and Lure takes 5 s per level off the maximum.
              In a boat, Master Angler takes another 0.5 s and 1.5 s off. The reel + recast time is a guess; time a few catches and adjust it. Fishing under a roof isn't modelled.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
