# Handoff — The Little Dust Devil

> **Purpose:** Self-contained continuity for **any machine** and **any agent** (Cursor, Antigravity, Cloud Cody, etc.).  
> Chat history does not transfer — this file plus git state are the handoff.

| Doc | Role | Update when |
|-----|------|-------------|
| **`HANDOFF.md`** (this file) | Architecture, workflows, WIP index, session rituals | Major features land, conventions change, or WIP scope shifts |
| **`CURRENT_TASK.md`** | Active goal, status, next step | **Every session end** (lightweight, always current) |
| **`AGENTS.md`** | Harness-neutral rules, commands, paths | Rarely — project-wide agent policy |
| **`README.md`** | Player-facing play/build/deploy | User-facing changes only |

Optional external context (may not exist on every machine): `agent-os/memory/handoffs/H-001-dust-devil-cody.md`

---

## Quick start (any agent)

Copy-paste prompt:

> Read `AGENTS.md`, `HANDOFF.md`, and `CURRENT_TASK.md`. Run `git pull` and `git status`. Continue the next step in `CURRENT_TASK.md`. Run verification before claiming done.

Then:

```bash
npm install          # first time or after dependency changes
npm run dev          # http://localhost:5173 (or next free port)
npm run build        # required after TS/game logic changes
```

Play-test affected stages in the browser — build passing alone is not enough for gameplay polish.

---

## Project snapshot

| Field | Value |
|-------|-------|
| Name | The Little Dust Devil |
| Repo | https://github.com/thomasmeston/the-dust-devil-game |
| Live (GitHub Pages) | https://thomasmeston.github.io/the-dust-devil-game/ |
| Stack | Vite 6, TypeScript, Three.js, Howler |
| Deploy branch | `main` (auto-deploy on push) |
| WIP branch pattern | `wip/*` for checkpoints between machines |

**Last handoff update:** 2026-06-21  
**Last committed checkpoint:** `80a1db8` — *Add AGENTS.md and refresh CURRENT_TASK checkpoint.*  
**Remote baseline before large local WIP:** `dd94ac2` — procedural props + dust devil visual polish

---

## Architecture (where things live)

```
src/main.ts          → bootstraps Game
src/game/Game.ts     → main loop, state machine, wires all systems
src/game/            → gameplay systems (see table below)
src/ui/              → HUD, inventory, thought bubbles, touch controls
src/data/loader.ts   → loads JSON from data/
data/levels/*.json   → per-stage layout (desert → downtown)
data/objects.json    → absorbable object defs (mass, mesh, behavior flags)
data/story/script.json → narrative beats
public/models/       → GLB assets
public/textures/     → ground PBR (Poly Haven)
public/audio/        → stage soundtracks + sfx
```

### System map

| System | File(s) | Responsibility |
|--------|---------|----------------|
| Main loop & stage flow | `Game.ts` | Title → stages → win; story pauses; UFO; cutscenes |
| Player | `DustDevil.ts` | Movement, mass, boost, border spring + wind gust pushback |
| Absorption | `AbsorptionSystem.ts` | Pickup radius, flee/chase AI, animal behaviors, trails |
| Stages | `StageManager.ts` | Ground plane, props, spawn grid, borders, stage transitions |
| Props (procedural) | `PropFactory.ts` | Tortoise, snake, goat, Joshua tree, suburban meshes, etc. |
| Particles | `ParticleSwirl.ts` | Dust/dirt trails, wind gust particles |
| Audio | `AudioManager.ts` | Music per stage, synthesized SFX (wind, tortoise shell, UFO) |
| Camera | `CameraController.ts` | Isometric follow, shake, axis alignment (`constants.ts`) |
| Desert UFO | `DesertUfo.ts` | Fly-by state machine, shadow, absorption gate at 130 mass |
| Ground textures | `GroundTextureLoader.ts` | Biome diff/normal maps, material tuning |
| Borders | `src/utils/bounds.ts`, `BorderMountains.ts` | Playable inset; mountain ring (may be disabled in WIP) |
| UI | `UIManager.ts`, `HUD.ts`, `ThoughtBubble.ts` | Overlays, Level 1 completion video |
| Story | `StoryManager.ts` | Beat queue from `script.json` |

Entry point for new gameplay logic: start in `Game.ts` update loop, then the relevant system.

---

## Stages

| # | ID | JSON | Ground texture | Theme |
|---|-----|------|----------------|-------|
| 1 | desert | `data/levels/desert.json` | aerial_sand | Cowbell Save File |
| 2 | mountain | `data/levels/mountain.json` | aerial_rocks_02 | Mossy Pixel Boots |
| 3 | forest | `data/levels/forest.json` | brown_mud_leaves_01 | Under Pine Wings |
| 4 | suburbs | `data/levels/suburbs.json` | aerial_grass_rock | Gravel Morning |
| 5 | downtown | `data/levels/downtown.json` | asphalt_01 | Dust Devil Downtown |

Stage order and titles: `src/utils/constants.ts` (`STAGE_ORDER`, `STAGE_TITLES`).

---

## Active WIP (uncommitted as of 2026-06-21)

> Detail list also lives in `CURRENT_TASK.md` — keep both in sync when scope changes.

