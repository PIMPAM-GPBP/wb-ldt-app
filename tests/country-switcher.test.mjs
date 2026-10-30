import assert from "node:assert/strict";
import test from "node:test";

import { countryHref, currentCountry } from "../src/components/layout/site-links.ts";

// Failure modes:
// 1. Switching country from a map, compare, or brief view drops the reader back on the country page.
// 2. Switching from Serbia's or Zambia's strategy inventory sends a reader to a Nepal page that does not exist.
// 3. A page outside any country, or a slug that only starts like one, is read as a country page.

test("from a workspace view, the menu opens the same view in the other country", () => {
  assert.equal(countryHref("/nepal/analytics", "/zambia"), "/zambia/analytics");
});

test("from a strategy inventory or a country page, the menu opens the other country's page", () => {
  assert.equal(countryHref("/serbia/strategy-inventory", "/nepal"), "/nepal");
  assert.equal(countryHref("/zambia", "/serbia"), "/serbia");
});

test("pages outside a country are not mistaken for one", () => {
  assert.equal(currentCountry("/methodology"), null);
  assert.equal(currentCountry("/nepalese"), null);
  assert.equal(countryHref("/about", "/nepal"), "/nepal");
  assert.equal(currentCountry("/nepal/analytics")?.label, "Nepal");
});
