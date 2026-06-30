# The Little Dust Devil

A low-poly isometric browser game about a tiny dust devil with big city dreams.

Low-poly GLB models are in `public/models/` (authored via Blender MCP). Ground textures are CC0 assets from [Poly Haven](https://polyhaven.com), pulled via Blender MCP into `public/textures/`.

| Stage | Poly Haven texture |
|-------|-------------------|
| Desert | aerial_sand |
| Mountain | aerial_rocks_04 (mossy alpine rock) |
| Forest | brown_mud_leaves_01 |
| Suburbs | aerial_grass_rock |
| Downtown | asphalt_01 |

| Stage | Source track | Repo path |
|-------|----------------|-----------|
| 1 Desert | Cowbell Save File.mp3 | `public/audio/desert_theme.mp3` |
| 2 Mountain | Mossy Pixel Boots.mp3 | `public/audio/mountain_theme.mp3` |
| 3 Forest | Under Pine Wings.mp3 | `public/audio/forest_theme.mp3` |
| 4 Suburbs | Gravel Morning.mp3 | `public/audio/suburbs_theme.mp3` |
| 5 Downtown | Dust Devil Downtown.mp3 | `public/audio/downtown_theme.mp3` |

## Play

**Online:** https://thomasmeston.github.io/the-dust-devil-game/

**Local dev:**

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

## Deploy

The production build uses relative asset paths (`base: './'`) so the same `dist/` output works on GitHub Pages and itch.io.

### GitHub Pages

Pushes to `main` automatically build and deploy via [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

One-time setup in the repo **Settings → Pages**: set source to **GitHub Actions**.

Live URL: https://thomasmeston.github.io/the-dust-devil-game/

### itch.io

```bash
npm run package:itch
```

This builds the game and creates `dust-devil-itch.zip` with `dist/` contents at the zip root (`index.html`, `assets/`, `models/`, `textures/`, `audio/`).

Upload the zip on itch.io with:

| Setting | Value |
|---------|-------|
| Kind of project | HTML |
| Embed options | **This file will be played in the browser** |
| Viewport size | 1280 × 720, landscape |
| Fullscreen button | Optional |

After uploading, test the embedded player on the itch page (not just a local preview).

## Controls

**Desktop**

- **WASD / Arrow keys** — Move the dust devil
- **Tab** — Inventory
- **Shift** — Boost (unlocked in Forest stage)
- **Space / Enter / Esc** — Skip typing or close thought bubbles

**Mobile browser**

- **Joystick** (lower-left) — Move
- **Boost** (lower-right, Forest+) — Hold to boost
- **Tap Inventory** (top-right) — Collected items
- **Tap dialogue** — Continue story beats

## Goal

Absorb objects smaller than you to grow. Reach the target mass to open the exit portal (or absorb the skyscraper in the final stage). Earn up to 3 stars by collecting extra mass and finishing quickly.

## Stages

1. Desert — A Little Spin
2. Mountain — Upward Spiral
3. Forest — Rustle & Hum
4. Suburbs — Almost There
5. Downtown — Big Enough
