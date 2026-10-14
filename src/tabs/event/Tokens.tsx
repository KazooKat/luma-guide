import { useMemo, useState } from 'preact/hooks';
import { Icon } from '../../components/Icon';
import { McLine } from '../../components/McTooltip';
import { deliver, jobTokenChance } from '../../lib/event';
import { fmt2, fmtCompact, fmtHours, fmtInt } from '../../lib/format';
import { MACHINES } from '../../lib/machines';
import { MCMMO_MAX_LEVEL } from '../../lib/mcmmo';
import { loadJobPrefs, saveJobPrefs, type JobPrefs } from '../jobs/prefs';
import { AlchemyChart } from './AlchemyChart';
import { CALC_JOBS, calcJob, jobTokenRow, type JobTokenRow } from './jobTokens';
import { EVENT, META, Src, VISIBLE_GAMES } from './common';

const alchJob = calcJob('Alchemist');
const STANDS_DEFAULT = MACHINES.brewing_stand.defaultCount;
const STANDS_MAX = MACHINES.brewing_stand.maxCount;
const num = (e: Event, lo: number, hi: number) => {
  const v = Math.round(Number((e.currentTarget as HTMLInputElement).value));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
};

/** 0.0040444 -> "0.40%", 0.0000667 -> "0.0067%" */
function pct(p: number): string {
  const v = p * 100;
  if (v >= 1) return `${v.toFixed(1)}%`;
  if (v >= 0.1) return `${v.toFixed(2)}%`;
  return `${v.toPrecision(2)}%`;
}

