import { createHash } from "node:crypto";

import type {
  AiStageMode,
  AiStageName,
  AiStageRequestPayload,
  AiStageResponsePayload,
} from "@/lib/ai/types";

export type AiRunStatus = "running" | "completed" | "failed";

// Most stages are keyed to one unit. The national plan context is the same for
// every unit in a country and theme, so it is keyed to the country instead.
export type AiRunScope =
  | {
      kind: "unit";
      municipalityId: string;
      province: string;
      scoreId: string;
    }
  | {
      kind: "country_theme";
      scoreTheme: string;
    };

export type AiRunCacheContractInput = {
  countryCode: string;
  stage: AiStageName;
  releaseKey: string;
  year: number;
  scope: AiRunScope;
  modelName: string;
  promptVersion: string;
  invalidationVersion: string;
  input: unknown;
  prompt: {
    system: string;
    user: string;
  };
  modelSettings: Record<string, unknown>;
};

export type AiRunCacheContract = {
  cacheKey: string;
  inputHash: string;
  sourceFingerprint: string;
  promptHash: string;
  modelSettingsHash: string;
};

function normalizeForHashing(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForHashing(item));
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, normalizeForHashing(record[key])]),
  );
}

export function createStableFingerprint(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(normalizeForHashing(value)))
    .digest("hex");
}

function getSourceEvidenceInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const record = input as Record<string, unknown>;
  return (
    record.evidence ??
    record.sourceReferences ??
    record.sources ??
    record.documents ??
    record.documentFingerprints ??
    input
  );
}

export function buildAiRunCacheContract({
  input,
  prompt,
  modelSettings,
  ...scope
}: AiRunCacheContractInput): AiRunCacheContract {
  const inputHash = createStableFingerprint(input);
  const sourceFingerprint = createStableFingerprint(getSourceEvidenceInput(input));
  const promptHash = createStableFingerprint(prompt);
  const modelSettingsHash = createStableFingerprint(modelSettings);
  const cacheKey = createStableFingerprint({
    ...scope,
    inputHash,
    sourceFingerprint,
    promptHash,
    modelSettingsHash,
  });

  return {
    cacheKey,
    inputHash,
    sourceFingerprint,
    promptHash,
    modelSettingsHash,
  };
}

export function shouldBypassAiRunCache(mode: AiStageRequestPayload["mode"]) {
  return mode === "regenerate";
}

export function isCacheReusableRunStatus(status: AiRunStatus) {
  return status === "completed";
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}"
      ? serialized
      : "AI generation failed.";
  } catch {
    return "AI generation failed.";
  }
}

function attachRunMetadata(
  response: AiStageResponsePayload,
  runContract: AiRunCacheContract,
  cacheStatus: NonNullable<AiStageResponsePayload["cacheStatus"]>,
): AiStageResponsePayload {
  return {
    ...response,
    cacheHit: cacheStatus === "cache_hit",
    cacheStatus,
    cacheKey: runContract.cacheKey,
    sourceFingerprint: runContract.sourceFingerprint,
    inputHash: runContract.inputHash,
  };
}

export async function runWithAiStageCache({
  mode,
  runContract,
  loadCached,
  generate,
  buildFailureResponse,
  persistRun,
  missingCacheMessage = "No cached AI stage output found.",
}: {
  mode: AiStageMode;
  runContract: AiRunCacheContract;
  loadCached: () => Promise<AiStageResponsePayload | null>;
  generate: () => Promise<AiStageResponsePayload>;
  buildFailureResponse: (message: string) => AiStageResponsePayload;
  persistRun: (response: AiStageResponsePayload) => Promise<string | null>;
  missingCacheMessage?: string;
}): Promise<AiStageResponsePayload> {
  if (!shouldBypassAiRunCache(mode)) {
    const cached = await loadCached();

    if (cached && isCacheReusableRunStatus(cached.status)) {
      return attachRunMetadata(cached, runContract, "cache_hit");
    }

    if (mode === "load_cached") {
      return attachRunMetadata(
        buildFailureResponse(missingCacheMessage),
        runContract,
        "failed",
      );
    }
  }

  const cacheStatus = mode === "regenerate" ? "regenerated" : "generated";
  let response: AiStageResponsePayload;

  try {
    response = attachRunMetadata(await generate(), runContract, cacheStatus);
  } catch (error) {
    response = attachRunMetadata(
      buildFailureResponse(errorToMessage(error)),
      runContract,
      "failed",
    );
  }

  const runId = await persistRun(response);

  return {
    ...response,
    runId,
  };
}
