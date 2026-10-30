import "server-only";

import { createHash } from "node:crypto";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type {
  AiDocumentContext,
  AiStageCacheEntry,
  AiStageName,
  AiStageSourceReference,
  AiTokenUsage,
} from "@/lib/ai/types";
import type { AiRunStatus } from "@/lib/ai/run-store";

// Bump when a prompt changes so stored rows are labelled with the prompt that
// produced them. AI_PROMPT_VERSION in the environment overrides this label;
// the cache key hashes the prompt text itself, so a stale row never matches
// a changed prompt either way.
export const DEFAULT_AI_PROMPT_VERSION = "v4";

const AI_INVALIDATION_VERSION = process.env.AI_INVALIDATION_VERSION ?? "v1";

function isMissingRelationError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : null;
  return code === "PGRST205" || code === "42P01";
}

export function getAiPromptVersion() {
  return process.env.AI_PROMPT_VERSION ?? DEFAULT_AI_PROMPT_VERSION;
}

export function getAiInvalidationVersion() {
  return AI_INVALIDATION_VERSION;
}

export function createFingerprint(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export type AiStageCacheUnit = {
  municipalityId: string;
  province: string;
};

export type AiStageCacheLookup = {
  countryCode: AiDocumentContext["countryCode"];
  stage: AiStageName;
  releaseKey: string;
  year: number;
  scoreId: string;
  // null reads across every unit in the country; rows are still written under
  // the unit that generated them because the table requires one.
  unit: AiStageCacheUnit | null;
  modelName: string;
  promptVersion: string;
  inputFingerprint: string;
  cacheKey?: string;
  sourceFingerprint?: string;
  inputHash?: string;
};

export type AiStageRunRecord = Omit<AiStageCacheLookup, "unit"> & {
  unit: AiStageCacheUnit;
  cacheKey: string;
  sourceFingerprint: string;
  inputHash: string;
  promptHash: string;
  modelSettings: Record<string, unknown>;
  renderedOutput: string | null;
  structuredOutput: Record<string, unknown>;
  sourceReferences: AiStageSourceReference[];
  status: AiRunStatus;
  errorMessage: string | null;
  tokenUsage: AiTokenUsage | null;
  estimatedCostUsd: number | null;
};

function toNullableText(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toCacheEntry(data: Record<string, unknown>): AiStageCacheEntry {
  return {
    stage: data.stage_name as AiStageName,
    status: data.status as "completed" | "failed",
    cacheHit: true,
    cacheStatus: "cache_hit",
    runId: toNullableText(data.latest_run_id),
    cacheKey: toNullableText(data.cache_key),
    sourceFingerprint: toNullableText(data.source_fingerprint),
    inputHash: toNullableText(data.input_hash),
    renderedOutput: data.rendered_output as string | null,
    structuredOutput: (data.structured_output ?? {}) as Record<string, unknown>,
    sourceReferences: (data.source_references ?? []) as AiStageSourceReference[],
    modelName: data.model_name as string,
    promptVersion: data.prompt_version as string,
    invalidationVersion: data.invalidation_version as string,
    updatedAt: data.updated_at as string | null,
    errorMessage: data.error_message as string | null,
  };
}

export async function loadAiStageCache(
  lookup: AiStageCacheLookup,
): Promise<AiStageCacheEntry | null> {
  const supabase = getSupabaseServerClient().schema("analytics");

  try {
    let query = supabase
      .from("ai_stage_cache")
      .select(
        "stage_name, status, rendered_output, structured_output, source_references, model_name, prompt_version, invalidation_version, updated_at, error_message, latest_run_id, cache_key, source_fingerprint, input_hash",
      )
      .eq("stage_name", lookup.stage)
      .eq("country_code", lookup.countryCode)
      .eq("release_key", lookup.releaseKey)
      .eq("year", lookup.year)
      .eq("score_id", lookup.scoreId)
      .eq("model_name", lookup.modelName)
      .eq("prompt_version", lookup.promptVersion)
      .eq("invalidation_version", getAiInvalidationVersion())
      .eq("input_fingerprint", lookup.inputFingerprint);

    if (lookup.unit) {
      query = query
        .eq("municipality_id", lookup.unit.municipalityId)
        .eq("province", lookup.unit.province);
    }

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) {
        return null;
      }

      throw error;
    }

    if (!data) {
      return null;
    }

    return toCacheEntry(data);
  } catch (error) {
    if (isMissingRelationError(error)) {
      return null;
    }

    throw error;
  }
}

