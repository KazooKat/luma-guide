import { cloneElement } from 'preact';
import type { JSX, VNode } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Storyboard } from '../../../data/types';

/** How long each of the 3 beats plays. */
export const BEAT_MS = 4500;
/** Where in a beat the still frame sits when motion is reduced, or when a step is picked while paused. */
export const STILL_T = 0.75;

export type Beat = 0 | 1 | 2;
export interface SceneProps {
  beat: Beat;
  /** Progress through the current beat, 0 to 1. */
  t: number;
  /** The storyboard's values from the guide JSON (the numbers the scene animates with). */
  values: Record<string, number>;
}
/** A game's drawing: a pure function of its props that returns a kit <Stage>. */
export type Scene = (props: SceneProps) => JSX.Element;

const LOOP = BEAT_MS * 3;
const motionQuery = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null);

/** Splits a loop clock (ms) into the beat and the progress through it. */
export function beatAt(clock: number): { beat: Beat; t: number } {
  const c = ((clock % LOOP) + LOOP) % LOOP;
  const beat = Math.min(2, Math.floor(c / BEAT_MS)) as Beat;
  return { beat, t: (c - beat * BEAT_MS) / BEAT_MS };
}

/**
 * Plays a game's 3 beats in a loop while it is on screen and the tab is visible. With reduced motion it starts
 * paused on a still of beat 1. The caption is ordinary text (not a live region, so a loop doesn't keep announcing),
 * the steps are buttons named after their captions, and the drawing itself is hidden from screen readers.
 */
export function StoryboardPlayer({ name, storyboard, Scene, cites }: {
  name: string;
  storyboard: Storyboard;
  Scene: Scene;
  /** One citation button per beat, made by the page's makeNotes in reading order. */
  cites?: VNode[];
}) {
  const root = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(() => !motionQuery()?.matches);
  const [clock, setClock] = useState(() => (motionQuery()?.matches ? STILL_T * BEAT_MS : 0));
  const [onScreen, setOnScreen] = useState(false);
  const [tabHidden, setTabHidden] = useState(() => typeof document !== 'undefined' && document.hidden);

  useEffect(() => {
    const q = motionQuery();
    if (!q) return;
    const on = () => { if (q.matches) setPlaying(false); };
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver !== 'function') { setOnScreen(true); return; }
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const on = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  const running = playing && onScreen && !tabHidden;
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // Capped so a stalled frame (a background tab, a debugger) doesn't skip a whole beat.
      const dt = Math.min(100, Math.max(0, now - last));
      last = now;
      setClock((c) => (c + dt) % LOOP);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const { beat, t } = beatAt(clock);
  const b = storyboard.beats[beat];
  const jump = (i: number) => setClock(i * BEAT_MS + (playing ? 0 : STILL_T * BEAT_MS));
  const cite = cites?.[beat];

  return (
    <figure class="sb" ref={root} aria-label={`How ${name} works, in 3 steps`}>
      <div class="sb-top">
        <figcaption class="sb-caption" key={beat}>
          <b>{b.caption}</b>
          <span>{b.sub}{cite && cloneElement(cite)}</span>
        </figcaption>
        <div class="sb-controls">
          <div class="sb-steps" role="group" aria-label="Steps">
            {storyboard.beats.map((x, i) => (
              <button
                type="button" key={i}
                class={`sb-step${i === beat ? ' on' : i < beat ? ' done' : ''}`}
                aria-label={`Step ${i + 1}: ${x.caption}`}
                aria-current={i === beat ? 'step' : undefined}
                onClick={() => jump(i)}
              />
            ))}
          </div>
          <button type="button" class="sb-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause animation' : 'Play animation'}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
              {playing
                ? <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" />
                : <path d="M5 2.5v11l9-5.5z" fill="currentColor" />}
            </svg>
          </button>
        </div>
      </div>
      <div class="sb-scene" aria-hidden="true">
        <Scene beat={beat} t={t} values={storyboard.values} />
      </div>
    </figure>
  );
}
