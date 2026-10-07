#!/usr/bin/env node
/**
 * Downloads the CC0 asset packs used by this starter kit into public/assets/.
 *
 *   npm run assets            # download everything that's missing
 *   npm run assets -- --force # re-download everything
 *   npm run assets -- kaykit-dungeon quaternius-fish   # only these packs
 *
 * Every pack is pinned to a git commit so the files never change under you.
 * To add a pack: append an entry to PACKS below (see docs/ASSETS.md), run
 * `npm run assets`, then `npm run catalog` to refresh the asset browser.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'assets');

const KAYKIT_LICENSE = 'CC0 1.0 — Kay Lousberg (www.kaylousberg.com)';
const QUATERNIUS_LICENSE = 'CC0 1.0 — Quaternius (quaternius.com)';
const Q_SHOWCASE = { repo: 'trebeljahr/quaternius-showcase', ref: 'e90ffea347393537703ae6f9d73e36492820f5a9' };

/**
 * id        folder name under public/assets/
 * repo/ref  GitHub repo + pinned commit
 * dir       folder inside the repo to copy from
 * include   optional filter (RegExp on the path relative to `dir`)
 * strip     optional RegExp removed from the relative path (flattens folders)
 */
export const PACKS = [
  // ---------------- KayKit (Kay Lousberg) ----------------
  {
    id: 'kaykit-adventurers', name: 'KayKit Character Pack: Adventurers', license: KAYKIT_LICENSE,
    repo: 'KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0', ref: '672074b73ba276876a19e8816ecdc5241817ab47',
    dir: 'addons/kaykit_character_pack_adventures',
    include: /^(Characters\/gltf\/.*\.glb|Assets\/gltf\/.*\.(gltf|bin|png))$/,
    strip: /^(Characters|Assets)\/gltf\//,
    notes: 'Knight, Barbarian, Mage, Rogue, Rogue_Hooded — fully animated (~75 clips each). Weapons/shields/props as separate models.',
  },
  {
    id: 'kaykit-skeletons', name: 'KayKit Character Pack: Skeletons', license: KAYKIT_LICENSE,
    repo: 'KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0', ref: '15b62b9bad122f72926c10fb14d622c73819fa54',
    dir: 'addons/kaykit_character_pack_skeletons',
    include: /^(Characters\/gltf\/.*\.glb|Assets\/gltf\/.*\.(gltf|bin|png))$/,
    strip: /^(Characters|Assets)\/gltf\//,
    notes: 'Skeleton Warrior/Mage/Rogue/Minion — animated enemies, plus their weapons.',
  },
  {
    id: 'kaykit-prototype', name: 'KayKit Prototype Bits', license: KAYKIT_LICENSE,
    repo: 'KayKit-Game-Assets/KayKit-Prototype-Bits-1.0', ref: 'bb159596f4f5106b663741d002c8eb45c80c0f41',
    dir: 'addons/kaykit_prototype_bits/Assets/gltf',
    notes: 'Grey-box level pieces: cubes, slopes, stairs, walls, targets, crates. Great for shooters & platformers.',
  },
  {
    id: 'kaykit-dungeon', name: 'KayKit Dungeon Remastered', license: KAYKIT_LICENSE,
    repo: 'KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0', ref: 'b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07',
    dir: 'addons/kaykit_dungeon_remastered/Assets/gltf',
    notes: 'Modular dungeon: floors, walls, doors, chests, torches, barrels, banners…',
  },
  {
    id: 'kaykit-hexagon', name: 'KayKit Medieval Hexagon Pack', license: KAYKIT_LICENSE,
    repo: 'KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0', ref: '84fa4e91af6a88989be7c99e0891cede11f2ca38',
    dir: 'addons/kaykit_medieval_hexagon_pack/Assets/gltf',
    // skip the green/yellow building recolors to keep the repo small (re-enable if you want 4 factions)
    include: /^(?!buildings\/(green|yellow)\/)(?!.*waterless).*$/,
    notes: 'Hex tiles (grass, water, coast, rivers, roads), buildings in blue/red/neutral, mountains, trees.',
  },

  // ---------------- Quaternius ----------------
  {
    id: 'quaternius-platformer', name: 'Quaternius Ultimate Platformer Pack', license: QUATERNIUS_LICENSE, ...Q_SHOWCASE,
    dir: 'public/glb/platformer_game_pack',
    notes: 'Animated Character (+Gun variant), enemies, coins, gems, hazards, grass cubes, flags, cannons.',
  },
  {
    id: 'quaternius-rts', name: 'Quaternius Medieval RTS Pack', license: QUATERNIUS_LICENSE, ...Q_SHOWCASE,
    dir: 'public/glb/real_time_strategy_pack',
    include: /(FirstAge|^Resource_|^Rock|^Mountain|^Crate|^Barrel|^Logs|^Mine)/,
    notes: 'Age-of-Empires style buildings (TownCenter, Barracks, Houses, Farms…, 3 upgrade levels) and resources (trees, gold, rock).',
  },
  {
    id: 'quaternius-scifi-guns', name: 'Quaternius Modular Sci-Fi Guns', license: QUATERNIUS_LICENSE, ...Q_SHOWCASE,
    dir: 'public/glb/modular_sci_fi_guns_pack',
    include: /^(AR_\d|Pistol_\d|SMG_\d|Sniper_\d|Crossbow_\d|Grenade(_\d)?)\.glb$/,
    notes: 'Complete guns: assault rifles, pistols, SMGs, snipers, crossbows, grenade launchers.',
  },
  {
    id: 'quaternius-enemies', name: 'Quaternius Easy Enemies', license: QUATERNIUS_LICENSE, ...Q_SHOWCASE,
    dir: 'public/glb/easy_enemies_pack',
    notes: 'Animated Frog, Rat, Snake, Spider, Wasp.',
  },
  {
    id: 'quaternius-fish', name: 'Quaternius Cute Fish Pack', license: QUATERNIUS_LICENSE, ...Q_SHOWCASE,
    dir: 'public/glb/cute_fish_pack',
    notes: '40+ animated fish, fishing rods, lures, docks, boat. 🐟',
  },
  {
    id: 'quaternius-nature', name: 'Quaternius Simple Nature', license: QUATERNIUS_LICENSE, ...Q_SHOWCASE,
    dir: 'public/glb/simple_nature_pack',
    notes: 'Low-poly trees, bushes, rocks, grass.',
  },
  {
    id: 'quaternius-weapons', name: 'Quaternius Medieval Weapons', license: QUATERNIUS_LICENSE, ...Q_SHOWCASE,
    dir: 'public/glb/medieval_weapons_pack',
    notes: 'Swords, axes, bows, shields, spears.',
  },
  {
    id: 'quaternius-animals', name: 'Quaternius Animals (subset)', license: QUATERNIUS_LICENSE, ...Q_SHOWCASE,
    dir: 'public/glb/animals_pack',
    include: /^(Wolf|Deer|Fox|Horse|Cow)\.glb$/,
    notes: 'Animated wolf, deer, fox, horse, cow.',
  },
  {
    id: 'quaternius-animation-library', name: 'Quaternius Universal Animation Library', license: QUATERNIUS_LICENSE,
    repo: 'J-Ponzo/gltf-universal-animation-library', ref: 'e24c23cf2a1323488a3faa226ea7ea21f644b73e',
    dir: 'glTF',
    notes: 'Mannequin with a big library of humanoid animations.',
  },
];

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

