# Signal Portrait cards

Drop the five painted scout portraits here as PNGs — these are the **only** raster
image assets in the project, and they appear **only** on the Command Center ▸
**SIGNAL PORTRAITS** collectible cards (never as in-world sprites).

Expected files (filename = scout id):

- `will.png`    — Will / WILLOW (cyan, signal-wifi tank)
- `chip.png`    — Chip / SPARK (orange sash + crocs)
- `henry.png`   — Henry / ANCHOR (green neckerchief + backpack)
- `cameron.png` — Cameron / ECHO (tie-dye + ripple patch)
- `danny.png`   — Danny / ROCKET (red neckerchief)

Any consistent crop works (cards use a 3:4 frame, `object-fit: cover`). Until a file
exists, its card shows a dashed **ART PENDING** placeholder — the gallery still works.