Large local changes **not yet on `main`**. Before switching machines, commit to `wip/*` and push, or risk losing work.

| Area | Summary | Primary files |
|------|---------|---------------|
| UFO event | Fly-by SM, blob shadow, 130 mass gate, spin + sci-fi sfx | `DesertUfo.ts`, `Game.ts`, `AudioManager.ts` |
| Snake | Longer/skinny, 12 segments, S-path, slither wave | `PropFactory.ts`, `AbsorptionSystem.ts`, `objects.json` |
| Borders | 3.5× ground visual, spring pushback, 65% outward speed penalty; mountains disabled for test | `StageManager.ts`, `DustDevil.ts` |
| Camera | Yaw 0° — screen axes align with map | `constants.ts`, `CameraController.ts` |
| Level 1 cutscene | Fullscreen MP4 on desert complete | `UIManager.ts`, `Game.ts`, `public/a_dust_devil_picking_items_up.mp4` |
| Wind gust | Player border impulse, whistle sfx, particles, camera shake | `DustDevil.ts`, `AudioManager.ts`, `ParticleSwirl.ts`, `Game.ts` |
| Animal border wind | Jackrabbit, tortoise, snake, goat pushback + sfx + particles | `PropFactory.ts`, `AbsorptionSystem.ts`, `Game.ts` |
| Tortoise AI | Pop/hide/peek state machine, shell sfx, sweat droplets, shake, speech bubble | `PropFactory.ts`, `AbsorptionSystem.ts`, `AudioManager.ts`, `Game.ts` |
| Desert floor | New sand diff/normal JPGs, high normal scale | `GroundTextureLoader.ts`, `public/textures/desert_*.jpg` |
| Joshua tree | Branching trunk + Fibonacci spike balls | `PropFactory.ts` |

### Modified file index (git)

```
CURRENT_TASK.md
data/objects.json
public/a_dust_devil_picking_items_up.mp4   (untracked)
public/textures/desert_diff.jpg
public/textures/desert_nor.jpg
src/game/AbsorptionSystem.ts
src/game/AudioManager.ts
src/game/CameraController.ts
src/game/DesertUfo.ts
src/game/DustDevil.ts
src/game/Game.ts
src/game/GroundTextureLoader.ts
src/game/ParticleSwirl.ts
src/game/PropFactory.ts
src/game/StageManager.ts
src/ui/UIManager.ts
src/utils/constants.ts
```

---

## Current priorities

From `CURRENT_TASK.md` (update there first):

1. **Play-test mountain stage** — goats, borders, flee, dirt trails, procedural props
2. When satisfied → `npm run package:itch` or backlog items

### Backlog (not blockers)

- Loading screen during ~17 MB asset preload
- Asset compression (smaller JPGs / Draco GLBs)
- Touch/mobile polish or "keyboard required" on itch page
- itch.io upload when Thomas is ready

---

## Verification checklist

| Check | Command / action | When |
|-------|------------------|------|
| Typecheck + build | `npm run build` | Any TS or game logic change |
| Dev smoke | `npm run dev` — title → desert, no console errors | UI/gameplay changes |
| Play-test | Walk affected stages in browser | Before claiming feel is done |
| Relative assets | `npm run preview` | After Vite `base` or public URL changes |
| itch package | `npm run package:itch` | Before itch upload |

---

## Conventions (do not drift)

- **Minimize diff** — match existing Three.js/TS patterns in `src/game/`
- **Data-driven content** — prefer `data/` JSON over hardcoding stages/objects
- **Relative paths** — keep `base: './'` and `publicUrl()` for GitHub Pages + itch.io
- **Large assets** — avoid churn in `public/models/` and `public/textures/` unless intentional
- **Commits** — only when Thomas explicitly asks; use `wip/*` for machine/harness checkpoints
- **Never** force-push `main`, skip hooks, or commit secrets

---

## Session end checklist

Before closing a session on any machine:

1. **Update `CURRENT_TASK.md`** — goal, status, next step, date
2. **Update this file** if architecture, WIP scope, or file index changed materially
3. **Commit + push** to `wip/*` (or `main` if shippable and Thomas requested)
4. Note any **manual play-test results** in `CURRENT_TASK.md` (what felt wrong/right)

Next session: `git pull`, read the three docs above, `git status`, continue.

---

## Known gotchas

- **Port 5173 in use** — Vite picks the next free port (e.g. 5174); check terminal output
- **Border mountains disabled in WIP** — intentional for seamless-border testing; re-enable in `StageManager.ts` when art direction settles
- **MP4 cutscene** — large binary; ensure it is committed or pushed when switching machines
- **Agent OS path** — `C:\Users\thoma\agent-os` may not exist on all clones; this repo's docs are authoritative
- **Live site lags local WIP** — GitHub Pages reflects `main` only; uncommitted work is local-only

---

## Agent-specific notes

| Harness | Session prompt |
|---------|----------------|
| **Cursor (Cody)** | Read `AGENTS.md`, `HANDOFF.md`, `CURRENT_TASK.md`; continue next step |
| **Antigravity** | Same repo folder; same three files |
| **Cloud Cody** | Primary repo = this game; optional secondary = agent-os if available |

Do not rely on prior chat — always read git state and `CURRENT_TASK.md`.
