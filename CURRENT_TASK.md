# Current task — The Little Dust Devil

> **Owner:** Cody (Agent OS) / Thomas  
> **Handoff (in-repo):** `HANDOFF.md` — architecture, WIP index, session rituals  
> **Handoff (optional):** `agent-os/memory/handoffs/H-001-dust-devil-cody.md`  
> **Agents:** See `AGENTS.md` (Cursor, Antigravity, Cloud Cody)  
> **Last updated:** 2026-06-21

## Goal

Continue refining gameplay feel before itch.io publish. Polish and play-test take priority over new hosting work (GitHub Pages is live).

## Status

**Checkpoint saved** — `main` synced with `origin/main` at `dd94ac2` (2026-05-29).

**Committed and pushed (includes prior local-only work):**

- Border mountain ring + playable bounds (`src/utils/bounds.ts`, `src/game/BorderMountains.ts`, `StageManager.ts`)
- Jackrabbit sand dust trail + goat dirt trail (`ParticleSwirl.ts`, `AbsorptionSystem.ts`, `Game.ts`)
- Procedural goat mesh (horns, legs) + procedural level props (`PropFactory.ts`, `data/objects.json`, level JSON)
- Dust devil vortex visual polish (`DustDevilVortex.ts`, `CameraController.ts`)

**Pending local changes (uncommitted):**

- UFO fly-by state machine, ground blob shadow, 130 mass absorption requirement, preserved size during absorption, rapid spin animation, and custom sci-fi sound effect (`DesertUfo.ts`, `Game.ts`, `CameraController.ts`, `AudioManager.ts`)
- Snake visual, movement, and slither refinements (longer, skinnier, slower, brownish red, 12 segments, S-shape movement path, head-to-tail slither wave propagation) (`objects.json`, `PropFactory.ts`, `AbsorptionSystem.ts`)
- Seamless level borders: Extended ground plane (3.5x visual scale), soft spring pushback force with a 65% outward movement speed penalty, and temporarily disabled border mountains for testing (`StageManager.ts`, `DustDevil.ts`)
- Camera axis alignment: Changed camera yaw to 0 degrees to align control axes and map orientations directly with screen coordinates (`constants.ts`)
- Level 1 Video Cutscene: Added the MP4 video `a_dust_devil_picking_items_up.mp4` to the public folder, and integrated a fullscreen video overlay playing upon Level 1 completion. (`UIManager.ts`, `Game.ts`)
- Wind gust border pushback: Impulse pushback state machine, louder synthesised whistling wind sound effect (0.55 gain), inward-blowing wind particles, and camera shake on impact (`DustDevil.ts`, `AudioManager.ts`, `ParticleSwirl.ts`, `Game.ts`)
- Border wind pushback for Level 1 & 2 animals: Applied wind pushback force, inward-facing rotation, rate-limited and proximity-checked audio triggers, and wind gust particle spawning for Desert animals (`jackrabbit`, `tortoise`, `snake`) and Mountain animals (`goat`) hitting map boundaries. (`PropFactory.ts`, `AbsorptionSystem.ts`, `Game.ts`)
- Tortoise pop-and-hide behavior: Custom state machine for tortoises to hop ("pop") with sound, halt, and retract head parts into shell when chased; peeks back out and wanders once player departs. (`PropFactory.ts`, `AbsorptionSystem.ts`, `Game.ts`)
- Custom tortoise shell retracting sound: Synthesized a descending triangle wave sweep (650Hz to 100Hz) over 0.35s to play whenever a tortoise hides in its shell. (`AudioManager.ts`, `Game.ts`)
- Medium tortoise pupil size: Adjusted the desert tortoise pupil geometry radius from `sx * 0.11` to `sx * 0.13` for improved visibility and cartoon character feel. (`PropFactory.ts`)
- Tortoise sweating and shaking polish: Added high-frequency shivering/shaking to the tortoise's mesh and spawned blue/light-blue rain-shaped sweat droplets that dynamically align with their velocity trajectory while the tortoise is stopped/hiding in its shell. (`PropFactory.ts`, `AbsorptionSystem.ts`, `Game.ts`)
- Desert high-detail sand floor: Generated a seamless cream/golden-beige sand texture with uniform, parallel wind-swept ripples, converted it to JPG, created a Sobel normal map, and updated the ground material to use a white tint and high normal scale (`0.95`) to render realistic wavy dune depth shadows. (`GroundTextureLoader.ts`)
- Tortoise absorption speech bubble: Trigger a speech bubble saying "May I shell pick you up?" when the player absorbs a tortoise, temporarily pausing movement until dismissed. (`Game.ts`)
- 3D Joshua tree modeling: Rebuilt the procedural mesh using a realistic branching cylinder network (lower trunk, left/right main branches, and five sub-branches) and dense, multi-spike yucca "spiky balls" (generated using the Fibonacci sphere algorithm) with 2x larger, prominent spikes on the branch tips. (`PropFactory.ts`)

## Next steps

1. **Play-test mountain** (goats) stage — borders, flee behavior, trails, procedural props
2. When satisfied: consider itch.io packaging (`npm run package:itch`) or backlog items below

## Backlog (optional)

- Loading screen during ~17 MB asset preload
- Asset compression (smaller JPGs / Draco GLBs)
- Touch/mobile polish or "keyboard required" on itch page
- itch.io upload when ready

## Verification (last known good: 2026-05-29)

```bash
npm run build   # PASS
npm run dev     # http://localhost:5173 — title -> desert, no console errors
```

Re-run build + dev smoke after any new changes. Play affected stages before saying done.

## Constraints

- Only commit when Thomas explicitly asks (this checkpoint commit was requested)
- Minimize diff; match existing patterns in `src/game/`
- Production build must keep relative paths (`base: './'`, `publicUrl()`)
