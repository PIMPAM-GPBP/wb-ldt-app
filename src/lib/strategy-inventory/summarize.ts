import type {
  ExpectedLsg,
  ReadinessCategory,
  ReadinessStatusCount,
  StrategyInventoryRecord,
  StrategyInventorySummary,
} from "./types.ts";

export const READINESS_CATEGORIES: ReadonlyArray<ReadinessCategory> = [
  "AI-ready",
  "Found / Not Parsed",
  "Needs Translation",
  "Needs Validation",
  "Missing",
];

function lsgKey(value: Pick<StrategyInventoryRecord, "lsg_id" | "lsg_name"> | ExpectedLsg) {
  return (value.lsg_id || value.lsg_name).trim().toLowerCase();
}

function hasDocumentSource(record: StrategyInventoryRecord) {
  return record.source_status === "found" || record.source_status === "needs_validation";
}

function isSerbianLanguageException(record: StrategyInventoryRecord) {
  return record.country_code === "SRB" && record.language === "sr";
}

function needsTranslation(record: StrategyInventoryRecord) {
  if (isSerbianLanguageException(record)) {
    return false;
  }

  return (
    record.translation_status === "needs_translation" ||
    record.translation_status === "partial"
  );
}

function needsValidation(record: StrategyInventoryRecord) {
  return (
    record.source_status === "needs_validation" ||
    record.parsing_status === "failed" ||
    record.parsing_status === "needs_review"
  );
}

function isAiReadyRecord(record: StrategyInventoryRecord) {
  return (
    record.source_status === "found" &&
    record.parsing_status === "parsed" &&
    (record.ai_ready || isSerbianLanguageException(record))
  );
}

function uniqueLsgs(records: StrategyInventoryRecord[]) {
  const seen = new Set<string>();
  const lsgs: ExpectedLsg[] = [];

  for (const record of records) {
    const key = lsgKey(record);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    lsgs.push({
      lsg_id: record.lsg_id,
      lsg_name: record.lsg_name,
      region_name: record.region_name,
    });
  }

  return lsgs;
}

function sortPublicationYearCounts(counts: Map<string, number>) {
  return [...counts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((left, right) => {
      if (left.year === "Unknown") return 1;
      if (right.year === "Unknown") return -1;
      return Number(left.year) - Number(right.year);
    });
}

function latestLastUpdated(records: StrategyInventoryRecord[]) {
  const dates = records
    .map((record) => record.last_updated)
    .filter((date): date is string => Boolean(date))
    .sort((left, right) => left.localeCompare(right));

  return dates.at(-1) ?? null;
}

export function getReadinessCategory(record: StrategyInventoryRecord): ReadinessCategory {
  if (record.source_status === "missing" || record.source_status === "not_available") {
    return "Missing";
  }

  if (needsValidation(record)) {
    return "Needs Validation";
  }

  if (isAiReadyRecord(record)) {
    return "AI-ready";
  }

  if (needsTranslation(record)) {
    return "Needs Translation";
  }

  return "Found / Not Parsed";
}

export function getStrategyInventorySummary(
  records: StrategyInventoryRecord[],
  expectedLsgs: number | ExpectedLsg[],
): StrategyInventorySummary {
  const documentRecords = records.filter(hasDocumentSource);
  const coveredKeys = new Set(documentRecords.map(lsgKey));
  const explicitMissingLsgs = uniqueLsgs(records.filter((record) => !hasDocumentSource(record)));
  const expected_lsgs = Array.isArray(expectedLsgs) ? expectedLsgs.length : expectedLsgs;
  const missing_lsgs = Array.isArray(expectedLsgs)
    ? expectedLsgs.filter((lsg) => !coveredKeys.has(lsgKey(lsg)))
    : explicitMissingLsgs;
  const unlisted_missing_lsg_count = Array.isArray(expectedLsgs)
    ? 0
    : Math.max(0, expected_lsgs - coveredKeys.size - explicitMissingLsgs.length);
  const publicationYearCounts = new Map<string, number>();

  for (const record of documentRecords) {
    const year = Number.isFinite(record.publication_year)
      ? String(record.publication_year)
      : "Unknown";
    publicationYearCounts.set(year, (publicationYearCounts.get(year) ?? 0) + 1);
  }

  const statusCounts = new Map<ReadinessCategory, number>(
    READINESS_CATEGORIES.map((category) => [category, 0]),
  );

  for (const record of records) {
    const category = getReadinessCategory(record);
    statusCounts.set(category, (statusCounts.get(category) ?? 0) + 1);
  }

  const explicitMissingCount = explicitMissingLsgs.length;
  const totalMissingCount = missing_lsgs.length + unlisted_missing_lsg_count;
  statusCounts.set("Missing", Math.max(statusCounts.get("Missing") ?? 0, totalMissingCount));

  const status_breakdown: ReadinessStatusCount[] = READINESS_CATEGORIES.map((category) => ({
    category,
    count:
      category === "Missing"
        ? Math.max(statusCounts.get(category) ?? 0, explicitMissingCount)
        : statusCounts.get(category) ?? 0,
  }));

  return {
    expected_lsgs,
    lsgs_with_any_document: coveredKeys.size,
    coverage_rate: expected_lsgs > 0 ? coveredKeys.size / expected_lsgs : 0,
    total_documents_found: documentRecords.length,
    strategies_found: documentRecords.filter((record) => record.document_type === "strategy").length,
    budgets_found: documentRecords.filter((record) => record.document_type === "budget").length,
    ai_ready_documents: records.filter(isAiReadyRecord).length,
    needs_translation: records.filter(needsTranslation).length,
    needs_validation: records.filter(needsValidation).length,
    missing_lsgs,
    unlisted_missing_lsg_count,
    publication_year_counts: sortPublicationYearCounts(publicationYearCounts),
    unknown_year_count: publicationYearCounts.get("Unknown") ?? 0,
    status_breakdown,
    latest_last_updated: latestLastUpdated(records),
  };
}
