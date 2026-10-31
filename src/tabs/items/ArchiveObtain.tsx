import { ARCHIVE_ODDS, archiveChance, expectedRerollCost, REROLL } from '../../lib/archives';
import { fmtMoney } from '../../lib/format';
import { makeNotes, Sources, type SourceRepo } from './Writeup';

/** The Christmas 2025 event code (luma-events, christmas branch), where presents and the re-roll station live. */
const CHRISTMAS_REF = '465b8be';
const CHRISTMAS_REPO: SourceRepo = { url: 'https://github.com/LumaLibre/luma-events', path: 'src/main/java/dev/jsinco/luma/lumaevents' };

const pct = (p: number) => `${Math.round(p * 100)}%`;
const higher = (level: number) => ARCHIVE_ODDS.filter((o) => o.percent > level).reduce((a, o) => a + archiveChance(o.percent), 0);
const ODDS_MAX = Math.max(...ARCHIVE_ODDS.map((o) => archiveChance(o.percent)));

function Bar({ p, max }: { p: number; max: number }) {
  return <span class="odds-bar" aria-hidden="true"><i style={{ width: `${Math.max(2, (p / max) * 100)}%` }} /></span>;
}

/** How Archive of Astralis books were handed out and re-rolled, shown under the write-up on each book's page. */
export function ArchiveObtain({ job }: { job: string }) {
  const notes = makeNotes('ar');
  return (
    <section class="card detail-card" aria-labelledby="archive-get">
      <h2 id="archive-get" class="detail-h2">How to get one</h2>
      <div class="wu-block">
        <h3>Christmas 2025 presents</h3>
        <ul class="wu-bullets">
          <li><span>
            Finishing all 5 Christmas challenges (play 15 minigames, complete the parkour, find every pudding on the map, bring
            Frosty the items he asks for, and have 24 hours of non-AFK playtime on Luma) let you claim one Wrapped Present, once
            per player.{notes.cite('archives/ChallengeType.java:16-54, obj/EventPlayer.java:215-233')}
          </span></li>
          <li><span>
            Opening the present gave a book for a random job, with every job equally likely, and a random % from the odds
            below.{notes.cite('items/PresentItem.kt:57-78, archives/ArchivePercentChance.kt:6-29')}
          </span></li>
        </ul>
        <div class="odds-table" role="table" aria-label="Book % odds">
          <div class="odds-row head" role="row">
            <span role="columnheader">Book</span><span role="columnheader">Chance</span><span role="columnheader" class="r">Boost</span>
          </div>
          {ARCHIVE_ODDS.map(({ percent }) => (
            <div class="odds-row" role="row" key={percent}>
              <span role="cell"><b>{percent}% book</b></span>
              <span role="cell" class="odds-cell"><Bar p={archiveChance(percent)} max={ODDS_MAX} /><span class="mono">{pct(archiveChance(percent))}</span></span>
              <span role="cell" class="r mono muted">×{(1 + percent / 100).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div class="wu-block">
        <h3>Christmas 2025 re-roll station</h3>
        <ul class="wu-bullets">
          <li><span>
            The Archive Re-Rolling Station re-rolled a book's % for in-game money: {fmtMoney(REROLL.base)} for the first roll,
            then {fmtMoney(REROLL.step)} more for each roll already on that book, up to {fmtMoney(REROLL.max)} a roll.
            {notes.cite('archives/guis/ArchiveReRollGui.kt:33-35, archives/guis/ArchiveReRollGui.kt:95-102')}
          </span></li>
          <li><span>
            It keeps the book's job and can only go up. If the new roll isn't higher, you keep your book and lose the money. A 5%
            book can't be re-rolled.{notes.cite('archives/guis/ArchiveReRollGui.kt:116-139')}
          </span></li>
          <li><span>
            A higher roll gives you a fresh book with 1 roll on it, so the next roll costs {fmtMoney(REROLL.base + REROLL.step)} again.
            {notes.cite('archives/guis/ArchiveReRollGui.kt:132-135')}
          </span></li>
          <li><span>
            Books from Winter 2024 (with "Winter 2024" in the tooltip) were turned away.
            {notes.cite('archives/guis/ArchiveReRollGui.kt:111-114, archives/guis/ArchiveReRollGui.kt:178-188')}
          </span></li>
        </ul>
        <div class="odds-table" role="table" aria-label="Re-roll cost to 5%">
          <div class="odds-row reroll-row head" role="row">
            <span role="columnheader">Starting book</span><span role="columnheader">Higher % per roll</span><span role="columnheader" class="r">Avg to 5%</span>
          </div>
          {[2, 3, 4].map((from) => (
            <div class="odds-row reroll-row" role="row" key={from}>
              <span role="cell"><b>{from}% book</b></span>
              <span role="cell" class="odds-cell"><Bar p={higher(from)} max={1} /><span class="mono">{pct(higher(from))}</span></span>
              <span role="cell" class="r mono">{fmtMoney(expectedRerollCost(from, 5))}</span>
            </div>
          ))}
        </div>
        <p class="note">
          Averages are worked out from the costs and odds above, for a book that hasn't been re-rolled yet. The code doesn't say
          whether the station is still open after Christmas 2025.
        </p>
      </div>

      <p class="note">
        Got some books? <a href={`#/jobs/${job}`}>Add them to the {job[0].toUpperCase() + job.slice(1)} calculator</a> to see how much
        faster you level.
      </p>
      <Sources notes={notes} commit={CHRISTMAS_REF} repo={CHRISTMAS_REPO} />
      <p class="note">
        Source: <a href={`${CHRISTMAS_REPO.url}/tree/${CHRISTMAS_REF}`} target="_blank" rel="noopener noreferrer">LumaLibre/luma-events @ {CHRISTMAS_REF}</a> (Christmas 2025 event code).
      </p>
    </section>
  );
}
