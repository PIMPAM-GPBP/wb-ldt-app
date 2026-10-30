import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// The software release history moved from the public page to the repository docs on 2026-10-30;
// these checks guard that nothing was lost in the move.
test("release history keeps its specific versioned sections", async () => {
  const source = await readFile("docs/release-history.md", "utf8");

  assert.match(source, /Versioning guide/);
  assert.match(source, /Major/);
  assert.match(source, /Minor/);
  assert.match(source, /Patch/);
  assert.match(source, /Operational pre-release/);
  assert.match(source, /June 12, 2026/);
  assert.match(source, /Release v1\.4\.4/);
  assert.match(source, /Release v1\.4\.3/);
  assert.match(source, /Release v1\.4\.2/);
  assert.match(source, /Release v1\.4/);
  assert.match(source, /GPB ecosystem UI alignment/);
  assert.match(source, /Resources page/);
  assert.match(source, /core LDT reference materials and country-specific workspaces/);
  assert.match(source, /161 Serbia LSGs/);
  assert.match(source, /approximately 97% Zambia strategy coverage/);
  assert.match(source, /Strategy inventory dashboard/);
  assert.match(source, /AI planning and document context/);
  assert.match(source, /Serbia and Zambia now have live country landing pages/);
  assert.match(source, /Bundled generated analytics JSON files/);
});
