import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanSourceUrl,
  coversYear,
  documentIssue,
  filterInventoryRows,
  issueSentence,
  planPeriod,
  sourceHost,
  toInventoryRow,
} from "../src/lib/strategy-inventory/public.ts";

// Note shapes copied from analytics.strategy_inventory_documents on 2026-10-30.
const DOWNLOAD_FAILED =
  "URL request failed or did not return a PDF: {'url': 'https://www1.ada.org.rs/wp-content/uploads/Plan-razvoja-Ada-2021-2027.-g.pdf', 'error': 'ReadTimeout(ReadTimeoutError(\"HTTPSConnectionPool(host=\\'www1.ada.org.rs\\', port=443): Read timed out. (read timeout=45)\"))'}";
const NO_TEXT = "PDF downloaded but first pages could not be parsed: {'cache_hit': False, 'page_count': 178, 'pages_parsed': 10, 'chars': 0}";
const PASSED =
  "The document is clearly a local government integrated development plan for Chadiza District. Auto-check: scope=local_sng; matches_local_unit=yes; confidence=0.95. Evidence: CHADIZA DIS";
const REGIONAL_UNNAMED =
  "The document is a regional strategy. Auto-check: scope=regional; matches_local_unit=no; confidence=0.50. Needs human validation: document_scope=regional; matches_local_unit=no; confidence=0.50. Evidence: Стратегија";
const REGIONAL =
  "Development strategy covering Kragujevac and surrounding municipalities. Auto-check: scope=regional; matches_local_unit=yes; confidence=0.85. Needs human validation: document_scope=regional. Evidence: Стратегија";
const NOT_NAMED =
  "Auto-check: scope=local_sng; matches_local_unit=no; confidence=0.50. Needs human validation: matches_local_unit=no; confidence=0.50. Evidence: x";
const OTHER_UNNAMED =
  "A provincial booklet. Auto-check: scope=other; matches_local_unit=no; confidence=0.50. Needs human validation: document_scope=other; matches_local_unit=no; confidence=0.50. Evidenc";
const UNCLEAR =
  "Auto-check: scope=unclear; matches_local_unit=yes; confidence=0.50. Needs human validation: document_scope=unclear; confidence=0.50. Evidence: x";

test("a raw download error becomes a plain sentence with none of the error text", () => {
  assert.equal(documentIssue(DOWNLOAD_FAILED), "download-failed");
  const sentence = issueSentence("download-failed", "municipality");
  assert.doesNotMatch(sentence, /[{}]|error|timeout|https?:/i);
});

test("a parse dump becomes the scanned-PDF sentence", () => {
  assert.equal(documentIssue(NO_TEXT), "no-text");
  assert.doesNotMatch(issueSentence("no-text", "district"), /[{}]|chars|cache/i);
});

test("a note with no source link says so without naming the workbook", () => {
  assert.equal(documentIssue("No source URL was provided in SNG Development Plans.xlsx."), "no-link");
  assert.doesNotMatch(issueSentence("no-link", "district"), /xlsx/i);
});

test("a passing automatic check shows nothing, so the model's assessment never reaches the page", () => {
  assert.equal(documentIssue(PASSED), null);
});

test("a flagged automatic check shows a fixed sentence, never the model's prose or evidence", () => {
  for (const note of [REGIONAL_UNNAMED, REGIONAL, NOT_NAMED, OTHER_UNNAMED, UNCLEAR]) {
    const sentence = issueSentence(documentIssue(note), "municipality");
    assert.doesNotMatch(sentence, /scope=|confidence|Evidence|Стратегија|Kragujevac|provincial/);
  }
});

test("flags resolve in order: regional and unnamed, then regional, then unnamed, then unclear", () => {
  assert.equal(documentIssue(REGIONAL_UNNAMED), "regional-unnamed");
  assert.equal(documentIssue(REGIONAL), "regional");
  assert.equal(documentIssue(NOT_NAMED), "not-named");
  assert.equal(documentIssue(OTHER_UNNAMED), "not-named");
  assert.equal(documentIssue(UNCLEAR), "unclear");
});

test("a note of an unknown shape, or no note, shows nothing", () => {
  assert.equal(documentIssue("Sample inventory row for validation follow-up."), null);
  assert.equal(documentIssue("Some new pipeline message: {'x': 1}"), null);
  assert.equal(documentIssue(""), null);
  assert.equal(documentIssue(null), null);
  assert.equal(documentIssue(undefined), null);
});

