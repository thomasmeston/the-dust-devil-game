# Current task — The Little Dust Devil

> **Owner:** Cody (Agent OS coding agent)
> **Handoff:** `agent-os/memory/handoffs/H-001-dust-devil-cody.md`
> **Last updated:** 2026-05-28

## Goal

Continue refining the game before itch.io publish. Gameplay polish and feel take priority over new hosting work (GitHub Pages is live).

## Status

**In progress** — uncommitted local changes from prior session (not yet pushed):

- Border mountain ring; player + flee props clamped to inner bounds
- Jackrabbit sand dust trail when fleeing
- Procedural goat (horns, head, four legs on ground) + dirt trail when fleeing

## Next steps (Thomas-directed)

1. Play-test desert (rabbits) and mountain (goats) — confirm borders and trails feel right
2. Decide whether to commit uncommitted work (include untracked `BorderMountains.ts`, `bounds.ts`)
3. Pick from backlog when ready (loading screen, stages 3–5 music, compression, itch upload)

## Verification (2026-05-28)

- `npm run build` — PASS
- Dev smoke — title → desert loads, no console errors (`npm run dev` at http://localhost:5173)
- Border mountains only appear near map edges (ortho frustum ~±18 from player); walk to perimeter to judge feel

## Verification

```bash
npm run build
npm run dev    # http://localhost:5173
```

Play affected stages in browser before saying done.

## Constraints

- Only commit when Thomas explicitly asks
- Minimize diff; match existing patterns in `src/game/`
- Production build must keep relative paths (`base: './'`, `publicUrl()`)
