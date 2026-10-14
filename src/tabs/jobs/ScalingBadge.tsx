import { useState } from 'preact/hooks';
import type { Job } from '../../data/types';
import { MAX_LEVEL } from '../../lib/scaling';

/** 10/7 -> "10/7", 5 -> "5" */
export const fmtOffset = (c: number) => (Math.abs(c - 10 / 7) < 1e-9 ? '10/7' : String(+c.toFixed(3)));

/** "23 and 24", "23, 38, 39 and 48" */
const listLevels = (ls: number[]) => (ls.length < 2 ? String(ls[0] ?? '?') : `${ls.slice(0, -1).join(', ')} and ${ls[ls.length - 1]}`);

/**
 * The "Scaling confirmed / assumed" chip. Hover, focus or tap shows which levels this job's pay was actually read at,
 * the formulas used to project it, and where your level sits on 1 to 85 relative to those readings.
 */
export function ScalingBadge({ job, level }: { job: Job; level: number }) {
  const [open, setOpen] = useState(false);
  const confirmed = job.confidence === 'confirmed';
  const levels = [...job.readLevels].sort((a, b) => a - b);
  const x = (L: number) => 8 + ((Math.min(MAX_LEVEL, Math.max(1, L)) - 1) / (MAX_LEVEL - 1)) * 224;
  const nearest = levels.reduce((a, b) => (Math.abs(b - level) < Math.abs(a - level) ? b : a), levels[0] ?? level);
  const id = `scaling-tip-${job.job.toLowerCase()}`;

  return (
    <span class={`scale-badge${open ? ' open' : ''}`} onMouseLeave={() => setOpen(false)}>
      <button type="button" class={`badge ${confirmed ? 'good' : 'warn'}`} aria-describedby={id} aria-expanded={open}
        onClick={() => setOpen((o) => !o)} onBlur={() => setOpen(false)}>
        {confirmed && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
        )}
        Scaling {confirmed ? 'confirmed' : 'assumed'}
      </button>
      <span class="scale-tip" role="tooltip" id={id}>
        <b>{confirmed ? `Checked at levels ${listLevels(levels)}` : `Read at level ${listLevels(levels)} only`}</b>
        <span>
          {confirmed
            ? `In-game /jobs browse readings at these levels all match the formulas below, within the game's 2-decimal rounding.`
            : `Other levels are projected with the formulas below, which were checked on other jobs but not yet on ${job.job}.`}
        </span>
        <svg class="lvl-strip" viewBox="0 0 240 34" aria-hidden="true" focusable="false">
          <line x1={8} x2={232} y1={12} y2={12} class="track" />
          {levels.map((L) => <circle key={L} cx={x(L)} cy={12} r={4.5} class="read" />)}
          <path d={`M${x(level)} 7 l-4 -6 h8 z`} class="you" />
          {x(level) > 40 && <text x={8} y={30} class="tick">1</text>}
          {x(level) < 200 && <text x={232} y={30} class="tick" text-anchor="end">{MAX_LEVEL}</text>}
          <text x={x(level)} y={30} class="tick you-label" text-anchor={x(level) < 30 ? 'start' : x(level) > 210 ? 'end' : 'middle'}>you {level}</text>
        </svg>
        <span class="muted">
          Money per action ∝ (L + 9), XP per action ∝ (L + {fmtOffset(job.xpOffset)}).
          {levels.length ? ` Your level is ${Math.abs(level - nearest) === 0 ? 'one of the readings' : `${Math.abs(level - nearest)} level${Math.abs(level - nearest) === 1 ? '' : 's'} from the nearest reading (${nearest})`}.` : ''}
        </span>
      </span>
    </span>
  );
}