export function Tokens() {
  const { jobs, townInvite: town, tokens } = EVENT;
  const [treeFeller, setTreeFeller] = useState(false);
  // The Alchemist's calculator settings are edited right here (Alchemy level, stands) and saved back for the Jobs tab.
  const [alchPrefs, setAlchPrefs] = useState(() => (alchJob ? loadJobPrefs(alchJob) : null)!);
  const setAlch = (patch: Partial<JobPrefs>) => setAlchPrefs((p) => { const next = { ...p, ...patch }; if (alchJob) saveJobPrefs(alchJob, next); return next; });
  const otherPrefs = useMemo(() => new Map(CALC_JOBS.map((j) => [j.job, loadJobPrefs(j)])), []);
  const rows = jobs.list
    .map((j) => jobTokenRow(j.job, j.chance, jobs.bound, treeFeller && j.job === 'Lumberjack' ? jobs.treeFellerFactor : 1,
      j.job === 'Alchemist' && alchPrefs ? alchPrefs : otherPrefs.get(j.job)!))
    .filter((r): r is JobTokenRow => r !== null)
    .sort((a, b) => b.tokensPerHour - a.tokensPerHour);
  const best = rows[0];
  const topRate = best.tokensPerHour || 1;
  const byChance = rows.reduce((a, b) => (b.p > a.p ? b : a));
  const alch = rows.find((r) => r.job === 'Alchemist');
  const bestOther = rows.find((r) => r.job !== 'Alchemist') ?? null;
  const second = best === alch ? rows[1] : alch;
  const alchStands = alchPrefs ? Math.max(0, alchPrefs.machines.brewing_stand ?? STANDS_DEFAULT) : 0;
  const max = byChance.p;
  const capEx = deliver(15, 2, tokens.cap.value);
  const tokenType = tokens.types[0];

  return (
    <>
      <section class="card" aria-label="Where tokens come from">
        <div class="card-title">
          <h3>Where tokens come from</h3>
          {META.token.name ? <span>this event's token: <b>{META.token.name}</b></span>
            : tokenType && <span>{META.sourceEvent}'s token was <span class="tier-chip mc"><McLine mini={tokenType.name} /></span></span>}
        </div>
        <div class="source-grid">
          <div class="source">
            <div class="source-head"><Icon id="target" size={32} /><h4>Minigames</h4></div>
            <p>The main source. Each game turns your score into tokens with its own formula, listed below.</p>
          </div>
          <div class="source">
            <div class="source-head"><Icon id="fishing_rod" size={32} /><h4>Jobs</h4></div>
            <p class="big-odds">{pct(max)}</p>
            <p>at best, per paid job action ({byChance.job}). Per hour, {best.job} leads with your setups at about {fmt2(best.tokensPerHour)}. <Src src={jobs.rollSrc}>source</Src></p>
          </div>
          <div class="source">
            <div class="source-head"><Icon id="bell" size={32} /><h4>Town invites</h4></div>
            <p class="big-odds">{town.rewardMin}–{town.rewardMax}</p>
            <p>tokens when a new player you invited joins your town. <Src src={town.src}>source</Src></p>
          </div>
        </div>
        <p class="note">
          Job and town invite tokens only happen when staff switch them on for the event (both are off in the plugin's defaults:
          {' '}<Src src={jobs.onSrc}>jobs</Src>, <Src src={town.onSrc}>town invites</Src>).
        </p>
      </section>

      <section class="card" aria-label="Minigame payouts">
        <div class="card-title"><h3>What each minigame pays</h3><span>open a game for the full breakdown</span></div>
        <div class="odds-table" role="table" aria-label="Minigame token formulas">
          <div class="odds-row head mg-row" role="row">
            <span role="columnheader">Game</span><span role="columnheader">Tokens</span><span role="columnheader" class="r">Code</span>
          </div>
          {VISIBLE_GAMES.map((g) => (
            <div class="odds-row mg-row" role="row" key={g.key}>
              <span role="cell"><a href={`#/event/minigames/${g.key}`}><b>{g.name}</b></a></span>
              <span role="cell" class="soft">{g.guide?.tokenLine ?? 'See the game\'s page'}</span>
              <span role="cell" class="r"><Src src={g.formula.src}>formula</Src></span>
            </div>
          ))}
        </div>
      </section>

      <section class="card" aria-label="Job odds">
        <div class="card-title">
          <h3>Job token odds</h3>
          <span>{jobs.tokensPerDrop} token per drop, rolled on every paid job action</span>
        </div>
        <p class="explain-line">
          Each time a job pays you, there's a small chance of a token on top. The hourly numbers use each job's setup from the{' '}
          <a href="#/jobs">Jobs calculator</a> (your saved one, or its defaults), so faster setups earn more tokens.
        </p>
        <div class="tok-tiles">
          <a class="tok-tile hero" href={`#/jobs/${best.job.toLowerCase()}`}>
            <span class="tok-label">Most tokens an hour with your setups</span>
            <span class="tok-job"><Icon id={best.icon} size={32} /><b>{best.job}</b></span>
            <span class="tok-big">{fmt2(best.tokensPerHour)}<small> tokens / hour</small></span>
            <span class="tok-sub">about 1 every {fmtHours(best.hoursPerToken)} · {fmtInt(best.actionsPerHour)} {best.unit}/h</span>
          </a>
          {/* The Alchemist (the one the controls below change), or the runner-up once the Alchemist is already the best. */}
          {second && (
            <a class="tok-tile" href={`#/jobs/${second.job.toLowerCase()}`}>
              <span class="tok-label">{second === alch ? `Alchemist at Alchemy ${alchPrefs.alchemyLevel}` : 'Next best an hour'}</span>
              <span class="tok-job"><Icon id={second.icon} size={32} /><b>{fmt2(second.tokensPerHour)}</b><small>{second === alch ? 'tokens / hour' : `${second.job}, tokens / hour`}</small></span>
              <span class="tok-sub">{fmtInt(second.actionsPerHour)} {second.unit}/h · {second.basis}</span>
            </a>
          )}
          <div class="tok-tile">
            <span class="tok-label">Best odds per action</span>
            <span class="tok-job"><Icon id={byChance.icon} size={32} /><b>{pct(byChance.p)}</b><small>{byChance.job}</small></span>
            <span class="tok-sub">1 in {fmtInt(Math.round(1 / byChance.p))} {byChance.unit}</span>
          </div>
        </div>
        <div class="tok-controls">
          <div class="chips" role="group" aria-label="Lumberjack mode">
            <button class="chip" aria-pressed={!treeFeller} onClick={() => setTreeFeller(false)}>Normal</button>
            <button class="chip" aria-pressed={treeFeller} onClick={() => setTreeFeller(true)}>Lumberjack in Tree Feller</button>
          </div>
          {alchJob && (
            <>
              <label class="field range-field">mcMMO Alchemy level <b>{alchPrefs.alchemyLevel}</b>
                <input type="range" min={0} max={MCMMO_MAX_LEVEL} step={1} value={alchPrefs.alchemyLevel}
                  onInput={(e) => setAlch({ alchemyLevel: num(e, 0, MCMMO_MAX_LEVEL) })} />
              </label>
              <label class="field">Brewing stands
                <input type="number" inputMode="numeric" min={0} max={STANDS_MAX} value={alchStands}
                  onInput={(e) => setAlch({ machines: { ...alchPrefs.machines, brewing_stand: num(e, 0, STANDS_MAX) } })} />
              </label>
            </>
          )}
        </div>
        <div class="odds-table" role="table" aria-label="Token odds per job">
          <div class="odds-row head job-hour" role="row">
            <span role="columnheader">Job and setup</span><span role="columnheader">Tokens per hour</span>
            <span role="columnheader" class="r">Per action</span><span role="columnheader" class="r">90% sure by</span>
          </div>
          {rows.map((j) => (
            <div class={`odds-row job-hour${j === best ? ' top' : ''}`} role="row" key={j.job}>
              <span role="cell" class="item-name">
                <Icon id={j.icon} size={28} />
                <span class="job-cell">
                  <b>{j.job}</b>
                  <a class="basis" href={`#/jobs/${j.job.toLowerCase()}`}>{fmtInt(j.actionsPerHour)} {j.unit}/h · {j.basis}</a>
                </span>
              </span>
              <span role="cell" class="hour-cell">
                <span class="hour-bar" aria-hidden="true"><i style={{ width: `${Math.max(1.5, (j.tokensPerHour / topRate) * 100)}%` }} /></span>
                <span class="hour-val"><b>{fmt2(j.tokensPerHour)}</b><small>1 every {fmtHours(j.hoursPerToken)}</small></span>
              </span>
              <span role="cell" class="r mono muted">{pct(j.p)}<small class="block">1 in {fmtInt(Math.round(1 / j.p))}</small></span>
              <span role="cell" class="r mono muted">{fmtHours(j.hours90)}<small class="block">{fmtCompact(j.actions90)} {j.unit}</small></span>
            </div>
          ))}
        </div>
        <p class="note">
          The roll is {'"'}a random number below {fmtInt(jobs.bound)} is under the job's number{'"'}, so Fisherman's {jobs.list.find((j) => j.job === 'Fisherman')?.chance} works out
          to {pct(jobTokenChance(jobs.list.find((j) => j.job === 'Fisherman')?.chance ?? 0, jobs.bound))} a catch. While Tree Feller is active, Lumberjack's odds are divided by {jobs.treeFellerFactor}
          {' '}(<Src src={jobs.treeFellerSrc}>source</Src>), and blocks broken by TNT never roll (<Src src={jobs.tntSrc}>source</Src>). Tree Feller's faster chopping isn't counted, only its lower odds.
          {' '}"90% sure by" is how long it takes to have a 90% chance of at least 1 token. Brewing stands and furnaces pay their owner, and only while you're online and near them.
        </p>
      </section>

      {alchJob && alch && (
        <section class="card" aria-label="Alchemy level and tokens per hour">
          <div class="card-title">
            <h3>Alchemy level and tokens per hour</h3>
            <span>mcMMO Catalysis brews faster, and every brew is a paid action that rolls</span>
          </div>
          <AlchemyChart p={alch.p} stands={alchStands} level={alchPrefs.alchemyLevel} onLevel={(l) => setAlch({ alchemyLevel: l })}
            other={bestOther ? { job: bestOther.job, tokensPerHour: bestOther.tokensPerHour } : null} />
        </section>
      )}

      <div class="pair">
        <section class="card" aria-label="Town invites">
          <div class="card-title"><h3>Town invite tokens</h3><span><Src src={town.src}>source</Src></span></div>
          <ul class="facts plain">
            <li>You get <b>{town.rewardMin} to {town.rewardMax}</b> tokens (random) when a player joins your town <b>from your invite</b>.</li>
            <li>They need between <b>{town.minPlaytimeMinutes} minutes</b> and <b>{town.maxPlaytimeHours} hours</b> of total playtime on the server.</li>
            <li>Each player only counts once, ever. Joining with under {town.minPlaytimeMinutes} minutes of playtime, or joining an open town without an invite, uses up their one chance and pays nothing.</li>
            <li>You have to be online when they join.</li>
            <li>After a reward, you wait <b>{town.cooldownMinutes} minutes</b> before the next invite can pay you.</li>
          </ul>
        </section>

        <section class="card" aria-label="How payouts are counted">
          <div class="card-title"><h3>How a payout is counted</h3><span><Src src={tokens.cap.src}>source</Src></span></div>
          <ol class="wu-plain-steps">
            <li>The game's formula gives a number of tokens (or the job or invite does).</li>
            <li>If staff started the game as a special round, that changes it (see the <a href="#/event">Overview</a>).</li>
            <li>The server-wide token multiplier is applied and rounded up. By default it's {tokens.multiplier.default}x.</li>
            <li>You get at most <b>{tokens.cap.value}</b> tokens from one payout.</li>
          </ol>
          <p class="note">
            The chat message shows the number before the {tokens.cap.value} cap, so during a 2x multiplier a 15 token result says
            {' '}"You got {capEx.shown}" but gives you {capEx.given} (<Src src={tokens.cap.messageSrc}>source</Src>).
          </p>
        </section>
      </div>
    </>
  );
}
