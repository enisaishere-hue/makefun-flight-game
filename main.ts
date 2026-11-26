// Sky Courier — Meridian Run: the hand-in program (Node 22, standard library only).
//
// The game is the static files under game/ beside this file, and the entry's
// pictures are the renders under screenshots/. This program hands both in:
// it clears whatever a previous run left in the output folder, copies the
// game and the screenshots across, and writes dossier.json — the summary the
// judge reads — with the kit's own library, vendor/makefun-game.ts.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The program writes the same bytes every time it runs: it copies files,
// never stamps a time into anything, and the dossier is a pure function of
// the files it reads.

import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Empty the output folder's contents, never the folder itself: the grader
// owns the folder, and a stale file from an earlier run must not survive.
mkdirSync(out, { recursive: true });
for (const entry of readdirSync(out)) {
  rmSync(join(out, entry), { recursive: true, force: true });
}

// The game first, then the screenshots beside it.
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The dossier, written by the same library the scorer runs, under the
// gate's own caps: at most 160 KiB of source text, 4 screenshots of at most
// 256 KiB each, 993 files and 48 MiB of game files in all.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// The grader collects the outputs as another user, so every file it reads
// must be world-readable and every folder world-enterable. Only the contents
// of the output folder are touched: the folder itself belongs to the grader,
// and changing its mode as another user is refused (EPERM) and kills the run
// after everything was already written.
function makeReadable(path) {
  const info = statSync(path);
  if (info.isDirectory()) {
    chmodSync(path, 0o755);
    for (const entry of readdirSync(path)) makeReadable(join(path, entry));
  } else {
    chmodSync(path, 0o644);
  }
}
for (const entry of readdirSync(out)) makeReadable(join(out, entry));

console.log(`handed in ${join(out, 'dossier.json')}`);
