import type { JobPrefs } from '../JobsTab';
import { fmt2, fmtInt } from '../../lib/format';
import { fishingTiming, MASTER_ANGLER_LEVELS, MCMMO_MAX_LEVEL } from '../../lib/mcmmo';

const LURE = ['None', 'I', 'II', 'III', 'IV', 'V'];

export const fishingSetupOf = (prefs: JobPrefs) => ({
  level: prefs.fishingLevel, lure: prefs.lure, raining: prefs.raining, boat: prefs.boat, handlingSeconds: prefs.handlingSeconds,
});

export function FishingSetup({ prefs, set }: { prefs: JobPrefs; set: (p: Partial<JobPrefs>) => void }) {
  const t = fishingTiming(fishingSetupOf(prefs));
  const nextRank = MASTER_ANGLER_LEVELS[t.rank];
  const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value);
  const secs = (ticks: number) => fmt2(ticks / 20).replace(/\.?0+$/, '');
  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <span class="sub-label">Your fishing setup</span>
      <div class="setup-grid">
        <label class="field">mcMMO Fishing level
          <input type="number" inputMode="numeric" min={0} max={MCMMO_MAX_LEVEL} value={prefs.fishingLevel}
            onInput={(e) => set({ fishingLevel: num(e) })} />
        </label>
        <label class="field">Lure on your rod
          <select value={prefs.lure} onChange={(e) => set({ lure: Number((e.currentTarget as HTMLSelectElement).value) })}>
            {LURE.map((name, n) => <option key={n} value={n}>{n === 0 ? name : `Lure ${name}`}</option>)}
          </select>
        </label>
        <label class="field">Reel + recast (s)
          <input type="number" inputMode="decimal" min={0} max={30} step={0.25} value={prefs.handlingSeconds}
            onInput={(e) => set({ handlingSeconds: num(e) })} />
        </label>
        <div class="field span2">Conditions
          <div class="toggles">
            <button class="chip toggle" aria-pressed={prefs.raining} onClick={() => set({ raining: !prefs.raining })}>Raining</button>
            <button class="chip toggle" aria-pressed={prefs.boat} onClick={() => set({ boat: !prefs.boat })}>In a boat</button>
          </div>
        </div>
      </div>
      <p class="note">
        {t.rank > 0 ? (
          <>Master Angler rank <b>{t.rank}/8</b>{nextRank ? <> (next at {fmtInt(nextRank)})</> : null}: </>
        ) : (
          <>No Master Angler yet (unlocks at Fishing 1{prefs.boat ? <>; the boat bonus needs it too</> : null}): </>
        )}
        a fish is on its way {secs(t.minWait)}–{secs(t.maxWait)} s after the bobber lands{prefs.boat && t.rank > 0 ? <> (boat included)</> : null}
        {t.vanillaLure ? <> minus {prefs.lure * 5} s from Lure</> : null}, then takes 1–4 s to bite
        {prefs.raining ? <>, all 25% faster in the rain</> : null}.
        That's about <b>{fmt2(t.secondsPerCatch)} s per catch</b> = {fmtInt(t.catchesPerHour)} catches per hour.
      </p>
      <p class="note">
        Rain only counts with open sky above the bobber, in a biome where it rains (not snowy or desert).
        Under a roof, fishing is slower than shown. mcMMO folds Lure into Master Angler, so Lure IV and V still help.
      </p>
      <p class="note flag">
        Move your bobber a few blocks when chat says "not many fish left": after about 10 catches in one spot,
        mcMMO flags it as overfishing and Jobs stops paying.
      </p>
    </div>
  );
}
