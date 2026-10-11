export type StrategyDocumentType = "strategy" | "budget" | "plan" | "other";

export type StrategySourceStatus =
  | "found"
  | "missing"
  | "not_available"
  | "needs_validation";

export type StrategyLanguage = "sr" | "en" | "sr_en" | "unknown";

export type StrategyTranslationStatus =
  | "not_required"
  | "translated"
  | "needs_translation"
  | "partial"
  | "unknown";

export type StrategyParsingStatus =
  | "not_started"
  | "parsed"
  | "failed"
  | "needs_review";

export type ReadinessCategory =
  | "AI-ready"
  | "Found / Not Parsed"
  | "Needs Translation"
  | "Needs Validation"
  | "Missing";

export type StrategyInventoryRecord = {
  country_code: string;
  lsg_id: string;
  lsg_name: string;
  lsg_name_local?: string;
  region_name?: string;
  document_type: StrategyDocumentType;
  document_title?: string;
  publication_year?: number | null;
  valid_from_year?: number | null;
  valid_to_year?: number | null;
  source_url?: string | null;
  source_status: StrategySourceStatus;
  language?: StrategyLanguage;
  translation_status: StrategyTranslationStatus;
  parsing_status: StrategyParsingStatus;
  ai_ready: boolean;
  comprehensiveness_score?: number | null;
  notes?: string;
  last_updated?: string;
};

export type ExpectedLsg = {
  lsg_id: string;
  lsg_name: string;
  region_name?: string;
};

export type PublicationYearCount = {
  year: string;
  count: number;
};

export type ReadinessStatusCount = {
  category: ReadinessCategory;
  count: number;
};

export type StrategyInventorySummary = {
  expected_lsgs: number;
  lsgs_with_any_document: number;
  coverage_rate: number;
  total_documents_found: number;
  strategies_found: number;
  budgets_found: number;
  ai_ready_documents: number;
  needs_translation: number;
  needs_validation: number;
  missing_lsgs: ExpectedLsg[];
  unlisted_missing_lsg_count: number;
  publication_year_counts: PublicationYearCount[];
  unknown_year_count: number;
  status_breakdown: ReadinessStatusCount[];
  latest_last_updated: string | null;
};

export type StrategyInventoryFilters = {
  query?: string;
  publicationYear?: string;
  readinessCategory?: ReadinessCategory | "all";
  documentType?: StrategyDocumentType | "all";
  translationStatus?: StrategyTranslationStatus | "all";
};

export type StrategyInventoryDataset = {
  country_code: string;
  country_name: string;
  is_sample_data: boolean;
  expected_lsg_count: number;
  last_updated: string;
  records: StrategyInventoryRecord[];
};
