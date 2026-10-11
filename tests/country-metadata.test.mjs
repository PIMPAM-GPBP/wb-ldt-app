import assert from "node:assert/strict";
import test from "node:test";

import { getCountryBySlug } from "../src/lib/countries.ts";

test("country metadata includes standardized admin-level guides", () => {
  const expectedLowerNames = new Map([
    ["nepal", "Municipality / local level"],
    ["zambia", "District"],
    ["serbia", "Municipality / city"],
  ]);

  for (const [slug, expectedLowerName] of expectedLowerNames) {
    const country = getCountryBySlug(slug);

    assert.ok(country?.adminLevelGuide);
    assert.equal(country.adminLevelGuide.levels.length, 2);
    assert.equal(country.adminLevelGuide.levels[0].label, "Admin level 1");
    assert.equal(country.adminLevelGuide.levels[1].label, "Admin level 2");
    assert.equal(country.adminLevelGuide.levels[1].name, expectedLowerName);
    assert.ok(country.adminLevelGuide.summary.includes("LDT"));
    assert.ok(country.adminLevelGuide.note.length > 40);
    assert.ok(country.adminLevelGuide.sourceLinks.length >= 1);
  }
});

test("country admin-level guides include requested context caveats", () => {
  const nepal = getCountryBySlug("nepal");
  const serbia = getCountryBySlug("serbia");

  assert.match(nepal?.adminLevelGuide.note ?? "", /77 distinct regions/);
  assert.match(
    nepal?.adminLevelGuide.note ?? "",
    /federal level, provincial level, and local \/ municipal level/,
  );
  assert.match(serbia?.adminLevelGuide.note ?? "", /Belgrade municipalities/);
  assert.match(serbia?.adminLevelGuide.note ?? "", /single Admin level 1 entity/);
  assert.match(serbia?.adminLevelGuide.note ?? "", /Admin level 2 regions/);
});

test("Zambia exposes public country-page metadata and district/province labels", () => {
  const country = getCountryBySlug("zambia");

  assert.equal(country?.adminLabels.lower.singular, "District");
  assert.equal(country?.adminLabels.lower.plural, "Districts");
  assert.equal(country?.adminLabels.higher.singular, "Province");
  assert.equal(country?.adminLabels.higher.plural, "Provinces");
  assert.equal(country?.profile.populationMillions, 22.5);
  assert.equal(country?.profile.areaKm2, 763027);
  assert.equal(country?.profile.strategy.title, "8th National Development Plan");
  assert.equal(
    country?.profile.strategy.url,
    "https://www.cabinet.gov.zm/newsite/wp-content/uploads/2023/12/8NDP-2022-2026.pdf",
  );
  assert.equal(
    country?.planningDocuments.message,
    "Local/SNG planning documents are available for AI-assisted analysis where source links are loaded.",
  );
});

test("Serbia exposes public country-page metadata and municipality/district labels", () => {
  const country = getCountryBySlug("serbia");

  assert.equal(country?.adminLabels.lower.singular, "Municipality");
  assert.equal(country?.adminLabels.lower.plural, "Municipalities");
  assert.equal(country?.adminLabels.higher.singular, "District");
  assert.equal(country?.adminLabels.higher.plural, "Districts");
  assert.equal(country?.profile.populationMillions, 6.7);
  assert.equal(country?.profile.areaKm2, null);
  assert.equal(country?.profile.strategy.title, "Serbia 2030 Strategy");
  assert.equal(
    country?.profile.strategy.url,
    "https://rsjp.gov.rs/wp-content/uploads/Srbija-i-Agenda-2030.-februar-2024.-lat.pdf",
  );
  assert.equal(
    country?.planningDocuments.message,
    "Local/SNG planning documents are available for AI-assisted analysis where source links are loaded.",
  );
});
