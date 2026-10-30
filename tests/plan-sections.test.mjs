import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { coverageSection, displayQuote, pageLink, salienceOf } from "../src/lib/brief/plan-sections.ts";
import { verifySentence } from "../src/lib/brief/verify.ts";

// Failure modes:
// 1. A component with nothing recorded is called below average and named as a gap.
// 2. A component the plan never mentions is not reported as silent, or a mentioned one is.
// 3. A quote links to a page other than the one it was found on.
// 4. A gap sentence misstates a number or a direction.
// 5. A bullet glyph from a PDF's symbol font shows as an empty box in the brief.
const sheet = JSON.parse(readFileSync("tests/fixtures/brief/fact-sheets/npl/bagmati-bhaktapur-bhaktapur.json", "utf8"));

const commitment = (components, strength = "general", page = 12) => ({
  quote: "The municipality will build a new health post in each ward by 2028.",
  page,
  citedPage: page,
  english: null,
  components,
  kind: "project",
  strength,
  match: "exact",
  similarity: 1,
  planId: "npl-test",
  planUrl: "https://example.test/plan.pdf",
  planTitle: "Test plan",
});

test("a component with nothing recorded is never named as a gap", () => {
  // Emissions has nothing recorded for Bhaktapur; its fixed value must not read as weak.
  assert.equal(sheet.facts["livability.component.emissions.status"].value, "not recorded");
  const { rows, sentences } = coverageSection(sheet, "livability", [], true);
  assert.equal(rows.find((row) => row.component.key === "emissions").scoreStatus, "not measured");
  assert.ok(sentences.every((sentence) => !sentence.text.startsWith("Emissions ")));
});

test("silence and salience follow the plan's commitments", () => {
  assert.equal(salienceOf([]), "silent");
  assert.equal(salienceOf([commitment(["tourism"])]), "low");
  assert.equal(salienceOf([commitment(["tourism"], "specific")]), "medium");
  assert.equal(salienceOf([commitment(["tourism"]), commitment(["tourism"]), commitment(["tourism"], "specific")]), "high");

  // Luminosity per Capita and Agricultural Land are below the national average for Bhaktapur.
  const { sentences } = coverageSection(sheet, "prosperity", [commitment(["agricultural_land"])], true);
  const text = sentences.map((sentence) => sentence.text).join("\n");
  assert.match(text, /Luminosity per Capita scores 13, 42 points below the national average of 55, and the local plan makes no commitment on it\./);
  assert.match(text, /Agricultural Land scores 2, 41\.8 points below the national average of 43\.8; the local plan makes 1 commitment on it\./);
});

test("without a readable plan, coverage is not judged", () => {
  const { sentences } = coverageSection(sheet, "prosperity", [], false);
  assert.deepEqual(sentences.map((sentence) => sentence.text), ["No local plan with readable text is loaded, so coverage cannot be judged yet."]);
});

test("a quote links to the page it was found on", () => {
  assert.equal(pageLink({ ...commitment(["tourism"], "general", 41), citedPage: 40 }), "https://example.test/plan.pdf#page=41");
});

test("every gap sentence passes the verifier against the sheet with plan facts", () => {
  for (const pillar of sheet.pillars) {
    for (const plan of [[], [commitment(pillar.components.map((component) => component.key))]]) {
      const section = coverageSection(sheet, pillar.key, plan, true);
      for (const sentence of section.sentences) {
        assert.deepEqual(verifySentence(section.sheet, sentence).problems, [], sentence.text);
      }
    }
  }
});

test("a private-use bullet glyph inside a quote becomes a bullet the page can draw", () => {
  // From Kalomo's plan, page 77, where Wingdings U+F0FC separates the list items.
  const quote = "\uf0fc Rehabilitation of health facilities and staff houses \uf0fc Recruitment of health staff to meet the Nurse/Doctor to patient ratio. \uf0fc Construction of ablutions blocks";
  assert.equal(
    displayQuote(quote),
    "Rehabilitation of health facilities and staff houses • Recruitment of health staff to meet the Nurse/Doctor to patient ratio. • Construction of ablutions blocks",
  );
});
