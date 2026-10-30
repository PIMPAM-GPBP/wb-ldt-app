import assert from "node:assert/strict";
import test from "node:test";

import { getCountryBySlug } from "../src/lib/countries.ts";
import { getCountryWorkspaceLinks } from "../src/lib/country-landing-actions.ts";

// Failure modes:
// 1. A country page links to a strategy inventory page that does not exist (Nepal has none).
// 2. Serbia or Zambia lose the link to the strategy inventory they do have.

const links = (slug) => getCountryWorkspaceLinks(getCountryBySlug(slug)).map((link) => [link.label, link.href]);

test("Serbia and Zambia link to their strategy inventory beside the map, compare, and brief views", () => {
  for (const slug of ["serbia", "zambia"]) {
    assert.deepEqual(links(slug), [
      ["Open the map", `/${slug}/analytics`],
      ["Compare", `/${slug}/analytics?tab=multi`],
      ["Planning briefs", `/${slug}/analytics?tab=brief`],
      ["Strategy inventory", `/${slug}/strategy-inventory`],
    ]);
  }
});

test("Nepal has no strategy inventory, so its page does not link to one", () => {
  assert.ok(!links("nepal").some(([label]) => label === "Strategy inventory"));
});
