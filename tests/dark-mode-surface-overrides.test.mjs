import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const whiteUtility = /(?<![\w:/-])((?:[a-z-]+:)*bg-white(?:\/\d+)?)(?![\w/-])/g;

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

test("every bg-white utility in src has a dark theme override", async () => {
  const css = (await readFile("src/app/globals.css", "utf8")).replaceAll("\\", "");
  const covered = new Set(
    [...css.matchAll(/\.((?:[a-z-]+:)*bg-white(?:\/\d+)?)/g)].map((match) => match[1]),
  );

  const uncovered = [];
  for (const file of await listSourceFiles("src")) {
    const source = await readFile(file, "utf8");
    for (const [, utility] of source.matchAll(whiteUtility)) {
      // A dark: variant already states its dark theme color.
      if (utility.split(":").includes("dark")) continue;
      if (!covered.has(utility)) uncovered.push(`${file}: ${utility}`);
    }
  }

  assert.deepEqual(uncovered, []);
});
