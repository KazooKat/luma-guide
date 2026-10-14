# Minigame storyboards

Date: 2026-10-14. Status: approved in chat ("go until implemented"), being built.

## Goal

Every minigame guide page (`#/event/minigames/<key>`) gets a short animation that teaches the game on its own: what
you do, what happens, and how it pays. Someone who skips the text should still know how to earn tokens.

## Decisions (made with the user)

- Style C, the captioned storyboard: a top-down schematic played as 3 beats, each with a caption and a subline.
  Mockup: `.superpowers/brainstorm/3352489-1791974595/content/animation-style-v2.html` (gitignored).
- All 14 games in the first build.
- One hand-made scene component per game, inside one shared frame.
- Captions and numbers live in the guide JSON, next to the text they come from, with `src` citations.
- Autoplay when on screen, loop, pause when off screen or the tab is hidden. Step dots jump to a beat, and there is a
  pause button. Reduced motion: no autoplay, the current beat shows as a still, and the dots still switch beats.

## Data

Each guide in `data/event/minigames/*.json` gets an optional `storyboard`:

```json
"storyboard": {
  "values": { "pointsPerSecond": 4, "pointsPerToken": 90, "maxTokens": 12 },
  "beats": [
    { "caption": "Keep running", "sub": "You score 4 points every second you stay up.", "src": "games/logic/TNTRun.java:185-191" },
    { "caption": "...", "sub": "...", "src": "..." },
    { "caption": "...", "sub": "...", "src": "..." }
  ]
}
```

- `values`: the numbers the scene animates with (finite numbers only). The scene reads these instead of hard-coding them.
- `beats`: exactly 3, in the order do, happens, pays. `caption` at most 40 characters, `sub` at most 110, and `src` uses
  the same `file:line` format and checks as every other guide line.
- `scripts/build-event.mjs` validates the shape and the citations and copies it into `src/data/event.json` as part of
  the guide. `MinigameGuide.storyboard` in `src/data/types.ts` holds the type.

## Code

- `src/tabs/event/storyboard/Storyboard.tsx`: the frame. It runs one clock (requestAnimationFrame, about 4.5 seconds a
  beat), pauses through an IntersectionObserver and `visibilitychange`, and honours `prefers-reduced-motion`. It draws
  the step dots, the pause/play button, the caption and subline, and gives the scene `{ beat, t, values }`, where `t`
  runs 0 to 1 through the beat. The beats are also given to screen readers as a plain list, and the animated part is
  `aria-hidden`.
- `src/tabs/event/storyboard/kit.tsx`: shared SVG pieces (a cell grid, player dots, token chips, a readout, labels) and
  easing helpers, so the scenes look like 1 feature. Colours come from CSS variables in `src/styles.css` (`.sb-*`),
  so both themes work.
- `src/tabs/event/storyboard/scenes/<Game>.tsx`: 1 per game. Each exports `key` (the guide key) and `Scene`, a pure
  function of its props that returns an `<svg viewBox="0 0 400 200">`. No hooks, no timers, no randomness (a seeded
  helper from the kit if a scene needs scatter), so a scene at the same props always draws the same frame.
- `src/tabs/event/storyboard/scenes.ts`: finds the scenes with `import.meta.glob`, so adding a game is adding a file.
- `MinigameDetail` (`src/tabs/event/Minigames.tsx`) renders the storyboard right under the summary when the guide has
  one and a scene exists for its key.

## Checks

- Build: `npm run event` rejects a storyboard that isn't 3 beats, has an over-long caption or sub, a dash, a missing or
  out-of-range `src`, or a non-numeric value.
- `src/tabs/event/storyboard/storyboard.test.ts`:
  - every guide has a storyboard and a scene, and every scene file matches a guide;
  - every number in `values` and in the beat text also appears in that game's guide text (token line, how to play,
    scoring, tokens, numbers), so the animation can't drift from the page;
  - every scene, called at beats 0 to 2 and several `t`, returns an `svg` tree with no `NaN` or `undefined` in its
    attributes.
- Visual: Playwright screenshots of each game at each beat, desktop and phone width, dark and light theme, on the box
  dev server.

## Out of scope

Sound, user-adjustable speed, a gallery of all animations, and turning the Event tab live.