const treeCache = new Map(); // several packs share one repo -> one API call

async function getTree(repo, ref) {
  const key = `${repo}@${ref}`;
  if (!treeCache.has(key)) {
    const url = `https://api.github.com/repos/${repo}/git/trees/${ref}?recursive=1`;
    const headers = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GitHub API ${res.status} for ${repo} (rate limited? set GITHUB_TOKEN)`);
    treeCache.set(key, (await res.json()).tree);
  }
  return treeCache.get(key);
}

async function listFiles(pack) {
  const tree = await getTree(pack.repo, pack.ref);
  const prefix = pack.dir.replace(/\/$/, '') + '/';
  return tree
    .filter((e) => e.type === 'blob' && e.path.startsWith(prefix))
    .map((e) => ({ src: e.path, rel: e.path.slice(prefix.length), size: e.size }))
    .filter((f) => /\.(glb|gltf|bin|png|jpg)$/i.test(f.rel))
    .filter((f) => !pack.include || pack.include.test(f.rel))
    .map((f) => ({ ...f, rel: pack.strip ? f.rel.replace(pack.strip, '') : f.rel }))
    .map((f) => ({ ...f, rel: f.rel.replace(/\.gltf\.glb$/i, '.glb') })); // KayKit dungeon ships "x.gltf.glb"
}

async function download(pack, file) {
  const dest = path.join(OUT, pack.id, file.rel);
  if (!force && (await exists(dest))) return false;
  const url = `https://raw.githubusercontent.com/${pack.repo}/${pack.ref}/${file.src.split('/').map(encodeURIComponent).join('/')}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
      return true;
    } catch (err) {
      if (attempt >= 3) throw new Error(`${url}: ${err.message}`);
    }
  }
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

async function main() {
for (const pack of PACKS) {
  if (only.length && !only.includes(pack.id)) continue;
  const files = await listFiles(pack);
  let fetched = 0;
  await pool(files, 8, async (f) => { if (await download(pack, f)) fetched++; });
  await fs.writeFile(
    path.join(OUT, pack.id, 'LICENSE.txt'),
    `${pack.name}\nLicense: ${pack.license}\nSource: https://github.com/${pack.repo}/tree/${pack.ref}/${pack.dir}\n`,
  );
  const mb = (files.reduce((s, f) => s + f.size, 0) / 1e6).toFixed(1);
  console.log(`✔ ${pack.id.padEnd(30)} ${String(files.length).padStart(4)} files  ${mb.padStart(5)} MB  (${fetched} downloaded)`);
}
console.log('\nDone. Run `npm run catalog` to refresh the asset catalog / browser.');
}

// only run when executed directly (build-catalog.mjs imports PACKS from this file)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
