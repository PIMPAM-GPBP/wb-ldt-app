import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("country trust model covers release, boundary, plan, and caveat status", async () => {
  const source = await readFile("src/lib/country-trust.ts", "utf8");

  assert.match(source, /export type CountryTrustModel/);
  assert.match(source, /export function buildCountryTrustModel/);
  assert.match(source, /Boundary quality/);
  assert.match(source, /Local plans/);
  assert.match(source, /caveats/);
  // Phase 2 removed AI generation, so the model no longer reports an AI readiness it cannot have.
  assert.doesNotMatch(source, /AI readiness/);
});

test("country page shows the trust facts and caveats under About this data", async () => {
  const page = await readFile("src/components/country/country-landing-page.tsx", "utf8");

  assert.match(page, /buildCountryTrustModel/);
  assert.match(page, /About this data/);
  assert.match(page, /trust\?\.items\.map/);
  assert.match(page, /trust\.caveats\.map/);
});
