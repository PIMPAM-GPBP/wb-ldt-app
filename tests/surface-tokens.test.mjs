import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const whiteUtility = /(?<![\w:/-])((?:[a-z-]+:)*bg-white(?:\/[\w.[\]]+)?)(?![\w/-])/g;

async function listSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listSourceFiles(fullPath);
      return /\.(tsx|ts)$/.test(entry.name) ? [fullPath] : [];
    }),
  );
  return files.flat();
}

// globals.css no longer patches white panels for dark mode, so any bg-white renders a white
// panel under light text there. Surfaces come from --surface, --surface-strong, and --surface-muted.
test("src uses surface tokens instead of bg-white", async () => {
  const found = [];
  for (const file of await listSourceFiles("src")) {
    const source = await readFile(file, "utf8");
    for (const [, utility] of source.matchAll(whiteUtility)) found.push(`${file}: ${utility}`);
  }

  assert.deepEqual(found, []);
});

test("src has nothing left for the phase 2 surfaces codemod to rewrite", async () => {
  const run = promisify(execFile)("node", ["scripts/codemods/phase-2-surfaces.mjs", "--check"]);
  await assert.doesNotReject(run, "run `node scripts/codemods/phase-2-surfaces.mjs` and review the diff");
});