test("tracking parameters are dropped and everything else in the link is kept", () => {
  assert.equal(
    cleanSourceUrl("https://example.rs/upload/Plan%20razvoja.pdf?id=7&utm_source=chatgpt.com&UTM_medium=x"),
    "https://example.rs/upload/Plan%20razvoja.pdf?id=7",
  );
  assert.equal(cleanSourceUrl("https://example.rs/plan.pdf?utm_source=chatgpt.com"), "https://example.rs/plan.pdf");
});

test("a missing, malformed, or non-web link gives no link", () => {
  assert.equal(cleanSourceUrl(null), null);
  assert.equal(cleanSourceUrl("  "), null);
  assert.equal(cleanSourceUrl("not a url"), null);
  assert.equal(cleanSourceUrl("javascript:alert(1)"), null);
});

test("the site label drops www and numbered www prefixes", () => {
  assert.equal(sourceHost("https://www.chadizacouncil.gov.zm/a.pdf"), "chadizacouncil.gov.zm");
  assert.equal(sourceHost("https://www1.ada.org.rs/a.pdf"), "ada.org.rs");
  assert.equal(sourceHost("https://euproplus.org.rs/a.pdf"), "euproplus.org.rs");
  assert.equal(sourceHost(null), null);
});

test("a plan's period uses its stated years, then its publication year", () => {
  assert.equal(planPeriod({ valid_from_year: 2020, valid_to_year: 2027, publication_year: 2020 }), "2020 to 2027");
  assert.equal(planPeriod({ valid_from_year: null, valid_to_year: 2025, publication_year: 2013 }), "Until 2025");
  assert.equal(planPeriod({ valid_from_year: null, valid_to_year: null, publication_year: 2019 }), "Published 2019");
  assert.equal(planPeriod({ valid_from_year: null, valid_to_year: null, publication_year: null }), "Not recorded");
});

test("a plan covers a year only when its stated period includes it", () => {
  assert.equal(coversYear({ valid_from_year: 2020, valid_to_year: 2027 }, 2026), true);
  assert.equal(coversYear({ valid_from_year: 2020, valid_to_year: 2025 }, 2026), false);
  assert.equal(coversYear({ valid_from_year: 2027, valid_to_year: 2034 }, 2026), false);
  assert.equal(coversYear({ valid_from_year: null, valid_to_year: null, publication_year: 2024 }, 2026), false);
  assert.equal(coversYear({ valid_from_year: null, valid_to_year: 2030, publication_year: 2022 }, 2026), true);
});

const failedRecord = {
  country_code: "SRB",
  lsg_id: "ada",
  lsg_name: "Ada",
  lsg_name_local: "Ада",
  region_name: "Severno-Banatski",
  document_type: "strategy",
  document_title: "План развоја општине Ада 2021-2027",
  publication_year: null,
  valid_from_year: 2021,
  valid_to_year: 2027,
  source_url: "https://www1.ada.org.rs/Plan.pdf?utm_source=chatgpt.com",
  source_status: "needs_validation",
  language: "unknown",
  translation_status: "unknown",
  parsing_status: "failed",
  ai_ready: false,
  notes: DOWNLOAD_FAILED,
};

test("a table row carries no part of the record's notes, so they stay out of the page payload", () => {
  const row = toInventoryRow(failedRecord, "Needs Validation", "municipality");
  assert.equal("notes" in row, false);
  assert.doesNotMatch(JSON.stringify(row), /ReadTimeout|HTTPSConnectionPool|URL request failed|utm_/);
  assert.equal(row.issue, issueSentence("download-failed", "municipality"));
  assert.equal(row.url, "https://www1.ada.org.rs/Plan.pdf");
});

test("a read document shows no note, even when its notes hold the model's assessment", () => {
  const row = toInventoryRow({ ...failedRecord, source_status: "found", parsing_status: "parsed", notes: PASSED }, "AI-ready", "municipality");
  assert.equal(row.issue, null);
});

test("search finds a unit by its local name or its document title, and the status filter narrows it", () => {
  const rows = [
    toInventoryRow(failedRecord, "Needs Validation", "municipality"),
    toInventoryRow({ ...failedRecord, lsg_id: "bac", lsg_name: "Bač", lsg_name_local: "Бач", document_title: null }, "AI-ready", "municipality"),
  ];
  assert.deepEqual(filterInventoryRows(rows, "Ада", "all").map((row) => row.name), ["Ada"]);
  assert.deepEqual(filterInventoryRows(rows, "2021-2027", "all").map((row) => row.name), ["Ada"]);
  assert.deepEqual(filterInventoryRows(rows, "", "AI-ready").map((row) => row.name), ["Bač"]);
  assert.deepEqual(filterInventoryRows(rows, "timeout", "all"), []);
});
