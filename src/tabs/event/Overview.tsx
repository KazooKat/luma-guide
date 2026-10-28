import { Fragment } from 'preact';
import { AtlasIcon } from '../../components/AtlasIcon';
import { BY_ID } from '../items/common';
import { plain } from '../../lib/minimessage';
import { CandyTable } from './Candy';
import { EVENT, GAME_COUNT, META, possessive, Src, VISIBLE_GAMES } from './common';

const COMMAND_TEXT: Record<string, string> = {
  join: 'Join the minigame that is starting (or click the announcement in chat).',
  quit: 'Leave the minigame you are in.',
  next: 'How long until the next automatic minigame, and which one it is.',
  claim: 'Claim the event charm, once you have played at least 1 minigame.',
  formula: 'Listed as a player command, but it does nothing yet: the command is empty in the code.',
};

/** Whether a YYYY-MM-DD date has come, in UTC like fmtDate. */
const started = (d: string) => new Date(`${d}T00:00:00Z`).getTime() <= Date.now();

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function Overview() {
  const s = EVENT.schedule;
  const charmId = META.charmItemId ?? EVENT.charm.itemId;
  const charm = BY_ID.get(charmId);
  const start = fmtDate(META.dates.start);
  const end = fmtDate(META.dates.end);
  const tot = META.trickOrTreat;
  return (
    <>
      <section class="card" aria-label="When">
        <div class="card-title"><h3>When</h3></div>
        <p class="explain-line">
          {start && end ? <>From <b>{start}</b> to <b>{end}</b>.</>
            : start ? <>{started(META.dates.start!) ? 'Started' : 'Starts'} <b>{start}</b>.</> : <>Dates haven't been announced yet.</>}
          {META.dates.note && <> {META.dates.note}</>}
        </p>
      </section>

      {tot && (
        <section class="card" aria-label="Trick or treating">
          <div class="card-title"><h3>Trick or treating</h3><span>{tot.readOn ? `read in game on ${fmtDate(tot.readOn)}` : 'read in game'}</span></div>
          <p class="explain-line">
            Trick or treating gives you {tot.reward}. After that you have to wait <b>{tot.cooldownHours} hours</b> before you can trick or treat again.
          </p>
          {EVENT.candy && <CandyTable candy={EVENT.candy} />}
        </section>
      )}

      <section class="card" aria-label="How it works">
        <div class="card-title"><h3>How the event works</h3></div>
        <ol class="wu-steps">
          <li><span class="step-num" aria-hidden="true">1</span><span>
            {META.command ? <>Use <code>/{META.command}</code> to get started, as the event's announcement says.</>
              : <>Use <code>/{EVENT.commands.root}</code> to go to the event area. <Src src="commands/CommandManager.java:27-40">source</Src></>}
          </span></li>
          <li><span class="step-num" aria-hidden="true">2</span><span>
            Minigames start on their own, by default every <b>{s.cooldownMinutes / 60} hours</b>, going through the event's games in a fixed order.
            {' '}A <b>{s.countdownSeconds} second</b> countdown is announced in chat first: click it or type <code>/{EVENT.commands.root} join</code>.
            {' '}<Src src={s.cooldownSrc}>source</Src>
          </span></li>
          <li><span class="step-num" aria-hidden="true">3</span><span>
            How well you do turns into event tokens, using each game's own formula.
            {' '}See <a href="#/event/minigames">Minigames</a> ({GAME_COUNT} game{GAME_COUNT === 1 ? '' : 's'}){VISIBLE_GAMES.length ? ' for how each one plays and pays' : ''}.
          </span></li>
          <li><span class="step-num" aria-hidden="true">4</span><span>
            You can also get tokens from jobs and from inviting new players to your town. <a href="#/event/tokens">Tokens</a> has the odds.
          </span></li>
          <li><span class="step-num" aria-hidden="true">5</span><span>
            Spend tokens on event items in the <a href="#/event/shop">Shop</a>.
          </span></li>
        </ol>
        <p class="note">
          The 2 hour gap and the order are the plugin's defaults; staff can change them, and can also start games by hand.
          {' '}<code>/{EVENT.commands.root} next</code> tells you what's coming up.
        </p>
      </section>

      <div class="pair">
        <section class="card" aria-label="Commands">
          <div class="card-title"><h3>Commands</h3><span><Src src={EVENT.commands.src}>source</Src></span></div>
          <div class="kv cmds">
            {EVENT.commands.player.map((c) => (
              <Fragment key={c.name}>
                <dt><code>/{EVENT.commands.root} {c.usage}</code></dt>
                <dd>{COMMAND_TEXT[c.name] ?? ''}</dd>
              </Fragment>
            ))}
          </div>
          {EVENT.commands.aliases.length > 0 && (
            <p class="note">
              In {META.sourceEvent}, <code>/{EVENT.commands.root}</code> also worked as {EVENT.commands.aliases.map((a, i) => <Fragment key={a}>{i > 0 && ', '}<code>/{a}</code></Fragment>)}.
              Each event usually gets its own aliases.
              {META.command && <> For {META.name}, <code>/{META.command}</code> should work in place of <code>/{EVENT.commands.root}</code> in all of these.</>}
            </p>
          )}
        </section>

        <section class="card" aria-label="Event charm">
          <div class="card-title"><h3>Event charm</h3><span><Src src={EVENT.charm.requirementSrc}>source</Src></span></div>
          <p class="explain-line">
            Play at least <b>1 minigame</b>, then use <code>/{EVENT.commands.root} claim</code> to get the event's charm. One per player.
          </p>
          {charm && (
            <a class="selected-item charm-link" href={`#/items/${charm.id}`}>
              <AtlasIcon id={charm.icon} size={32} glint={charm.glint} />
              <span><b>{plain(charm.name)}</b><span>{META.charmItemId ? 'This event' : `${possessive(META.sourceEvent)} charm, as an example`}</span></span>
            </a>
          )}
        </section>
      </div>

      <section class="card" aria-label="Special rounds">
        <div class="card-title"><h3>Special rounds</h3><span><Src src="games/MinigameManager.java:86-93">source</Src></span></div>
        <p class="explain-line">When staff start a game by hand, they can change how it pays. The start announcement says which:</p>
        <ul class="facts plain">
          <li><b>"Pays out X% more (or fewer) tokens than usual"</b>: your normal result is multiplied, then rounded.</li>
          <li><b>"Casual"</b>: everyone who takes part gets the same number of tokens, whatever their score.</li>
          <li><b>"Just for fun"</b>: no tokens at all.</li>
        </ul>
      </section>
    </>
  );
}
