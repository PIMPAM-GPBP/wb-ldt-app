import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCitationNotes,
  citationRuns,
  resolveCitationLabel,
  safeHttpUrl,
  splitCitations,
} from "../src/components/analytics/ai-citations.ts";

// Reference shapes recorded from analytics.ai_stage_cache for a Nepal unit.
const generated = (label, source) => ({ label, type: "generated", source });
const document = (label, source) => ({ label, type: "document", source });
const web = (label, source, publishedDate = null) => ({
  label,
  type: "web_search",
  source,
  metadata: { publishedDate },
});

const swotReferences = [
  generated("Indicator narrative", "indicator_narrative"),
  document(
    "Bagmati provincial development plan",
    "https://plgsp.gov.np/sites/default/files/2026-02/Bagmati%20Province.pdf",
  ),
  document("Nepal National Plan (Sixteenth Plan)", "supabase://analytics.plan_document_sources/national/a8798de4"),
  web("Annual Progress Report", "http://plgsp.gov.np/files/Annual_Progress_Report.pdf"),
  web("Biratnagar tops, Kathmandu trails", "https://www.myrepublica.nagariknetwork.com/news/biratnagar.html", "2026-02-13T05:01:51.000Z"),
  web("", "https://pppc.bagamati.gov.np/sites/ppc/files/SDG.pdf"),
];

function cited(text, notes) {
  return splitCitations(text, notes).filter((segment) => segment.kind === "cite");
}

test("a trailing [Sources: ...] marker becomes a note number and leaves no bracket text behind", () => {
  const notes = buildCitationNotes("swot_analysis", swotReferences);
  const segments = splitCitations("Luminosity is high [Sources: Indicator narrative].", notes);

  assert.deepEqual(segments, [
    { kind: "text", text: "Luminosity is high" },
    { kind: "cite", numbers: [1], unresolved: [] },
    { kind: "text", text: "." },
  ]);
  const text = segments.filter((segment) => segment.kind === "text").map((segment) => segment.text).join("");
  assert.doesNotMatch(text, /Sources/);
});

test("Hit N counts web references only, so documents and steps listed first do not shift it", () => {
  const notes = buildCitationNotes("swot_analysis", swotReferences);

  assert.equal(notes.find((note) => note.title === "Annual Progress Report")?.number, 4);
  assert.deepEqual(resolveCitationLabel("Hit 1", notes), [4]);
  assert.deepEqual(resolveCitationLabel("Hit 2", notes), [5]);
  assert.deepEqual(resolveCitationLabel("Hit 3", notes), [6]);
  assert.deepEqual(resolveCitationLabel("Hit 9", notes), []);
});

test("Hit N still resolves after a duplicate web reference is merged into one note", () => {
  const duplicate = web("Annual Progress Report", "http://plgsp.gov.np/files/Annual_Progress_Report.pdf");
  const notes = buildCitationNotes("web_context_search", [
    duplicate,
    duplicate,
    web("Second page", "https://example.org/second"),
  ]);

  assert.equal(notes.length, 2);
  assert.deepEqual(resolveCitationLabel("Hit 2", notes), [1]);
  assert.deepEqual(resolveCitationLabel("Hit 3", notes), [2]);
});

test("local and national plan labels resolve to the right document in every country wording", () => {
  const nepal = buildCitationNotes("plan_alignment", swotReferences.slice(1, 3));
  assert.deepEqual(resolveCitationLabel("Provincial plan", nepal), [1]);
  assert.deepEqual(resolveCitationLabel("Local/SNG plan", nepal), [1]);
  assert.deepEqual(resolveCitationLabel("National plan", nepal), [2]);

  // Serbia: the national label has no "national" in it, only the stored source path does.
  const serbia = buildCitationNotes("plan_alignment", [
    document("Beograd-Barajevo local development plan", "https://www.beoland.com/plan.pdf"),
    document("Serbia 2030 Strategy", "supabase://analytics.plan_document_sources/SRB/national/a901"),
  ]);
  assert.deepEqual(resolveCitationLabel("National plan", serbia), [2]);
  assert.deepEqual(resolveCitationLabel("Local/SNG plan", serbia), [1]);

  // No text signal at all: the pipeline lists the local plan first.
  const unmarked = buildCitationNotes("swot_analysis", [
    document("Plan A", "https://a.example/plan.pdf"),
    document("Plan B", "https://b.example/plan.pdf"),
  ]);
  assert.deepEqual(resolveCitationLabel("Local plan", unmarked), [1]);
  assert.deepEqual(resolveCitationLabel("National plan", unmarked), [2]);
});

