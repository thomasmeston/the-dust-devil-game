# Current task — The Little Dust Devil

> **Owner:** Cody (Agent OS) / Thomas  
> **Handoff:** `agent-os/memory/handoffs/H-001-dust-devil-cody.md`  
> **Agents:** See `AGENTS.md` (Cursor, Antigravity, Cloud Cody)  
> **Last updated:** 2026-06-07

## Goal

Continue refining gameplay feel before itch.io publish. Polish and play-test take priority over new hosting work (GitHub Pages is live).

## Status

**Checkpoint saved** — `main` synced with `origin/main` at `dd94ac2` (2026-05-29).

**Committed and pushed (includes prior local-only work):**

- Border mountain ring + playable bounds (`src/utils/bounds.ts`, `src/game/BorderMountains.ts`, `StageManager.ts`)
- Jackrabbit sand dust trail + goat dirt trail (`ParticleSwirl.ts`, `AbsorptionSystem.ts`, `Game.ts`)
- Procedural goat mesh (horns, legs) + procedural level props (`PropFactory.ts`, `data/objects.json`, level JSON)
- Dust devil vortex visual polish (`DustDevilVortex.ts`, `CameraController.ts`)

**Added in checkpoint commit (2026-06-07):**

- `AGENTS.md` — harness-neutral handoff for Cursor, Antigravity, and Cloud Cody
- Refreshed `CURRENT_TASK.md` (this file)

## Next steps

1. **Play-test desert** (rabbits) and **mountain** (goats) — borders, flee behavior, trails, procedural props
2. Note any feel tweaks in a short bullet list here or fix inline
3. When satisfied: consider itch.io packaging (`npm run package:itch`) or backlog items below

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
