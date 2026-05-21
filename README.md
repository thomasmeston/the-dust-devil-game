# The Little Dust Devil

A low-poly isometric browser game about a tiny dust devil with big city dreams.

Low-poly GLB models are in `public/models/` (authored via Blender MCP). Ground textures are CC0 assets from [Poly Haven](https://polyhaven.com), pulled via Blender MCP into `public/textures/`.

| Stage | Poly Haven texture |
|-------|-------------------|
| Desert | aerial_sand |
| Mountain | aerial_rocks_02 |
| Forest | brown_mud_leaves_01 |
| Suburbs | aerial_grass_rock |
| Downtown | asphalt_01 |

Stage 1 (Desert) soundtrack: `Cowbell Save File.mp3` → `public/audio/desert_theme.mp3`  
Stage 2 (Mountain) soundtrack: `Mossy Pixel Boots.mp3` → `public/audio/mountain_theme.mp3`

## Play

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## Controls

- **WASD / Arrow keys** — Move the dust devil
- **Shift** — Boost (unlocked in Forest stage)
- **Space / Enter / Esc** — Skip typing or close thought bubbles

## Goal

Absorb objects smaller than you to grow. Reach the target mass to open the exit portal (or absorb the skyscraper in the final stage). Earn up to 3 stars by collecting extra mass and finishing quickly.

## Stages

1. Desert — A Little Spin
2. Mountain — Upward Spiral
3. Forest — Rustle & Hum
4. Suburbs — Almost There
5. Downtown — Big Enough
