import assert from "node:assert/strict";
import test from "node:test";

import {
  getStrategyInventoryDisplaySummary,
  getReadinessCategory,
  getStrategyInventorySummary,
} from "../src/lib/strategy-inventory/summarize.ts";

const records = [
  {
    country_code: "SRB",
    lsg_id: "belgrade-barajevo",
    lsg_name: "Belgrade-Barajevo",
    region_name: "Belgrade",
    document_type: "strategy",
    publication_year: 2023,
    source_status: "found",
    language: "sr_en",
    translation_status: "translated",
    parsing_status: "parsed",
    ai_ready: true,
    source_url: "https://example.com/barajevo-strategy.pdf",
    last_updated: "2026-06-11",
  },
  {
    country_code: "SRB",
    lsg_id: "ada",
    lsg_name: "Ada",
    region_name: "North Banat",
    document_type: "budget",
    publication_year: 2024,
    source_status: "found",
    language: "sr",
    translation_status: "needs_translation",
    parsing_status: "not_started",
    ai_ready: false,
    source_url: "https://example.com/ada-budget.pdf",
    last_updated: "2026-06-10",
  },
  {
    country_code: "SRB",
    lsg_id: "arilje",
    lsg_name: "Arilje",
    region_name: "Zlatibor",
    document_type: "strategy",
    publication_year: null,
    source_status: "needs_validation",
    language: "sr",
    translation_status: "partial",
    parsing_status: "needs_review",
    ai_ready: false,
    source_url: "https://example.com/arilje-strategy.pdf",
    last_updated: "2026-06-09",
  },
  {
    country_code: "SRB",
    lsg_id: "backa-palanka",
    lsg_name: "Backa Palanka",
    region_name: "South Backa",
    document_type: "strategy",
    publication_year: null,
    source_status: "missing",
    language: "unknown",
    translation_status: "unknown",
    parsing_status: "not_started",
    ai_ready: false,
    source_url: null,
    last_updated: "2026-06-08",
  },
];

test("readiness category follows the dashboard blocking order", () => {
  assert.equal(getReadinessCategory(records[0]), "AI-ready");
  assert.equal(getReadinessCategory(records[1]), "Found / Not Parsed");
  assert.equal(getReadinessCategory(records[2]), "Needs Validation");
  assert.equal(getReadinessCategory(records[3]), "Missing");
  assert.equal(
    getReadinessCategory({
      ...records[1],
      country_code: "ZMB",
      language: "en",
    }),
    "Needs Translation",
  );
  assert.equal(
    getReadinessCategory({
      ...records[1],
      translation_status: "not_required",
      parsing_status: "failed",
    }),
    "Needs Validation",
  );
  assert.equal(
    getReadinessCategory({
      ...records[1],
      translation_status: "not_required",
      parsing_status: "not_started",
    }),
    "Found / Not Parsed",
  );
});

test("Serbian parsed documents are AI-ready without translation", () => {
  const serbianDocument = {
    ...records[1],
    country_code: "SRB",
    language: "sr",
    translation_status: "needs_translation",
    parsing_status: "parsed",
    ai_ready: false,
  };

  assert.equal(getReadinessCategory(serbianDocument), "AI-ready");

  const summary = getStrategyInventorySummary([serbianDocument], 1);
  assert.equal(summary.ai_ready_documents, 1);
  assert.equal(summary.needs_translation, 0);
  assert.equal(summary.needs_validation, 0);
  assert.deepEqual(summary.status_breakdown, [
    { category: "AI-ready", count: 1 },
    { category: "Found / Not Parsed", count: 0 },
    { category: "Needs Translation", count: 0 },
    { category: "Needs Validation", count: 0 },
    { category: "Missing", count: 0 },
  ]);
});

test("blocked count is based on exclusive readiness categories", () => {
  const overlappingRecord = {
    ...records[2],
    country_code: "SRB",
    language: "sr",
    translation_status: "needs_translation",
    parsing_status: "needs_review",
    ai_ready: false,
  };
  const summary = getStrategyInventorySummary([overlappingRecord], 1);
  const blockedCount =
    (summary.status_breakdown.find((entry) => entry.category === "Needs Translation")?.count ?? 0) +
    (summary.status_breakdown.find((entry) => entry.category === "Needs Validation")?.count ?? 0);

  assert.equal(summary.needs_translation, 0);
  assert.equal(summary.needs_validation, 1);
  assert.equal(blockedCount, 1);
});

test("strategy inventory summary separates LSG coverage from document counts", () => {
  const summary = getStrategyInventorySummary(records, [
    { lsg_id: "belgrade-barajevo", lsg_name: "Belgrade-Barajevo" },
    { lsg_id: "ada", lsg_name: "Ada" },
    { lsg_id: "arilje", lsg_name: "Arilje" },
    { lsg_id: "backa-palanka", lsg_name: "Backa Palanka" },
    { lsg_id: "cacak", lsg_name: "Cacak" },
  ]);

  assert.equal(summary.expected_lsgs, 5);
  assert.equal(summary.lsgs_with_any_document, 3);
  assert.equal(summary.coverage_rate, 0.6);
  assert.equal(summary.total_documents_found, 3);
  assert.equal(summary.strategies_found, 2);
  assert.equal(summary.budgets_found, 1);
  assert.equal(summary.ai_ready_documents, 1);
  assert.equal(summary.needs_translation, 0);
  assert.equal(summary.needs_validation, 1);
  assert.deepEqual(summary.publication_year_counts, [
    { year: "2023", count: 1 },
    { year: "2024", count: 1 },
    { year: "Unknown", count: 1 },
  ]);
  assert.equal(summary.unknown_year_count, 1);
  assert.deepEqual(
    summary.missing_lsgs.map((lsg) => lsg.lsg_name),
    ["Backa Palanka", "Cacak"],
  );
  assert.equal(summary.unlisted_missing_lsg_count, 0);
});

test("strategy inventory summary supports an expected-count-only universe", () => {
  const summary = getStrategyInventorySummary(records, 148);

  assert.equal(summary.expected_lsgs, 148);
  assert.equal(summary.lsgs_with_any_document, 3);
  assert.equal(summary.missing_lsgs.length, 1);
  assert.equal(summary.unlisted_missing_lsg_count, 144);
});

test("strategy inventory display summary supports temporary placeholder overrides", () => {
  const summary = getStrategyInventoryDisplaySummary(records, 148, {
    expected_lsgs: 161,
    lsgs_with_any_document: 152,
    coverage_rate: 152 / 161,
    total_documents_found: 152,
    ai_ready_documents: 152,
    needs_translation: 0,
    needs_validation: 0,
    status_breakdown: [
      { category: "AI-ready", count: 152 },
      { category: "Found / Not Parsed", count: 0 },
      { category: "Needs Translation", count: 0 },
      { category: "Needs Validation", count: 0 },
      { category: "Missing", count: 9 },
    ],
  });

  assert.equal(summary.expected_lsgs, 161);
  assert.equal(summary.lsgs_with_any_document, 152);
  assert.equal(summary.coverage_rate, 152 / 161);
  assert.equal(summary.total_documents_found, 152);
  assert.equal(summary.ai_ready_documents, 152);
  assert.equal(summary.needs_translation, 0);
  assert.equal(summary.needs_validation, 0);
  assert.deepEqual(summary.status_breakdown, [
    { category: "AI-ready", count: 152 },
    { category: "Found / Not Parsed", count: 0 },
    { category: "Needs Translation", count: 0 },
    { category: "Needs Validation", count: 0 },
    { category: "Missing", count: 9 },
  ]);
});