export async function loadLatestAiStageCacheByScope({
  stage,
  countryCode,
  releaseKey,
  year,
  scoreId,
  unit,
}: {
  stage: AiStageName;
  countryCode: AiDocumentContext["countryCode"];
  releaseKey: string;
  year: number;
  scoreId: string;
  unit: AiStageCacheUnit | null;
}): Promise<AiStageCacheEntry | null> {
  const supabase = getSupabaseServerClient().schema("analytics");

  try {
    let query = supabase
      .from("ai_stage_cache")
      .select(
        "stage_name, status, rendered_output, structured_output, source_references, model_name, prompt_version, invalidation_version, updated_at, error_message, latest_run_id, cache_key, source_fingerprint, input_hash",
      )
      .eq("stage_name", stage)
      .eq("country_code", countryCode)
      .eq("release_key", releaseKey)
      .eq("year", year)
      .eq("score_id", scoreId)
      .eq("invalidation_version", getAiInvalidationVersion())
      .eq("status", "completed");

    if (unit) {
      query = query.eq("municipality_id", unit.municipalityId).eq("province", unit.province);
    }

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) {
        return null;
      }

      throw error;
    }

    if (!data) {
      return null;
    }

    return toCacheEntry(data);
  } catch (error) {
    if (isMissingRelationError(error)) {
      return null;
    }

    throw error;
  }
}

export async function saveAiStageCache(
  lookup: Omit<AiStageCacheLookup, "unit"> & {
    unit: AiStageCacheUnit;
    renderedOutput: string | null;
    structuredOutput: Record<string, unknown>;
    sourceReferences: AiStageSourceReference[];
    promptHash: string;
    status: "completed" | "failed";
    errorMessage: string | null;
    runId?: string | null;
  },
) {
  const supabase = getSupabaseServerClient().schema("analytics");

  try {
    const { error } = await supabase.from("ai_stage_cache").upsert(
      {
        stage_name: lookup.stage,
        country_code: lookup.countryCode,
        release_key: lookup.releaseKey,
        year: lookup.year,
        municipality_id: lookup.unit.municipalityId,
        province: lookup.unit.province,
        score_id: lookup.scoreId,
        model_name: lookup.modelName,
        prompt_version: lookup.promptVersion,
        invalidation_version: getAiInvalidationVersion(),
        input_fingerprint: lookup.inputFingerprint,
        prompt_hash: lookup.promptHash,
        cache_key: lookup.cacheKey ?? lookup.inputFingerprint,
        source_fingerprint: lookup.sourceFingerprint ?? lookup.inputFingerprint,
        input_hash: lookup.inputHash ?? lookup.inputFingerprint,
        latest_run_id: lookup.runId ?? null,
        status: lookup.status,
        rendered_output: lookup.renderedOutput,
        structured_output: lookup.structuredOutput,
        source_references: lookup.sourceReferences,
        error_message: lookup.errorMessage,
      },
      {
        onConflict:
          "country_code,stage_name,release_key,year,municipality_id,province,score_id,model_name,prompt_version,invalidation_version,input_fingerprint",
      },
    );

    if (error && !isMissingRelationError(error)) {
      throw error;
    }
  } catch (error) {
    if (!isMissingRelationError(error)) {
      throw error;
    }
  }
}

export async function saveAiStageRun(record: AiStageRunRecord): Promise<string | null> {
  const supabase = getSupabaseServerClient().schema("analytics");
  const now = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from("ai_stage_runs")
      .insert({
        cache_key: record.cacheKey,
        stage_name: record.stage,
        country_code: record.countryCode,
        release_key: record.releaseKey,
        year: record.year,
        municipality_id: record.unit.municipalityId,
        province: record.unit.province,
        score_id: record.scoreId,
        model_name: record.modelName,
        model_settings: record.modelSettings,
        prompt_version: record.promptVersion,
        invalidation_version: getAiInvalidationVersion(),
        source_fingerprint: record.sourceFingerprint,
        input_hash: record.inputHash,
        prompt_hash: record.promptHash,
        status: record.status,
        rendered_output: record.renderedOutput,
        structured_output: record.structuredOutput,
        source_references: record.sourceReferences,
        error_message: record.errorMessage,
        token_usage: record.tokenUsage ?? {},
        estimated_cost_usd: record.estimatedCostUsd,
        completed_at: record.status === "running" ? null : now,
      })
      .select("id")
      .single();

    if (error) {
      if (isMissingRelationError(error)) {
        return null;
      }

      throw error;
    }

    return typeof data?.id === "string" ? data.id : null;
  } catch (error) {
    if (isMissingRelationError(error)) {
      return null;
    }

    throw error;
  }
}

