import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { SuggestButton } from '../components/SuggestButton';
import { bloomStatus, etParts, schedule, SERVER_TZ, type BloomWindow } from '../lib/bloom';

const LOCAL_TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return SERVER_TZ;
  }
})();
const SAME_TZ = new Date().toLocaleString('en-US', { timeZone: LOCAL_TZ }) === new Date().toLocaleString('en-US', { timeZone: SERVER_TZ });

const localTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const localDay = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const pad = (n: number) => String(n).padStart(2, '0');

function until(ms: number): string {
  const mins = Math.max(0, Math.ceil(ms / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h} h ${pad(mins % 60)} min`;
}

function relDay(date: string, today: string): string {
  const diff = (Date.parse(date) - Date.parse(today)) / 864e5;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return dayLabel.format(Date.parse(date)).split(',')[0];
}

function useNow(stepMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(t);
  }, [stepMs]);
  return now;
}

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--good)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M5 12l5 5 9-10" />
  </svg>
);

// Facts below are read from LumaLibre/LumaItems KamorisGlasses.kt @ 3c5a717 and PassiveListeners.kt.
const FACTS = [
  'Every 1.5 seconds it checks an 11 × 7 × 11 box around you: 5 blocks out each way, 3 up and 3 down.',
  'Grows up to 8 plants per check, one every 3 ticks, so at most about 5 plants a second.',
  'Works on crops, saplings, nether wart, cocoa and other plants with growth stages.',
  'Skips sweet berry bushes, chorus flowers and two-block-tall plants such as the pitcher plant.',
  'When more than 8 plants are waiting, the ones on the west (−X) side of the box go first.',
  "Plants that are already at the target are skipped, so they don't use up the 8 slots.",
];

const GROWTH: [string, string, string][] = [
  ['Wheat, carrots, potatoes', 'wheat', 'Stage 4 of 7 (57%)'],
  ['Beetroot, nether wart', 'beetroot', 'Stage 2 of 3'],
  ['Cocoa', 'cocoa_beans', 'Stage 1 of 2'],
  ['Saplings', 'oak_sapling', 'Ready to grow'],
];

function windowText(w: BloomWindow) {
  const twice = w.end - w.start > 3_600_000;
  const et = `${pad(w.hour)}:00–${pad(w.hour)}:59 server time (ET)`;
  const local = SAME_TZ ? '' : ` · ${localTime.format(w.start)} your time`;
  return `${et}${local}${twice ? ' · runs twice as clocks fall back' : ''}`;
}

export function ItemsTab() {
  const now = useNow(10_000);
  const { active, next } = bloomStatus(now);
  const today = etParts(now).date;
  const days = schedule(today, 7);
  const soon = !active && next.start - now < 3 * 3_600_000;

  return (
    <>
      <section class="intro">
        <h1>Item mechanics</h1>
        <p>How Luma's custom items actually behave, read from the plugin's source code.</p>
      </section>

      <section class="card" id="kamoris-glasses" aria-label="Kamori's Glasses" style={{ gap: '24px', padding: '28px' }}>
        <div class="item-card-head">
          <div class="item-frame"><Icon id="netherite_helmet" size={48} /></div>
          <div>
            <h2>Kamori's Glasses</h2>
            <div class="stripe" aria-hidden="true">
              {['#D8F3DC', '#B7E4C7', '#95D5B2', '#A9DEF9', '#CDB4DB'].map((c) => <i key={c} style={{ background: c }} />)}
            </div>
            <p class="small" style={{ color: 'var(--text-2)' }}>Netherite Helmet · Unbreaking X · Protection VI · Mending · Lumarine 2026 · “Blessing”</p>
          </div>
        </div>

        <div class="bloom-grid">
          <div class={`bloom-now${active ? ' active' : soon ? ' soon' : ''}`} aria-live="polite">
            <span class="kicker"><Icon id="clock" size={20} />{active ? 'Bloom hour is on now' : 'Next bloom hour'}</span>
            <span class="big">{active ? `${until(active.end - now)} left` : `in ${until(next.start - now)}`}</span>
            <span class="when">
              {active
                ? `Ends at ${localTime.format(active.end)}${SAME_TZ ? '' : ' your time'}`
                : `${relDay(next.date, today)}, ${windowText(next)}`}
            </span>
            <span class="hint">
              During the bloom hour plants grow all the way. Listen for the chime: a higher pitch (1.8) means bloom, 1.4 means a normal hour.
            </span>
          </div>
          <div class="days">
            <span class="sub-label">Next 7 days (server time, ET)</span>
            {days.map((d) => (
              <div key={d.date} class={`row${d.date === today ? ' today' : ''}`}>
                <b>{dayLabel.format(Date.parse(d.date))}</b>
                <span class="mono">{d.start === null ? 'skipped' : `${pad(d.hour)}:00`}</span>
                <span class="small muted">
                  {d.start === null ? 'clocks spring forward' : SAME_TZ ? (d.date === today ? 'today' : '') : localDay.format(d.start)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div class="pair">
          <div style={{ display: 'grid', gap: '12px', alignContent: 'start' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>What it does while worn</h3>
            <ul class="facts">
              {FACTS.map((f) => <li key={f}><Check /><span>{f}</span></li>)}
            </ul>
          </div>
          <div class="growth" style={{ display: 'grid', gap: '12px', alignContent: 'start' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>How far plants grow</h3>
            <div class="item-list" role="table" aria-label="Growth per hour type">
              <div class="item-head" role="row">
                <span role="columnheader">Plant</span><span role="columnheader">Normal hour</span><span role="columnheader">Bloom hour</span>
              </div>
              {GROWTH.map(([name, icon, normal]) => (
                <div class="grow-row" role="row" key={name}>
                  <span class="item-name" role="cell"><Icon id={icon} size={24} />{name}</span>
                  <span role="cell">{normal}</span>
                  <span role="cell" class="full">Fully grown</span>
                </div>
              ))}
            </div>
            <p class="note">
              It only ever raises a plant's stage. Sugar cane, cactus, kelp and vines also count, but for them the stage is a hidden
              growth timer, so what you see will differ. That part is from vanilla rules and hasn't been tested in-game.
            </p>
          </div>
        </div>

        <p class="note">
          Source: <a href="https://github.com/LumaLibre/LumaItems/blob/3c5a717/src/main/java/dev/lumas/lumaitems/items/armor/helmet/KamorisGlasses.kt" target="_blank" rel="noopener noreferrer">LumaLibre/LumaItems · KamorisGlasses.kt @ 3c5a717</a>.
          The bloom hour comes from a fixed formula per day, so this schedule is exact, not a prediction. It assumes the server clock runs on US Eastern time.
        </p>
      </section>

      <section class="more-card">
        <p>More items are on the way. Want one covered next?</p>
        <SuggestButton label="Suggest an item" outline />
      </section>
    </>
  );
}
