import type { JSX } from 'preact';
import type { EventMinigame, WriteupLine } from '../../data/types';
import { makeNotes, Sources } from '../items/Writeup';
import { EVENT, EVENTS_REPO, isActive, PREVIEW, Src, VISIBLE_GAMES } from './common';

function Badge({ g }: { g: EventMinigame }) {
  if (isActive(g)) return <span class="badge good">In this event</span>;
  return PREVIEW ? <span class="badge">Not confirmed</span> : null;
}

export function MinigameList() {
  if (!VISIBLE_GAMES.length) {
    return (
      <section class="card empty" aria-label="Minigames">
        <p>The minigames for this event haven't been confirmed yet. They'll show here once they are.</p>
      </section>
    );
  }
  return (
    <section class="card" aria-label="Minigames">
      <div class="card-title"><h3>Minigames</h3><span>{VISIBLE_GAMES.length} game{VISIBLE_GAMES.length === 1 ? '' : 's'}</span></div>
      <div class="mg-grid">
        {VISIBLE_GAMES.map((g) => (
          <a class="mg-card" href={`#/event/minigames/${g.key}`} key={g.key}>
            <div class="mg-card-head"><b>{g.name}</b><Badge g={g} /></div>
            <p>{g.guide?.summary ?? 'Guide not written yet.'}</p>
            {g.guide?.tokenLine && <p class="mg-tokens">{g.guide.tokenLine}</p>}
          </a>
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
  const scoring = block('Scoring', w?.scoring);
  const tokens = block('Tokens', w?.tokens);
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
          {steps}
          {(scoring || tokens) && <div class="pair">{scoring}{tokens}</div>}
          {numbers}
          {tips}
          {(quirks || config) && <div class={quirks && config ? 'callouts two' : 'callouts'}>{quirks}{config}</div>}
          <Sources notes={notes} commit={EVENT.commit} repo={EVENTS_REPO} />
        </>
      ) : (
        <p class="explain-line">This game's guide isn't written yet. Its token formula is <Src src={g.formula.src}>here in the code</Src>.</p>
      )}
    </section>
  );
}
