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
**Last committed checkpoint:** `15581f3` — *Polish desert gameplay and add in-repo handoff docs.*  
**Local uncommitted:** UI/input polish (pause menu, mouse steer, blurred title screens) — see below

---

## Controls (current behavior)

| Platform | Move | Other |
|----------|------|-------|
| **Desktop keyboard** | WASD / arrows | Shift = boost (Forest+); Tab = inventory; Esc = pause menu |
| **Desktop mouse** | Click-and-hold on canvas, drag to steer (raycast to ground) | Release to stop; keyboard/touch cancel mouse steer |
| **Mobile / touch** | Invisible drag zone (lower-center); no on-screen joystick | Boost button (Forest+); tap HUD inventory / ⏸ pause |
| **All** | Thought bubble: Space/Enter (desktop) or tap (mobile) | Title mute = global sound on/off; pause menu = music volume only |

Music volume in the pause menu persists in `localStorage` (`dust-devil-music-volume`, `dust-devil-music-muted`). Title-screen “Sound: On/Off” still toggles global mute (all audio).

---

## Architecture (where things live)

```
src/main.ts          → bootstraps Game
src/game/Game.ts     → main loop, state machine, input routing, menu backdrops
src/game/            → gameplay systems (see table below)
src/ui/              → HUD, overlays, pause menu, touch controls
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
| Main loop & stage flow | `Game.ts` | Title → stages → win; menu backdrops; mouse steer; pause; UFO; cutscenes |
| Player | `DustDevil.ts` | Movement, mass, boost, border spring + wind gust pushback |
| Input | `InputManager.ts` | Keyboard, touch vector, mouse hold-steer target; Esc/Tab/dismiss |
| Absorption | `AbsorptionSystem.ts` | Pickup radius, flee/chase AI, animal behaviors, trails |
| Stages | `StageManager.ts` | Ground plane, props, spawn grid, borders, stage transitions |
| Props (procedural) | `PropFactory.ts` | Tortoise, snake, goat, Joshua tree, suburban meshes, etc. |
| Particles | `ParticleSwirl.ts` | Dust/dirt trails, wind gust particles, sweat |
| Audio | `AudioManager.ts` | Music per stage, SFX, music volume/mute (localStorage) |
| Camera | `CameraController.ts` | Isometric follow, shake, axis alignment (`constants.ts`) |
| Desert UFO | `DesertUfo.ts` | Fly-by state machine, shadow, absorption gate at 130 mass |
| Ground textures | `GroundTextureLoader.ts` | Biome diff/normal maps, material tuning |
| Borders | `src/utils/bounds.ts`, `BorderMountains.ts` | Playable inset; mountain ring disabled for seamless-border test |
| UI overlays | `UIManager.ts` | Title / complete / credits with **blurred live level** backdrop; video cutscene |
| Pause menu | `PauseMenu.ts` | Esc overlay — music volume slider, mute, resume |
| HUD | `HUD.ts` | Mass, timer, inventory sign, ⏸ pause button (no bottom hint text) |
| Touch | `TouchControls.ts` | Invisible move zone + boost button (no visible joystick) |
| Story | `StoryManager.ts` | Beat queue from `script.json` |
| Device hints | `src/utils/device.ts` | Desktop/mobile control copy for title screen etc. |

Entry point for new gameplay logic: start in `Game.ts` update loop, then the relevant system.

### Menu / title backdrop flow

- `Game.loadMenuBackdrop(stageId)` — preloads assets, loads level geometry, positions player + camera
- `Game.bootstrapTitleScreen()` — desert backdrop, then `UIManager.showTitle()`
- Render loop calls `updateMenuBackdrop()` for `title`, `stage_intro`, `stage_complete`, `credits` so the 3D scene stays live behind frosted overlays
- `UIManager` screens use `backdrop-filter: blur(16px)` + semi-transparent tint (video cutscene stays solid black)

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

## Shipped on `main` (`15581f3`)

Committed and pushed — desert gameplay polish + handoff docs:

| Area | Summary |
|------|---------|
| UFO event | Fly-by SM, blob shadow, 130 mass gate, spin + sci-fi sfx |
| Snake | Longer/skinny, 12 segments, S-path, slither wave |
| Borders | 3.5× ground visual, spring pushback, 65% outward speed penalty; border mountains disabled |
| Camera | Yaw 0° — screen axes align with map |
| Level 1 cutscene | Fullscreen MP4 on desert complete (`public/a_dust_devil_picking_items_up.mp4`) |
| Wind gust | Player border impulse, whistle sfx, particles, camera shake |
| Animal border wind | Jackrabbit, tortoise, snake, goat pushback + sfx + particles |
| Tortoise AI | Pop/hide/peek, shell sfx, sweat droplets, shake, “May I shell pick you up?” bubble |
| Desert floor | New sand diff/normal JPGs, high normal scale |
| Joshua tree | Branching trunk + Fibonacci spike balls |
| Handoff | `HANDOFF.md`; `AGENTS.md` / `CURRENT_TASK.md` cross-links |

---

## Active WIP (uncommitted as of 2026-06-21)

> Commit to `wip/*` or `main` when Thomas asks. Before switching machines, push or risk losing work.

| Area | Summary | Primary files |
|------|---------|---------------|
| Pause menu | Esc (or HUD ⏸) — music volume slider, mute, resume; pauses gameplay | `PauseMenu.ts`, `Game.ts`, `AudioManager.ts`, `InputManager.ts`, `HUD.ts` |
| Mouse steer | Click-and-hold on canvas steers toward cursor on ground plane | `Game.ts`, `InputManager.ts`, `DustDevil.ts` |
| Touch UI | Joystick visual removed; invisible move zone retained | `TouchControls.ts` |
| HUD | Bottom hint text removed; pause button added | `HUD.ts`, `Game.ts` |
| Blurred menus | Title / stage intro / complete / credits show text over blurred live level | `UIManager.ts`, `Game.ts` (`loadMenuBackdrop`, `bootstrapTitleScreen`) |
| Hints | Title copy: “WASD or click-and-hold to steer” | `device.ts` |

### Modified file index (git)

```
src/game/AudioManager.ts      # music volume + mute persistence
src/game/DustDevil.ts         # getMovementVector(player pos) for steer
src/game/Game.ts              # pause, mouse steer, menu backdrop
src/game/InputManager.ts      # mouse hold-steer, Esc handling
src/ui/HUD.ts                 # pause button, hint removed
src/ui/TouchControls.ts       # invisible move zone
src/ui/UIManager.ts           # backdrop-filter blur overlays
src/utils/device.ts           # control hint strings
src/ui/PauseMenu.ts           # (untracked) new file
```

---

## Current priorities

1. **Play-test mountain** (goats) — borders, flee, dirt trails, procedural props; verify pause menu + mouse steer on desktop
2. **Commit session WIP** when Thomas requests (pause menu, mouse steer, blurred titles)
3. When satisfied → `npm run package:itch` or backlog items

### Backlog (not blockers)

- Loading screen during ~17 MB asset preload (title backdrop load can show empty scene briefly)
- Asset compression (smaller JPGs / Draco GLBs)
- Touch/mobile polish or "keyboard required" on itch page
- itch.io upload when Thomas is ready
- Re-enable border mountains in `StageManager.ts` when art direction settles

---

## Verification checklist

| Check | Command / action | When |
|-------|------------------|------|
| Typecheck + build | `npm run build` | Any TS or game logic change |
| Dev smoke | `npm run dev` — blurred desert title → play → desert, no console errors | UI/gameplay changes |
| Play-test | Walk affected stages; test Esc pause, mouse hold-steer, mobile touch zone | Before claiming feel is done |
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
- **Title load delay** — desert backdrop preloads before title appears; brief empty canvas possible
- **Border mountains disabled** — intentional for seamless-border testing in `StageManager.ts`
- **MP4 cutscene** — large binary; already on `main` at `public/a_dust_devil_picking_items_up.mp4`
- **Global mute vs music mute** — title “Sound: Off” mutes everything; pause menu only affects music volume
- **Mouse steer** — desktop only (`pointerType === 'mouse'`); ignored when pause/inventory/dialogue open
- **Agent OS path** — `C:\Users\thoma\agent-os` may not exist on all clones; this repo's docs are authoritative
- **Git identity** — if commit fails on a new machine, set `user.name` / `user.email` or use author env vars

---

## Agent-specific notes

| Harness | Session prompt |
|---------|----------------|
| **Cursor (Cody)** | Read `AGENTS.md`, `HANDOFF.md`, `CURRENT_TASK.md`; continue next step |
| **Antigravity** | Same repo folder; same three files |
| **Cloud Cody** | Primary repo = this game; optional secondary = agent-os if available |

Do not rely on prior chat — always read git state and `CURRENT_TASK.md`.
