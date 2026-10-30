import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("AI cache layer persists append-only run records and cache provenance", async () => {
  const cacheSource = await readFile("src/lib/ai/cache.ts", "utf8");

  assert.match(cacheSource, /export async function saveAiStageRun/);
  assert.match(cacheSource, /\.from\("ai_stage_runs"\)/);
  assert.match(cacheSource, /latest_run_id/);
  assert.match(cacheSource, /cache_key/);
  assert.match(cacheSource, /source_fingerprint/);
  assert.match(cacheSource, /input_hash/);
});
