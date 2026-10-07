# Organizer guide

What to prepare so ~everyone has a working setup in the first 15 minutes, even with bad venue Wi-Fi.

## How much internet does a participant need?

| Step | Download | Needs internet? |
|---|---|---|
| `git clone` (code + all 780 models) | ≈ 40 MB | yes, once |
| `npm install` | ≈ 20 MB | yes, once |
| `npm run dev` and **all** games, the asset browser, editing, `check`, `build` | — | **no** (verified with every network request blocked) |
| `npx playwright install chromium` (only for `npm run smoke`, AI-assistant testing) | ≈ 115 MB | yes, once (optional) |
| Deploying (`npm run package` → itch.io etc.) | upload ≈ 1 MB | yes |
| Playing a deployed game | models stream from `cdn.manogames.com` | yes (players) |

So: **if people clone + install before they arrive, the venue Wi-Fi doesn't matter for building games.**

## 1. Before the event: email participants

> **Fishathon prep (10 minutes, please do this at home):**
> 1. Install **Node.js 20+** from https://nodejs.org (check with `node -v`) and **git**.
> 2. Run:
>    ```
>    git clone <REPO URL> fishathon
>    cd fishathon
>    npm install
>    npx playwright install chromium     # optional, ~115 MB: lets AI assistants test your game
>    npm run dev
>    ```
> 3. Open http://localhost:5173. If you see the game launcher, you're ready. The venue Wi-Fi won't matter.
> 4. Optional: read `docs/GETTING_STARTED.md` and play the sample games.

## 2. Offline kit for people who didn't (USB sticks / local share)

```bash
npm run offline-kit        # → fishathon-offline-kit.zip (≈150 MB)
```

The zip contains:
- the whole repo, with all models;
- an npm package cache with the native build tools for **Windows, macOS and Linux (x64 + arm64)**;
- `OFFLINE-INSTALL.md` with the steps.

Participants unzip it, then run:

```bash
cd fishathon-kit
npm ci --offline --cache ./npm-cache      # installs without internet
npm run dev
```

Put the **Node.js installers** next to it (Windows `.msi`, macOS `.pkg`, from https://nodejs.org), since Node can't be installed via npm.
Rebuild the kit after every change to the repo. It packs the committed files (with a warning if there are uncommitted changes).

Tested: unzipped into an empty folder, `npm ci --offline` with no network access, and all games loading with every internet request blocked.

## 3. Kickoff checklist

- [ ] Repo URL + Wi-Fi password on the screen. USB sticks with the offline kit and Node installers ready.
- [ ] 5-minute demo: launcher → play two samples → asset browser → `npm run new my-game` → change the sky → save → it reloads.
- [ ] Point people at `docs/GETTING_STARTED.md`, and AI-assistant users at `AGENTS.md`.
- [ ] Tell them how to submit: `npm run package -- <game>` → upload `dist.zip` to itch.io (or your jam page). See `docs/DEPLOY.md`.
- [ ] For phone testing they need the **Network** URL from `npm run dev` and the same network. On guest Wi-Fi that blocks device-to-device traffic, a phone hotspot works.

## 4. CDN and assets (maintainers)

- Packs are served from `https://cdn.manogames.com/fishathon-kit/v1/` (R2 bucket `mano-assets`, open read-only CORS). See [ASSETS.md → CDN](ASSETS.md#cdn-cdnmanogamescom).
- Changing or adding packs: `npm run assets` (download) → `npm run catalog` → commit → `npm run assets:upload -- --version v2` → update `.env.cdn`.
- `npm run assets:upload` fetches Wrangler on demand (`npx wrangler@4`) and needs `npx wrangler login` with access to the Mano Games account.
