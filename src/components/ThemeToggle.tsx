import { useState } from 'preact/hooks';
import { savePref } from '../lib/route';

type Mode = 'dark' | 'light';

/** index.html sets data-theme before first paint (dark unless the viewer picked light). */
const current = (): Mode => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

const Sun = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const Moon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </svg>
);

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(current);
  const next: Mode = mode === 'dark' ? 'light' : 'dark';
  return (
    <button
      class="theme-toggle"
      type="button"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        savePref('theme', { mode: next });
        setMode(next);
      }}
    >
      {mode === 'dark' ? <Sun /> : <Moon />}
    </button>
  );
}
