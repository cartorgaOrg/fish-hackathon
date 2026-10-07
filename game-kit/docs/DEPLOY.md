# Deploying your game

Short version:

```bash
npm run package -- my-game
```

That gives you:
- `dist/`: a static website whose `index.html` opens your game directly.
- `dist.zip`: the same thing zipped (about 1 MB), ready for itch.io.

> **Before you publish:** the bundled models are CC0, so they're fine anywhere. Anything you added yourself
> (models, sounds, music, fonts) needs a license that allows publishing, and CC-BY assets need a credit on your
> game page. Fish Audio voices from a free account are for non-commercial use only. Run through the checklist in
> [LICENSING.md](../../LICENSING.md#before-you-submit-or-publish).

Models are **not** inside it. They stream from `https://cdn.manogames.com/fishathon-kit/v1/`, which allows every website, is cached for a year, and is shared by every team's game.

Want a fully self-contained build (offline demo, USB stick, no CDN)? Use `npm run package -- my-game --full`, which bundles all ~95 MB of models.

Always test the build before uploading:

```bash
npm run preview      # serves dist/; open the printed URL and play your game
```

---

## itch.io (recommended for game jams)

1. `npm run package -- my-game`
2. Go to itch.io → *Upload new project*.
3. **Kind of project:** HTML.
4. Upload **`dist.zip`** and tick **"This file will be played in the browser"**.
5. **Embed options:** set the viewport, e.g. 1280 × 720, and tick **Fullscreen button**. Also tick **Mobile friendly** if you kept the touch controls.
6. Save, then view the page and play it once.

## Cloudflare Pages

```bash
npm run package -- my-game
npx wrangler login                                        # once
npx wrangler pages deploy dist --project-name my-game     # → https://my-game.pages.dev
```

## Netlify (drag and drop)

`npm run package -- my-game`, then open https://app.netlify.com/drop and drag the **`dist` folder** onto the page.

## GitHub Pages

1. `npm run package -- my-game`
2. Push the contents of `dist/` to a `gh-pages` branch (for example with `npx gh-pages -d dist`), or upload them with the *Upload Pages artifact* GitHub Action.
3. Repo → Settings → Pages → deploy from the `gh-pages` branch.

The build uses relative paths, so it works under `https://<user>.github.io/<repo>/`.

## The whole kit (all games + launcher)

```bash
npm run build:cdn    # → dist/ with the launcher, every game and the asset browser (≈1 MB)
npm run build        # same, but with all models included (≈95 MB)
```

---

## How it works (for the curious)

- `vite.config.js` sets `base: './'`, so every URL in the build is relative and the folder works anywhere.
- Game code always loads models as `'/assets/<pack>/<file>'`. The engine's `assetUrl()` turns that into:
  - in **dev**: the local file from `public/assets/`;
  - in a **CDN build** (`--mode cdn`, which reads `.env.cdn`): `https://cdn.manogames.com/fishathon-kit/v1/<pack>/<file>`;
  - in a **full build**: the copy inside `dist/assets/`.
- Your own files in `public/` (e.g. `public/sounds/theme.mp3`, `public/models/boat.glb`) are copied into **every** build, CDN or not, so custom assets always ship with your game.

## Troubleshooting a deployed game

| Problem | Fix |
|---|---|
| Blank page, 404s for `/assets/index-….js` | You uploaded the folder *containing* `dist`, or the zip has a `dist/` folder inside. `index.html` must be at the top level of the zip. Use the `dist.zip` from `npm run package`. |
| "Could not load /assets/…" for **your own** models | They must live in `public/`, not under `public/assets/` (that folder is replaced by the CDN in CDN builds). Use e.g. `public/models/`, or build with `--full`. |
| Works locally, models missing online | Open the browser console (F12) and read the failing URL. Check https://cdn.manogames.com/fishathon-kit/v1/catalog.json loads. |
| itch.io shows the game tiny or cropped | Set the embed size in the itch.io project settings, and enable the fullscreen button. |
| No sound | Browsers only allow audio after the first click or key press. Pressing Play in the menu counts. |
