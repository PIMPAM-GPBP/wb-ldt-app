import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("evidence gap helpers derive missing, sparse, and blocked badge content", async () => {
  const source = await readFile("src/lib/evidence-gaps.ts", "utf8");

  assert.match(source, /export type EvidenceGapBadge/);
  assert.match(source, /deriveScatterEvidenceGap/);
  assert.match(source, /deriveWaterfallEvidenceGap/);
  assert.match(source, /missing/);
  assert.match(source, /sparse/);
  assert.match(source, /blocked/);
});

test("analytics surfaces render evidence gap badges at point of use", async () => {
  const badge = await readFile(
    "src/components/analytics/evidence-gap-badge.tsx",
    "utf8",
  );
  const scatter = await readFile("src/components/analytics/scatter-2d.tsx", "utf8");
  const drivers = await readFile(
    "src/components/analytics/atlas/atlas-profile.tsx",
    "utf8",
  );

  assert.match(badge, /Evidence gap/);
  assert.match(scatter, /deriveScatterEvidenceGap/);
  assert.match(scatter, /EvidenceGapBadge/);
  assert.match(drivers, /deriveWaterfallEvidenceGap/);
  assert.match(drivers, /EvidenceGapBadge/);
});
