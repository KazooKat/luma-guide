import { useState } from 'preact/hooks';
import { Icon } from '../../components/Icon';
import { McLine } from '../../components/McTooltip';
import jobsData from '../../data/jobs.json';
import { actionsForChance, deliver, jobTokenChance } from '../../lib/event';
import { fmtInt } from '../../lib/format';
import { EVENT, META, Src, VISIBLE_GAMES } from './common';

const JOB_ICON = new Map(jobsData.jobs.map((j) => [j.job, j.icon]));

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
  const rows = jobs.list
    .map((j) => ({ ...j, p: jobTokenChance(j.chance, jobs.bound, treeFeller && j.job === 'Lumberjack' ? jobs.treeFellerFactor : 1) }))
    .sort((a, b) => b.p - a.p);
  const max = rows[0].p;
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
            <p>at best, per paid job action ({rows[0].job}). Every other job is far lower. <Src src={jobs.rollSrc}>source</Src></p>
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
          Each time a job pays you, there's a small chance of a token on top. These are the same actions the{' '}
          <a href="#/jobs">Jobs calculator</a> counts, so you can use it to see how many actions an hour you get.
        </p>
        <div class="chips" role="group" aria-label="Lumberjack mode">
          <button class="chip" aria-pressed={!treeFeller} onClick={() => setTreeFeller(false)}>Normal</button>
          <button class="chip" aria-pressed={treeFeller} onClick={() => setTreeFeller(true)}>Lumberjack in Tree Feller</button>
        </div>
        <div class="odds-table" role="table" aria-label="Token odds per job">
          <div class="odds-row head job-odds" role="row">
            <span role="columnheader">Job</span><span role="columnheader">Per action</span>
            <span role="columnheader" class="r">Average</span><span role="columnheader" class="r">90% sure by</span>
          </div>
          {rows.map((j) => (
            <div class="odds-row job-odds" role="row" key={j.job}>
              <span role="cell" class="item-name"><Icon id={JOB_ICON.get(j.job)} size={24} /><span><b>{j.job}</b></span></span>
              <span role="cell" class="odds-cell">
                <span class="odds-bar" aria-hidden="true"><i style={{ width: `${Math.max(2, (j.p / max) * 100)}%` }} /></span>
                <span class="mono">{pct(j.p)}</span>
              </span>
              <span role="cell" class="r mono muted">1 in {fmtInt(Math.round(1 / j.p))}</span>
              <span role="cell" class="r mono muted">{fmtInt(actionsForChance(j.p, 0.9))}</span>
            </div>
          ))}
        </div>
        <p class="note">
          The roll is {'"'}a random number below {fmtInt(jobs.bound)} is under the job's number{'"'}, so Fisherman's {jobs.list.find((j) => j.job === 'Fisherman')?.chance} works out
          to {pct(jobTokenChance(jobs.list.find((j) => j.job === 'Fisherman')?.chance ?? 0, jobs.bound))}. While Tree Feller is active, Lumberjack's odds are divided by {jobs.treeFellerFactor}
          {' '}(<Src src={jobs.treeFellerSrc}>source</Src>), and blocks broken by TNT never roll (<Src src={jobs.tntSrc}>source</Src>).
          {' '}"90% sure by" is how many actions it takes to have a 90% chance of at least 1 token.
        </p>
      </section>

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