export async function loadDocumentContext(
  countryCode: AiDocumentContext["countryCode"],
  sourceType: AiDocumentContext["sourceType"],
  province: string | null,
  sourceUrlOrPath: string,
  contentFingerprint: string,
  extractionVersion: string,
): Promise<AiDocumentContext | null> {
  const supabase = getSupabaseServerClient().schema("analytics");

  try {
    const query = supabase
      .from("ai_document_contexts")
      .select(
        "country_code, source_type, title, province, source_url_or_path, content_mode, extracted_text, passages, chunks, extraction_metadata, content_fingerprint, extraction_version",
      )
      .eq("country_code", countryCode)
      .eq("source_type", sourceType)
      .eq("source_url_or_path", sourceUrlOrPath)
      .eq("content_fingerprint", contentFingerprint)
      .eq("extraction_version", extractionVersion);

    const { data, error } = province
      ? await query.eq("province", province).maybeSingle()
      : await query.is("province", null).maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) {
        return null;
      }

      throw error;
    }

    if (!data) {
      return null;
    }

    return toDocumentContext(data);
  } catch (error) {
    if (isMissingRelationError(error)) {
      return null;
    }

    throw error;
  }
}

type DocumentContextRow = {
  country_code: AiDocumentContext["countryCode"];
  source_type: string;
  title: string;
  province: string | null;
  source_url_or_path: string;
  content_mode: string;
  extracted_text: string;
  passages: unknown;
  chunks: unknown;
  extraction_metadata: unknown;
  content_fingerprint: string;
  extraction_version: string;
};

function toDocumentContext(data: DocumentContextRow): AiDocumentContext {
  return {
    countryCode: data.country_code,
    sourceType: data.source_type as AiDocumentContext["sourceType"],
    title: data.title,
    province: data.province,
    sourceUrlOrPath: data.source_url_or_path,
    contentMode: data.content_mode as AiDocumentContext["contentMode"],
    extractedText: data.extracted_text,
    passages: data.passages as AiDocumentContext["passages"],
    chunks: data.chunks as AiDocumentContext["chunks"],
    extractionMetadata: (data.extraction_metadata ?? {}) as Record<string, unknown>,
    contentFingerprint: data.content_fingerprint,
    extractionVersion: data.extraction_version,
  };
}

export async function loadLatestDocumentContextBySource(
  countryCode: AiDocumentContext["countryCode"],
  sourceType: AiDocumentContext["sourceType"],
  province: string | null,
  sourceUrlOrPath: string,
  extractionVersion: string,
): Promise<AiDocumentContext | null> {
  const supabase = getSupabaseServerClient().schema("analytics");

  try {
    const query = supabase
      .from("ai_document_contexts")
      .select(
        "country_code, source_type, title, province, source_url_or_path, content_mode, extracted_text, passages, chunks, extraction_metadata, content_fingerprint, extraction_version",
      )
      .eq("country_code", countryCode)
      .eq("source_type", sourceType)
      .eq("source_url_or_path", sourceUrlOrPath)
      .eq("extraction_version", extractionVersion)
      .order("updated_at", { ascending: false })
      .limit(1);

    const { data, error } = province
      ? await query.eq("province", province).maybeSingle()
      : await query.is("province", null).maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) {
        return null;
      }

      throw error;
    }

    return data ? toDocumentContext(data) : null;
  } catch (error) {
    if (isMissingRelationError(error)) {
      return null;
    }

    throw error;
  }
}

export async function saveDocumentContext(context: AiDocumentContext) {
  const supabase = getSupabaseServerClient().schema("analytics");

  try {
    const { error } = await supabase.from("ai_document_contexts").upsert(
      {
        country_code: context.countryCode,
        source_type: context.sourceType,
        title: context.title,
        province: context.province,
        source_url_or_path: context.sourceUrlOrPath,
        content_mode: context.contentMode,
        extracted_text: context.extractedText,
        passages: context.passages,
        chunks: context.chunks,
        extraction_metadata: context.extractionMetadata,
        content_fingerprint: context.contentFingerprint,
        extraction_version: context.extractionVersion,
      },
      {
        onConflict:
          "country_code,source_type,province,source_url_or_path,content_fingerprint,extraction_version",
      },
    );

    if (error && !isMissingRelationError(error)) {
      throw error;
    }
  } catch (error) {
    if (!isMissingRelationError(error)) {
      throw error;
    }
  }
}
