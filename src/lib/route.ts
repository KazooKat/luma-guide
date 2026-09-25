import { useEffect, useState } from 'preact/hooks';

/** Hash routes keep deep links working on GitHub Pages: #/jobs/cook, #/items/kamoris-glasses */
export function useRoute(): string[] {
  const read = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => setParts(read());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return parts;
}

/** localStorage is a per-viewer convenience only; every access is guarded (private mode, blocked storage). */
export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`luma-guide:${key}`);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
export function savePref(key: string, value: unknown) {
  try {
    localStorage.setItem(`luma-guide:${key}`, JSON.stringify(value));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}
