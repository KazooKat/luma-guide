import type { JSX } from 'preact';
import type { EventMinigame, WriteupLine } from '../../data/types';
import { makeNotes, Sources } from '../items/Writeup';
import { EVENT, EVENTS_REPO, GAME_COUNT, isActive, NEW_GAMES, PREVIEW, Src, VISIBLE_GAMES } from './common';
import { SCENES } from './storyboard/scenes';
import { StoryboardPlayer } from './storyboard/Storyboard';
import { SkyWarsLoot } from './SkyWarsLoot';
import { CopycatRounds, Manor2Payouts } from './GameTables';

function Badge({ g }: { g: EventMinigame }) {
  if (isActive(g)) return <span class="badge good">In this event</span>;
  return PREVIEW ? <span class="badge">Not confirmed</span> : null;
}

export function MinigameList() {
  if (!GAME_COUNT) {
    return (
      <section class="card empty" aria-label="Minigames">
        <p>The minigames for this event haven't been confirmed yet. They'll show here once they are.</p>
      </section>
    );
  }
  return (
    <section class="card" aria-label="Minigames">
      <div class="card-title"><h3>Minigames</h3><span>{GAME_COUNT} game{GAME_COUNT === 1 ? '' : 's'}</span></div>
      <div class="mg-grid">
        {VISIBLE_GAMES.map((g) => (
          <a class="mg-card" href={`#/event/minigames/${g.key}`} key={g.key}>
            <div class="mg-card-head"><b>{g.name}</b><Badge g={g} /></div>
            <p>{g.guide?.summary ?? 'Guide not written yet.'}</p>
            {g.guide?.tokenLine && <p class="mg-tokens">{g.guide.tokenLine}</p>}
          </a>
        ))}
        {NEW_GAMES.map((n) => (
          <div class="mg-card mg-card-new" key={n.name}>
            <div class="mg-card-head"><b>{n.name}</b><span class="badge good">New</span></div>
            <p>{n.summary}</p>
            <p class="mg-note">From the announcement. There's no full guide yet, because its code isn't public.</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MinigameDetail({ slug }: { slug: string }) {
  const g = VISIBLE_GAMES.find((x) => x.key === slug);
  if (!g) {
    return (
      <section class="card empty">
        <p>{EVENT.minigames.some((x) => x.key === slug) ? "That minigame isn't part of this event." : "There's no minigame called that."}{' '}
          <a href="#/event/minigames">See the event's minigames</a>.</p>
      </section>
    );
  }
  const w = g.guide;
  // Citations are numbered in reading order, so each block is built (and cites) top to bottom, inline rather than
  // in child components, whose cite() calls would only run later at render time.
  const notes = makeNotes('mg');
  const block = (title: string, lines: WriteupLine[] | undefined, cls = '') =>
    lines?.length ? (
      <div class={`wu-block ${cls}`}>
        <h3>{title}</h3>
        <ul class="wu-bullets">{lines.map((l, i) => <li key={i}><span>{l.text}{notes.cite(l.src)}</span></li>)}</ul>
      </div>
    ) : null;
  // The storyboard sits under the summary, so its 3 beats are cited first. Keyed by game so moving to another game's
  // page starts its storyboard fresh instead of keeping the last one's beat and pause state.
  const Scene = w?.storyboard ? SCENES[g.key] : undefined;
  const story = w?.storyboard && Scene
    ? <StoryboardPlayer key={g.key} name={g.name} storyboard={w.storyboard} Scene={Scene} cites={w.storyboard.beats.map((b) => notes.cite(b.src))} />
    : null;
  let steps: JSX.Element | null = null;
  if (w?.howToPlay?.length) {
    steps = (
      <div class="wu-block">
        <h3>How to play</h3>
        <ol class="wu-steps">
          {w.howToPlay.map((l, i) => <li key={i}><span class="step-num" aria-hidden="true">{i + 1}</span><span>{l.text}{notes.cite(l.src)}</span></li>)}
        </ol>
      </div>
    );
  }
  // SkyWars only: the full chest loot tables, cited after the steps since it sits under them.
  const lootData = g.key === 'skywars' && w ? EVENT.skywarsLoot : null;
  const loot = lootData ? (
    <SkyWarsLoot
      pools={lootData.pools}
      cite={notes.cite([...lootData.pools.map((p) => p.src), ...lootData.pools.map((p) => p.chestSrc), lootData.rollSrc, lootData.pickSrc].join(', '))}
    />
  ) : null;
  const scoring = block('Scoring', w?.scoring);
  const tokens = block('Tokens', w?.tokens);
  // Copycat and Manor 2: a worked-out table from the game's own formulas, shown under scoring and tokens.
  const gm = EVENT.gameMath;
  const table = !w || !gm.scoreRange ? null
    : g.key === 'copycat' && gm.copycat ? <CopycatRounds c={gm.copycat} sr={gm.scoreRange} cite={notes.cite(`${gm.copycat.src}, ${gm.scoreRange.src}`)} />
    : g.key === 'manor-2' && gm.manor2 ? <Manor2Payouts m={gm.manor2} sr={gm.scoreRange} cite={notes.cite(`${gm.manor2.src}, ${gm.scoreRange.src}`)} />
    : null;
  const numbers = w?.numbers?.length ? (
    <div class="wu-block">
      <h3>Numbers</h3>
      <div class="stat-grid">
        {w.numbers.map((n, i) => (
          <div class="stat" key={i}><span class="stat-label">{n.label}</span><span class="stat-value">{n.value}{notes.cite(n.src)}</span></div>
        ))}
      </div>
    </div>
  ) : null;
  const tips = block('Tips', w?.tips);
  const quirks = block('Good to know', w?.quirks, 'callout warn');
  const config = block('Depends on server settings', w?.config, 'callout');

  return (
    <section class="card item-detail detail-card" aria-label={g.name}>
      <nav class="crumbs"><a href="#/event/minigames">← All minigames</a></nav>
      <div class="item-title">
        <h1>{g.name}</h1>
        <div class="badges"><Badge g={g} />{g.guide?.tokenLine && <span class="badge">{g.guide.tokenLine}</span>}</div>
      </div>
      {w ? (
        <>
          <p class="writeup-summary">{w.summary}</p>
          {story}
          {steps}
          {loot}
          {(scoring || tokens) && <div class="pair">{scoring}{tokens}</div>}
          {table}
          {numbers}
          {tips}
          {(quirks || config) && <div class={quirks && config ? 'callouts two' : 'callouts'}>{quirks}{config}</div>}
          <Sources notes={notes} commit={EVENT.commit} repo={EVENTS_REPO} />
        </>
      ) : (
        <p class="explain-line">
          This game's guide isn't written yet.{' '}
          {g.formula ? <>Its token formula is <Src src={g.formula.src}>here in the code</Src>.</> : <>Its <Src src={g.src}>code</Src> has no token formula, so it pays no tokens.</>}
        </p>
      )}
    </section>
  );
}
