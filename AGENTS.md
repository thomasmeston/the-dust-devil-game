# Agents — The Little Dust Devil

Harness-neutral handoff for **Cursor (Cody)**, **Google Antigravity**, and **Cloud Cody**.  
Read this file and `CURRENT_TASK.md` at the start of every session.

## Project

| Field | Value |
|-------|-------|
| Name | The Little Dust Devil |
| GitHub | https://github.com/thomasmeston/the-dust-devil-game |
| Live | https://thomasmeston.github.io/the-dust-devil-game/ |
| Stack | Vite 6, TypeScript, Three.js, Howler |
| Branch | `main` (auto-deploys to GitHub Pages on push) |

## Session start (any harness)

1. **`CURRENT_TASK.md`** — active goal, status, next step (source of truth for "where we left off")
2. **`README.md`** — play, build, deploy, controls
3. **`data/story/script.json`** — narrative beats
4. **`data/levels/*.json`** — stage definitions
5. **`src/game/Game.ts`** — main loop and systems entry

Then run `git pull` and `git status` before editing.

## Agent OS (optional context)

Extended project profile and orchestration live in a separate repo. Paths below are **desktop defaults** — adjust if your clone differs.

| Resource | Desktop path |
|----------|----------------|
| Agent OS root | `C:\Users\thoma\agent-os` |
| Project context | `C:\Users\thoma\agent-os\context\projects\dust-devil-game.md` |
| Active work hub | `C:\Users\thoma\agent-os\memory\active-work.md` |
| Cody handoff | `C:\Users\thoma\agent-os\memory\handoffs\H-001-dust-devil-cody.md` |

**Cursor:** Use Cody activation from handoff H-001; skills `repo-context`, `code-implement`, `repo-verify`.

**Antigravity:** Same repo folder; prompt: *"Read AGENTS.md and CURRENT_TASK.md, continue the next step, run verification."*

**Cloud Cody:** Multi-repo preset — primary = this repo, secondary = `agent-os`. See `agent-os/cloud/cody-setup.md`.

## Key paths

| Path | Purpose |
|------|---------|
| `src/game/` | Core systems (dust devil, absorption, stages, audio, camera) |
| `src/ui/` | HUD, thought bubbles |
| `data/levels/` | Per-stage JSON (desert through downtown) |
| `data/objects.json` | Absorbable object definitions |
| `public/models/` | GLB models |
| `public/textures/` | Ground textures (Poly Haven) |
| `public/audio/` | Stage soundtracks |
| `src/utils/bounds.ts` | Playable area / border inset |
| `src/game/BorderMountains.ts` | Edge mountain visuals |
| `src/game/PropFactory.ts` | Procedural props (e.g. goat) |
| `src/game/ParticleSwirl.ts` | Dust/dirt trails |

## Commands

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc + vite build
npm run preview      # serve dist/
npm run package:itch # dust-devil-itch.zip for itch.io
```

## Verification

| Check | Command | When |
|-------|---------|------|
| Typecheck + build | `npm run build` | Any TS/game logic change |
| Dev smoke | `npm run dev` — title loads, no console errors | After gameplay/UI changes |
| Play-test | Walk affected stages in browser | Before claiming feel is correct |
| Relative assets | `npm run preview` | After Vite `base` or public URL changes |
| itch package | `npm run package:itch` | Before itch upload |

Do not claim gameplay polish is done from build alone — browser play-through is required.

## Conventions

- **Minimize diff** — match existing Three.js/TS patterns in `src/game/`
- **Data-driven content** — prefer `data/` JSON over hardcoding new stages/objects
- **Relative paths** — keep `base: './'` and `publicUrl()` for GitHub Pages + itch.io
- **Large assets** — avoid churn in `public/models/` and `public/textures/`
- **Commits** — only when Thomas explicitly asks (WIP checkpoint commits on a feature branch are OK when switching machines/harnesses)
- **Do not** force-push `main`, skip hooks, or commit secrets

## Branch strategy

| Branch | Use |
|--------|-----|
| `main` | Shippable; triggers GitHub Pages deploy |
| `wip/*` | Daily work and machine/harness checkpoints |

Merge to `main` when play-tested and ready for live deploy.

## Cross-machine / cross-harness continuity

1. Update `CURRENT_TASK.md` before ending a session
2. Commit and push (prefer `wip/*` for unfinished work)
3. On the next machine or harness: `git pull`, read `CURRENT_TASK.md`, continue

Chat history does not transfer between Cursor, Antigravity, or laptops.

## Backlog (not blockers)

- Loading screen during asset preload
- Asset compression (smaller JPGs / Draco GLBs)
- Touch/mobile polish or "keyboard required" on itch page
- itch.io upload when Thomas is ready (`npm run package:itch`)
