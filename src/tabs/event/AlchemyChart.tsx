import { useState } from 'preact/hooks';
import { fmt2 } from '../../lib/format';
import { MCMMO_MAX_LEVEL } from '../../lib/mcmmo';
import { niceTop } from '../jobs/HoursChart';
import { alchemistTokensAt, alchemyLevelToReach } from './jobTokens';

const STEP = 5;
const LEVELS = Array.from({ length: MCMMO_MAX_LEVEL / STEP + 1 }, (_, i) => i * STEP);
const X_TICKS = [0, 250, 500, 750, 1000];

/**
 * Alchemist tokens an hour across Alchemy levels (Catalysis brews faster), against the best other job with the
 * reader's setups. One axis, both in tokens an hour. Clicking or dragging on the plot sets the Alchemy level.
 */
export function AlchemyChart({ p, stands, level, onLevel, other }: {
  p: number;
  stands: number;
  level: number;
  onLevel: (level: number) => void;
  other: { job: string; tokensPerHour: number } | null;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const curve = LEVELS.map((l) => alchemistTokensAt(p, stands, l));
  const top = niceTop(Math.max(curve[curve.length - 1], other?.tokensPerHour ?? 0, 0.01));
  const yPct = (v: number) => 100 - (v / top) * 100;
  const xPct = (l: number) => (l / MCMMO_MAX_LEVEL) * 100;
  const ticks = [0, 1, 2, 3, 4].map((k) => (top / 4) * k);
  const pts = LEVELS.map((l, i) => `${l},${(yPct(curve[i]) / 100) * 1000}`).join(' ');
  const cross = other ? alchemyLevelToReach(p, stands, other.tokensPerHour) : null;
  const mine = alchemistTokensAt(p, stands, level);

  const levelAt = (e: PointerEvent) => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return Math.round(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) * MCMMO_MAX_LEVEL);
  };
  const shown = hover ?? level;

  return (
    <div class="lchart">
      <div class="legend" aria-hidden="true">
        <span><i class="key you" /> Alchemist, {stands} brewing stand{stands === 1 ? '' : 's'}</span>
        {other && <span><i class="key ref" /> {other.job}, your setup</span>}
      </div>
      <div class="chart">
        <div class="chart-y" aria-hidden="true">
          {ticks.map((t) => <span key={t} style={{ top: `${yPct(t)}%` }}>{t === 0 ? '0' : fmt2(t)}</span>)}
        </div>
        <div
          class="chart-plot lplot"
          role="img"
          aria-label={`Line chart: Alchemist tokens an hour rise from ${fmt2(curve[0])} at Alchemy 0 to ${fmt2(curve[curve.length - 1])} at Alchemy 1000${other ? `; ${other.job} with your setup is ${fmt2(other.tokensPerHour)} an hour` : ''}.`}
          onPointerMove={(e) => { const l = levelAt(e); setHover(l); if (e.buttons & 1) onLevel(l); }}
          onPointerLeave={() => setHover(null)}
          onPointerDown={(e) => onLevel(levelAt(e))}
        >
          {ticks.slice(1).map((t) => <div key={t} class="gridline" style={{ top: `${yPct(t)}%` }} />)}
          <svg class="lsvg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <polygon class="area" points={`0,1000 ${pts} 1000,1000`} />
            <polyline class="line" points={pts} />
            {other && <line class="ref" x1={0} x2={1000} y1={(yPct(other.tokensPerHour) / 100) * 1000} y2={(yPct(other.tokensPerHour) / 100) * 1000} />}
          </svg>
          {other && (
            <span class="lref-label" style={{ top: `${yPct(other.tokensPerHour)}%` }}>{other.job} {fmt2(other.tokensPerHour)}/h</span>
          )}
          {cross !== null && cross > 0 && (
            <span class="lcross" style={{ left: `${xPct(cross)}%`, top: `${yPct(other!.tokensPerHour)}%` }}>
              <i /><b>passes at {cross}</b>
            </span>
          )}
          {hover !== null && <div class="crosshair" style={{ left: `${xPct(hover)}%` }} />}
          <span class="ldot" style={{ left: `${xPct(shown)}%`, top: `${yPct(alchemistTokensAt(p, stands, shown))}%` }} />
          <div
            class="tooltip"
            // Grows away from the nearer edge, so it never hangs off a narrow screen.
            style={{
              left: `${xPct(shown)}%`, top: `${yPct(alchemistTokensAt(p, stands, shown))}%`,
              transform: `translate(${xPct(shown) > 65 ? 'calc(-100% - 10px)' : xPct(shown) < 35 ? '10px' : '-50%'}, calc(-100% - 8px))`,
            }}
          >
            Alchemy {shown}: <b>{fmt2(alchemistTokensAt(p, stands, shown))}</b>/h{hover === null ? ' (you)' : ''}
          </div>
        </div>
        <div class="chart-x" aria-hidden="true">
          {X_TICKS.map((l) => <span key={l} style={{ left: `${xPct(l)}%` }}>{l}</span>)}
        </div>
      </div>
      <p class="note">
        {!other ? null : cross === null
          ? <>With {stands} brewing stand{stands === 1 ? '' : 's'}, the Alchemist stays below {other.job} ({fmt2(other.tokensPerHour)}/h) at every Alchemy level. More stands lift the whole line.</>
          : cross === 0
            ? <>With {stands} brewing stands, the Alchemist already beats {other.job} at Alchemy 0.</>
            : <>With {stands} brewing stands, the Alchemist passes {other.job} at Alchemy {cross}. You're at {level}: {fmt2(mine)} tokens an hour.</>}
        {' '}Click or drag on the chart to set your level.
      </p>
    </div>
  );
}
