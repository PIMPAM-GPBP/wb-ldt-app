import type { CountryCode } from "@/lib/countries";

export const aiStageNames = [
  "indicator_narrative",
  "province_plan_context",
  "national_plan_context",
  "web_context_search",
  "plan_alignment",
  "swot_analysis",
  "investment_recommendations",
] as const;

export type AiStageName = (typeof aiStageNames)[number];

export type AiDocumentContentMode = "full_text" | "chunked_text";

export type AiDocumentPassage = {
  id: string;
  title: string | null;
  text: string;
};

export type AiDocumentChunk = {
  id: string;
  text: string;
  sectionLabel: string | null;
  startOffset: number;
  endOffset: number;
  retrievalScore: number | null;
};

export type AiDocumentContext = {
  countryCode: CountryCode;
  sourceType: "province_plan" | "national_plan";
  title: string;
  province: string | null;
  sourceUrlOrPath: string;
  contentMode: AiDocumentContentMode;
  extractedText: string;
  passages: AiDocumentPassage[];
  chunks: AiDocumentChunk[];
  extractionMetadata: Record<string, unknown>;
  contentFingerprint: string;
  extractionVersion: string;
};

export type AiStageSourceReference = {
  label: string;
  type: "document" | "indicator_series" | "generated" | "web_search";
  source: string;
  metadata?: Record<string, unknown>;
};

export type AiStageCacheEntry = {
  stage: AiStageName;
  status: "completed" | "failed";
  cacheHit: boolean;
  cacheStatus?: "cache_hit" | "generated" | "regenerated" | "failed";
  runId: string | null;
  cacheKey: string | null;
  sourceFingerprint: string | null;
  inputHash: string | null;
  renderedOutput: string | null;
  structuredOutput: Record<string, unknown>;
  sourceReferences: AiStageSourceReference[];
  modelName: string;
  promptVersion: string;
  invalidationVersion: string;
  updatedAt: string | null;
  errorMessage: string | null;
};

export type ProvincePlanCandidate = {
  countryCode: CountryCode;
  province: string;
  planUnitName: string;
  planUnitLabel: string;
  title: string;
  link: string;
  notes: string | null;
  priority: number;
  documentType: string | null;
  scoreTheme: string | null;
};

export type NationalPlanSource = {
  title: string;
  link: string;
  notes: string | null;
  priority: number;
  documentType: string | null;
  scoreTheme: string | null;
};

export type AiStageMode = "generate" | "regenerate" | "load_cached";

export type AiStageRequestPayload = {
  countryCode: CountryCode;
  releaseKey: string;
  year: number;
  municipalityId: string;
  scoreId: string;
  mode: AiStageMode;
};

export type AiTokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

export type AiStageResponsePayload = {
  stage: AiStageName;
  status: "completed" | "failed";
  cacheHit: boolean;
  cacheStatus?: "cache_hit" | "generated" | "regenerated" | "failed";
  runId?: string | null;
  cacheKey?: string | null;
  sourceFingerprint?: string | null;
  inputHash?: string | null;
  renderedOutput: string | null;
  structuredOutput: Record<string, unknown>;
  sourceReferences: AiStageSourceReference[];
  modelName: string;
  promptVersion: string;
  // Present only on a fresh model generation; cache hits and document stages carry neither.
  tokenUsage?: AiTokenUsage | null;
  estimatedCostUsd?: number | null;
  updatedAt: string | null;
  errorMessage: string | null;
};
