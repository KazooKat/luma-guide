import type { ComponentChildren } from 'preact';
import data from '../../data/event.json';
import type { EventData, EventMinigame } from '../../data/types';
import type { SourceRepo } from '../items/Writeup';

// Through unknown: TypeScript types the JSON as a union of every guide's shape, so storyboard values (different names
// per game) no longer overlap EventData. scripts/build-event.mjs checks the shape before it writes the file.
export const EVENT = data as unknown as EventData;
export const META = EVENT.meta;
export const EVENTS_REPO: SourceRepo = { url: 'https://github.com/LumaLibre/luma-events', path: 'src/main/java/dev/lumas/events' };
export const EVENTS_REF = EVENT.commit.slice(0, 7);

/** Until the event is checked in game (live: false), every page is a preview with the scaffolding disclaimer, and every minigame shows. */
export const PREVIEW = !META.live;
/** The pinned code was written for an earlier event, so its numbers may still change. */
export const FROM_OLD_CODE = META.sourceEvent !== META.name;

const ACTIVE = new Set(META.activeGames);
export const isActive = (g: EventMinigame) => ACTIVE.has(g.key);
/** Once live, only the games confirmed for this event; in preview, all of them. */
export const VISIBLE_GAMES = EVENT.minigames.filter((g) => PREVIEW || isActive(g));
/** Games running this event that the pinned code doesn't have, so there's no guide for them. Only once live. */
export const NEW_GAMES = PREVIEW ? [] : META.newGames;
export const GAME_COUNT = VISIBLE_GAMES.length + NEW_GAMES.length;
/** "Luma Nightmares'" rather than "Luma Nightmares's". */
export const possessive = (name: string) => (name.endsWith('s') ? `${name}'` : `${name}'s`);

export const PAGES = [
  ['', 'Overview'],
  ['tokens', 'Tokens'],
  ['shop', 'Shop'],
  ['minigames', 'Minigames'],
] as const;

export function SubNav({ page }: { page: string }) {
  return (
    <nav class="chips" aria-label="Event pages">
      {PAGES.map(([slug, label]) => (
        <a key={slug} class="chip event-chip" href={`#/event${slug ? `/${slug}` : ''}`} aria-current={page === slug ? 'page' : undefined}>{label}</a>
      ))}
    </nav>
  );
}

/** Preview and "old code" notices, shown at the top of every event page. */
export function Banners() {
  if (!PREVIEW && !FROM_OLD_CODE) return null;
  return (
    <div class="event-banners">
      {PREVIEW && (
        <p class="event-banner preview" role="note">
          <b>Scaffolding, not verified.</b> Nothing in this section has been checked in game for {META.name} yet, so it is a draft:
          the minigames, scores and token payouts come from the last event's code, and every minigame is listed even if it isn't
          running this time. It will be updated as each part is checked in game.
        </p>
      )}
      {FROM_OLD_CODE && (
        <p class="event-banner" role="note">
          <b>From {possessive(META.sourceEvent)} code.</b> The numbers here are read from the event plugin as it was for {META.sourceEvent}
          {' '}(<a href={`${EVENTS_REPO.url}/tree/${EVENTS_REF}`} target="_blank" rel="noopener noreferrer">luma-events @ {EVENTS_REF}</a>).
          {' '}They'll be re-checked once {possessive(META.name)} code is public, so some of them may change.
        </p>
      )}
    </div>
  );
}

/** Link to a cited place in the event code, for one-off facts outside a write-up. */
export function Src({ src, children }: { src: string; children?: ComponentChildren }) {
  const m = /^(.+?):(\d+)(?:-(\d+))?$/.exec(src.split(/,\s*/)[0].trim());
  if (!m) return null;
  const href = `${EVENTS_REPO.url}/blob/${EVENTS_REF}/${EVENTS_REPO.path}/${m[1]}#L${m[2]}${m[3] ? `-L${m[3]}` : ''}`;
  return <a class="src-link" href={href} target="_blank" rel="noopener noreferrer">{children ?? `${m[1].split('/').pop()} · ${m[2]}${m[3] ? `–${m[3]}` : ''}`}</a>;
}
