import type { Scene } from './Storyboard';

/** One file per game in ./scenes, each exporting `key` (the guide key) and `Scene`. Adding a game is adding a file. */
export interface SceneModule { key: string; Scene: Scene }

const modules = import.meta.glob<SceneModule>('./scenes/*.tsx', { eager: true });

export const SCENE_FILES: Record<string, SceneModule> = Object.fromEntries(
  Object.entries(modules).map(([path, m]) => [path.replace(/^\.\/scenes\//, ''), m]),
);
export const SCENES: Record<string, Scene> = Object.fromEntries(Object.values(modules).map((m) => [m.key, m.Scene]));
