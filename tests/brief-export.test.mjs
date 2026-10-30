import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BRIEF_STATUS, DATA_NOTE, buildBriefMarkdown } from "../src/lib/brief/document.ts";
import { renderSectionOne } from "../src/lib/brief/section-one.ts";

// Failure mode: a downloaded brief leaves the site without the line that says how it was
// written, the data edition it describes, or the note that it gives bands, not ranks.
const sheet = JSON.parse(readFileSync("tests/fixtures/brief/fact-sheets/npl/bagmati-bhaktapur-bhaktapur.json", "utf8"));
const brief = {
  factSheetVersion: sheet.version,
  sheetId: sheet.id,
  country: sheet.country,
  release: sheet.release,
  unit: sheet.unit,
  pillars: sheet.pillars.map((pillar) => ({ key: pillar.key, label: pillar.label, sentences: renderSectionOne(sheet, pillar.key) })),
  facts: sheet.facts,
  plans: { source: "higher unit", unitLabel: "Province", unitName: "Bagmati", local: [], national: [{ title: "Sixteenth Plan", link: "https://example.test/plan.pdf", documentType: null }] },
};

test("the Markdown export keeps the status, edition, every sentence, and the closing notes", () => {
  const markdown = buildBriefMarkdown(brief, "https://ldt.example/nepal/analytics?tab=brief");

  assert.ok(markdown.includes(BRIEF_STATUS));
  assert.ok(markdown.includes(`Data edition 2025 (npl-2025-v1), fact sheet version ${sheet.version}`));
  assert.ok(markdown.includes("Source: https://ldt.example/nepal/analytics?tab=brief"));
  for (const pillar of brief.pillars) {
    assert.ok(markdown.includes(`### ${pillar.label}`));
    for (const sentence of pillar.sentences) assert.ok(markdown.includes(sentence.text), sentence.text);
  }
  assert.ok(markdown.includes("in a fifth of Nepal's municipalities rather than giving a rank"));
  assert.ok(markdown.includes(DATA_NOTE));
  assert.ok(markdown.includes("Local plans in Nepal come from the province"));
  assert.ok(markdown.includes("- None listed."));
  assert.ok(markdown.includes("- [Sixteenth Plan](https://example.test/plan.pdf)"));
});

test("the export carries reviewed plan sections, and only the status line of the rest", () => {
  const reviewed = {
    pillar: "prosperity",
    label: "Prosperity Score",
    visibility: { kind: "reviewed", reviewedAt: "2026-11-02T10:00:00Z" },
    commitments: [{ component: "Tourism", total: 1, items: [{ quote: "Develop the Kapopo heritage site by 2027.", english: null, page: 41, link: "https://example.test/plan.pdf#page=41", kind: "project", strength: "specific" }] }],
    coverage: { rows: [], sentences: [{ kind: "gaps", parts: [], text: "Tourism scores 13, 42 points below the national average of 55; the local plan makes 1 commitment on it.", factIds: [] }], facts: {} },
  };
  const inReview = { pillar: "livability", label: "Livability Score", visibility: { kind: "in review" }, commitments: [], coverage: { rows: [], sentences: [], facts: {} } };
  const markdown = buildBriefMarkdown({ ...brief, planSections: [reviewed, inReview] });

  assert.match(markdown, /a model picked the quotes, and a reviewer checked them/);
  assert.ok(!markdown.includes(BRIEF_STATUS));
  assert.ok(markdown.includes('- "Develop the Kapopo heritage site by 2027." ([page 41](https://example.test/plan.pdf#page=41))'));
  assert.ok(markdown.includes("Reviewed on 2 November 2026."));
  assert.ok(markdown.includes("In review. This section appears once a reviewer has checked it."));
});