test("one marker never lists the same note twice and sorts numbers ascending", () => {
  const notes = buildCitationNotes("swot_analysis", swotReferences);
  const [only] = cited(
    "Claim [Sources: Web context; Indicator narrative; Hit 1; Optional external web context].",
    notes,
  );

  assert.deepEqual(only.numbers, [1, 4, 5, 6]);
  assert.deepEqual(only.unresolved, []);
});

test("a label that matches no note stays visible instead of being dropped", () => {
  const swotNotes = buildCitationNotes("swot_analysis", swotReferences);
  const [unknown] = cited("Claim [Sources: Indicator narrative; Ministry briefing].", swotNotes);
  assert.deepEqual(unknown.numbers, [1]);
  assert.deepEqual(unknown.unresolved, ["Ministry briefing"]);

  // In the narrative stage "Municipality data 2025" is the indicator series, not a local plan.
  const narrativeNotes = buildCitationNotes("indicator_narrative", [
    { label: "Prosperity Score indicator series", type: "indicator_series", source: "supabase" },
  ]);
  const [data] = cited("Claim [Sources: Municipality data 2025].", narrativeNotes);
  assert.deepEqual(data.numbers, [1]);
  assert.deepEqual(data.unresolved, []);

  assert.deepEqual(cited("Claim [Sources: ].", narrativeNotes), []);
});

test("notes always have a title, long titles are shortened, and duplicates share a number", () => {
  const longTitle = `${"Very long page title ".repeat(12)}\n | Site name`;
  const notes = buildCitationNotes("web_context_search", [
    web("", "https://pppc.bagamati.gov.np/sites/ppc/files/SDG.pdf"),
    web("   ", "not a url"),
    web(longTitle, "https://example.org/long"),
    web(longTitle, "https://example.org/long"),
  ]);

  assert.equal(notes.length, 3);
  assert.equal(notes[0].title, "pppc.bagamati.gov.np");
  assert.equal(notes[1].title, "Untitled web page");
  assert.ok(notes[2].title.length <= 140);
  assert.ok(notes[2].title.endsWith("…"));
  assert.ok(notes[2].fullTitle.length > 140);
  assert.ok(!notes[2].fullTitle.includes("\n"));
  assert.deepEqual(
    notes.map((note) => note.number),
    [1, 2, 3],
  );
});

test("only http and https sources become links", () => {
  const notes = buildCitationNotes("web_context_search", [
    web("Page", "https://www.example.org/a?b=1"),
    web("Script", "javascript:alert(1)"),
    web("File", "file:///etc/passwd"),
    document("Local file", "/Users/someone/data/national-plan.pdf"),
    document("Stored copy", "supabase://analytics.plan_document_sources/national/a8798de4"),
  ]);

  assert.deepEqual(
    notes.map((note) => note.href),
    ["https://www.example.org/a?b=1", null, null, null, null],
  );
  assert.equal(notes[0].host, "example.org");
  assert.equal(safeHttpUrl("HTTP://example.org")?.protocol, "http:");
  assert.equal(safeHttpUrl("data:text/html,x"), null);
});

test("a later stage that lists only earlier steps still points plan and data labels at the step that read them", () => {
  // Recommendations list Indicator narrative, Plan alignment, SWOT and web hits, but no plan documents.
  const notes = buildCitationNotes("investment_recommendations", [
    generated("Indicator narrative", "indicator_narrative"),
    generated("Plan alignment", "plan_alignment"),
    generated("SWOT analysis", "swot_analysis"),
    web("Page", "https://example.org/p"),
  ]);

  assert.deepEqual(resolveCitationLabel("Provincial plan", notes), [2]);
  assert.deepEqual(resolveCitationLabel("National plan", notes), [2]);
  assert.deepEqual(resolveCitationLabel("Municipality data 2025", notes), [1]);
  assert.deepEqual(resolveCitationLabel("Optional external web context", notes), [4]);
  // The fallback never fires when the plan documents are listed: SWOT cites them directly.
  const swotNotes = buildCitationNotes("swot_analysis", swotReferences);
  assert.deepEqual(resolveCitationLabel("National plan", swotNotes), [3]);
});

test("three or more consecutive notes collapse to a range and pairs stay separate", () => {
  assert.deepEqual(citationRuns([1, 2]), [
    { from: 1, to: 1 },
    { from: 2, to: 2 },
  ]);
  assert.deepEqual(citationRuns([1, 4, 5, 6, 7, 8]), [
    { from: 1, to: 1 },
    { from: 4, to: 8 },
  ]);
  assert.deepEqual(citationRuns([2, 3, 4, 7, 9, 10]), [
    { from: 2, to: 4 },
    { from: 7, to: 7 },
    { from: 9, to: 9 },
    { from: 10, to: 10 },
  ]);
  assert.deepEqual(citationRuns([]), []);
});
