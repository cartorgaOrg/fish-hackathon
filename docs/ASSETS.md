# Assets

Everything in `public/assets/` is **CC0**, meaning public domain. You can use it in anything, including commercial work, with no attribution required. Crediting the artists is still kind:

- **KayKit** by Kay Lousberg: [kaylousberg.com](https://kaylousberg.com) · [itch.io](https://kaylousberg.itch.io)
- **Quaternius**: [quaternius.com](https://quaternius.com) · [patreon](https://www.patreon.com/quaternius)

👉 **Browse them visually at [`/assets.html`](http://localhost:5173/assets.html).** You can search, preview animations, hide parts, and copy the loading code.
👉 Every model and animation name is listed in [`ASSET_LIST.md`](ASSET_LIST.md), which is handy for grepping or for pasting into an AI assistant.

## Included packs

| Folder (`/assets/…`) | What | Great for |
|---|---|---|
| `kaykit-adventurers` | Knight, Barbarian, Mage, Rogue, Rogue_Hooded: **76 animations each**. Plus weapons, shields, spellbooks, mugs. | Heroes for any genre |
| `kaykit-skeletons` | Skeleton Warrior / Mage / Rogue / Minion: **95 animations** (incl. rise-from-ground) + weapons | Enemies |
| `kaykit-dungeon` | 200 modular dungeon pieces: floors, walls, doors, stairs, chests, torches, barrels, banners, coins | RPG / dungeon crawler |
| `kaykit-prototype` | Grey-box blocks, slopes, stairs, walls, targets, crates | Shooter arenas, platformers, level blockouts |
| `kaykit-hexagon` | Hex tiles (grass, water, coast, rivers, roads), blue/red/neutral buildings, mountains, trees | Strategy / board games / city builders |
| `quaternius-platformer` | Animated character (+ gun variant), enemies, coins, gems, hearts, grass cubes, hazards, cannons, flags | Platformers |
| `quaternius-rts` | Age-of-Empires-style buildings (Town Center, Barracks, Houses, Farms, Market, Temple, Walls…, 3 levels each) and resources (trees, gold, rocks) | RTS / city builders |
| `quaternius-scifi-guns` | Assault rifles, pistols, SMGs, snipers, crossbows, grenade launchers | Shooters |
| `quaternius-enemies` | Animated frog, rat, snake, spider, wasp | Critters / enemies |
| `quaternius-fish` | **40+ animated fish**, fishing rods (5 levels), lures, docks, boat 🐟 | Fishing / underwater games |
| `quaternius-animals` | Animated wolf, deer, fox, horse, cow | Wildlife, mounts, enemies |
| `quaternius-nature` | Trees, bushes, rocks, grass | Decoration everywhere |
| `quaternius-weapons` | Swords, axes, bows, shields, spears | Loot, props |
| `quaternius-animation-library` | Mannequin with 45 humanoid animations | Animation reference |

Each folder has a `LICENSE.txt` naming its source repo and commit.

## Sizes: how big is everything?

Models come in different scales. These are the native sizes (units are roughly metres), so you know what scale to pass to `assets.model(url, { scale })` or `{ height }`:

| Model | Native size (w × h × d) | Notes |
|---|---|---|
| KayKit characters | ~2.5 tall | Origin at the feet. They match the KayKit dungeon (walls 4 × 4). |
| KayKit skeletons | 2.2–2.6 tall | |
| KayKit dungeon `wall`, `floor_tile_large` | 4 × 4 × 1 / 4 × 0.15 × 4 | 4-unit grid |
| KayKit prototype `Primitive_Cube` / `Floor_Prototype` | 4 × 4 × 4 / 4 × 0.5 × 4 | 4-unit grid, origin at the bottom |
| Quaternius platformer `Character` | ~3.5 tall | Use `{ scale: 0.55 }` for ~2 tall |
| Quaternius platformer cubes | 2 × 2 × 2 | **Centred** on the origin (bottom at y = −1) |
| Quaternius RTS buildings | ~1 wide | **Tiny**: scale by ~5 |
| Quaternius fish | ~4–5 long | `{ scale: 0.2 }` for ~1 m fish |
| Quaternius enemies / animals | 2–7 long | Check in the asset browser |
| Quaternius sci-fi guns | AR ~1.9 long (along +X) | |

The asset browser prints the exact size of any model (`size … (w×h×d)`), and the grid squares are 1 unit.

### Gotchas

- **KayKit characters have every accessory visible.** Use `setVisible(model, { … })` (the asset browser writes it for you).
- **Quaternius animation names carry an armature prefix** (`CharacterArmature|Run`). The `Animator` ignores it, so `anim.play('Run')` works.
- A few Quaternius rigs (`Bee`, `Crab` in the platformer pack) report broken bounds. Use `{ scale }` instead of `{ height }` for them.
- `new THREE.Box3().setFromObject(skinnedModel)` gives wrong sizes for animated models that haven't rendered yet. Use the engine's `getBounds` / `getSize`.

## Adding more packs

All packs are downloaded by `scripts/fetch-assets.mjs` from GitHub, pinned to a commit. To add one:

1. Find a CC0 pack on GitHub with `.glb`/`.gltf` files. Good sources:
   - the [KayKit-Game-Assets](https://github.com/KayKit-Game-Assets) org (Space Base, City Builder, Halloween, Furniture, Restaurant…);
   - [trebeljahr/quaternius-showcase](https://github.com/trebeljahr/quaternius-showcase/tree/main/public/glb), a mirror of ~30 Quaternius packs (sci-fi, cyberpunk, dinosaurs, survival, ultimate space, house interior, medieval village…), which is the mirror this kit already uses.
2. Add an entry to `PACKS` in `scripts/fetch-assets.mjs`:
   ```js
   {
     id: 'quaternius-dinos', name: 'Quaternius Dinosaurs', license: QUATERNIUS_LICENSE, ...Q_SHOWCASE,
     dir: 'public/glb/dinosaurs_pack',
     include: /\.glb$/,        // optional filter
     notes: 'Animated dinosaurs.',
   },
   ```
3. Run `npm run assets -- quaternius-dinos`, then `npm run catalog`.
4. They show up in `/assets.html` and `docs/ASSET_LIST.md`.

### Any other model

Drop `.glb` files anywhere in `public/` (for example `public/models/`) and load them with `game.assets.model('/models/thing.glb')`.
Other great free sources: [poly.pizza](https://poly.pizza), [kenney.nl](https://kenney.nl/assets), [quaternius.com](https://quaternius.com) (full packs including FBX/Blend), [kaylousberg.itch.io](https://kaylousberg.itch.io).

## CDN (cdn.manogames.com)

All packs are also published to Cloudflare R2 (bucket `mano-assets`, served from `https://cdn.manogames.com/fishathon-kit/v1/`).

- **Development** always uses the local copy in `public/assets/`, so it works offline.
- **`npm run build:cdn`** builds games that load models from the CDN and leaves the ~95 MB of assets out of `dist/`. Uploads are tiny, and players' browsers cache the models once for every game. The URL lives in `.env.cdn`.
- **`npm run build`** still bundles everything into `dist/` for fully self-contained builds (offline demos, USB sticks).

Publishing a new asset version (only needed when packs change; requires `npx wrangler login` with access to the Mano Games account):

```bash
npm run assets:upload -- --version v2   # never overwrites v1, so deployed games keep working
# then set VITE_ASSET_BASE=https://cdn.manogames.com/fishathon-kit/v2 in .env.cdn
```

Files are cached for a year (`immutable`), so never re-upload changed files into an existing version: bump it.
The bucket's CORS rules decide which websites may load the models. If a deployed game shows "Could not load …" errors, check that its domain is allowed (`npx wrangler r2 bucket cors list mano-assets`).

### Re-downloading

`public/assets/` is committed so the kit works offline at a hackathon. If it's ever missing or corrupted, run:

```bash
npm run assets            # only downloads missing files
npm run assets -- --force # re-download everything
```

If GitHub rate-limits you, set `GITHUB_TOKEN`.
