import "server-only";

import {
  createFingerprint,
  getAiInvalidationVersion,
  getAiPromptVersion,
  loadAiStageCache,
  saveDocumentContext,
  saveAiStageCache,
  saveAiStageRun,
} from "@/lib/ai/cache";
import { searchWithExa, tryExtractWithExa } from "@/lib/ai/exa";
import { generateOpenAiText, getOpenAiModel } from "@/lib/ai/openai";
import {
  buildAiRunCacheContract,
  runWithAiStageCache,
  type AiRunCacheContract,
} from "@/lib/ai/run-store";
import {
  basePlanningSystemPrompt,
  buildIndicatorNarrativePrompt,
  buildInvestmentRecommendationsPrompt,
  buildPlanAlignmentPrompt,
  buildSwotPrompt,
  buildWebContextSummaryPrompt,
} from "@/lib/ai/prompts";
import type {
  AiDocumentContext,
  AiPipelineContext,
  AiStageName,
  AiStageRequestPayload,
  AiStageResponsePayload,
  AiStageSourceReference,
} from "@/lib/ai/types";
import { getAiPipelineContextForRequest } from "@/lib/data/queries";

const DOCUMENT_MODEL_NAME = "document-parser";

type AiStageDependencyResolver = (
  stage: AiStageName,
) => Promise<AiStageResponsePayload | null>;

function buildDocumentStageOutput(context: AiDocumentContext, sourceLabel: string) {
  const excerpt = context.passages.slice(0, 12).map((passage) => passage.text).join("\n\n");
  const previewText = excerpt || context.extractedText.slice(0, 12000);

  return {
    renderedOutput: [
      `Source: ${sourceLabel}`,
      `Title: ${context.title}`,
      `Content mode: ${context.contentMode}`,
      `Captured passages: ${context.passages.length}`,
      "",
      previewText,
    ].join("\n"),
    structuredOutput: {
      countryCode: context.countryCode,
      sourceType: context.sourceType,
      title: context.title,
      province: context.province,
      sourceUrlOrPath: context.sourceUrlOrPath,
      contentMode: context.contentMode,
      extractedText: context.extractedText,
      extractionMetadata: context.extractionMetadata,
      passages: context.passages,
      chunks: context.chunks,
      contentFingerprint: context.contentFingerprint,
      extractionVersion: context.extractionVersion,
    },
  };
}

function documentFromStructuredOutput(
  output: Record<string, unknown>,
  fallbackSourceType: AiDocumentContext["sourceType"],
  fallbackCountryCode: AiDocumentContext["countryCode"],
): AiDocumentContext | null {
  const title = typeof output.title === "string" ? output.title : null;
  const sourceUrlOrPath =
    typeof output.sourceUrlOrPath === "string" ? output.sourceUrlOrPath : null;
  const extractedText =
    typeof output.extractedText === "string" ? output.extractedText : null;
  const contentFingerprint =
    typeof output.contentFingerprint === "string" ? output.contentFingerprint : null;
  const extractionVersion =
    typeof output.extractionVersion === "string" ? output.extractionVersion : null;
  const contentMode =
    output.contentMode === "chunked_text" ? "chunked_text" : "full_text";

  if (!title || !sourceUrlOrPath || !extractedText || !contentFingerprint || !extractionVersion) {
    return null;
  }

  return {
    countryCode:
      typeof output.countryCode === "string"
        ? (output.countryCode as AiDocumentContext["countryCode"])
        : fallbackCountryCode,
    sourceType:
      output.sourceType === "national_plan" || output.sourceType === "province_plan"
        ? output.sourceType
        : fallbackSourceType,
    title,
    province: typeof output.province === "string" ? output.province : null,
    sourceUrlOrPath,
    contentMode,
    extractedText,
    passages: Array.isArray(output.passages)
      ? (output.passages as AiDocumentContext["passages"])
      : [],
    chunks: Array.isArray(output.chunks)
      ? (output.chunks as AiDocumentContext["chunks"])
      : [],
    extractionMetadata:
      output.extractionMetadata && typeof output.extractionMetadata === "object"
        ? (output.extractionMetadata as AiDocumentContext["extractionMetadata"])
        : {},
    contentFingerprint,
    extractionVersion,
  };
}

function buildWebContextQuery(context: AiPipelineContext) {
  return [
    `"${context.localPlanUnitName}" "${context.country.name}" local development plan`,
    `"${context.municipality.name}" "${context.localPlanUnitLabel}"`,
    `"${context.score.label}"`,
    "public investment priorities",
  ].join(" ");
}

function buildWebContextStageOutput(
  hits: Array<{
    title: string;
    url: string;
    text: string;
    publishedDate: string | null;
    score: number | null;
  }>,
  summary: string,
) {
  return {
    renderedOutput: summary,
    structuredOutput: {
      queryHits: hits.map((hit) => ({
        title: hit.title,
        url: hit.url,
        snippet: hit.text.slice(0, 1800),
        publishedDate: hit.publishedDate,
        score: hit.score,
      })),
    },
  };
}

function getWebContextSummaryFromStage(
  stage: AiStageResponsePayload | null,
) {
  if (stage?.status !== "completed") {
    return null;
  }

  const hits = Array.isArray(stage.structuredOutput.queryHits)
    ? stage.structuredOutput.queryHits
    : [];

  if (hits.length === 0) {
    return null;
  }

  return stage.renderedOutput;
}

function toCacheEntry({
  stage,
  cacheHit,
  cacheStatus,
  runContract,
  runId,
  renderedOutput,
  structuredOutput,
  sourceReferences,
  modelName,
  promptVersion,
  errorMessage,
}: {
  stage: AiStageName;
  cacheHit: boolean;
  cacheStatus?: AiStageResponsePayload["cacheStatus"];
  runContract?: AiRunCacheContract | null;
  runId?: string | null;
  renderedOutput: string | null;
  structuredOutput: Record<string, unknown>;
  sourceReferences: AiStageSourceReference[];
  modelName: string;
  promptVersion: string;
  errorMessage?: string | null;
}): AiStageResponsePayload {
  return {
    stage,
    status: errorMessage ? "failed" : "completed",
    cacheHit,
    cacheStatus: cacheStatus ?? (errorMessage ? "failed" : cacheHit ? "cache_hit" : "generated"),
    runId: runId ?? null,
    cacheKey: runContract?.cacheKey ?? null,
    sourceFingerprint: runContract?.sourceFingerprint ?? null,
    inputHash: runContract?.inputHash ?? null,
    renderedOutput,
    structuredOutput,
    sourceReferences,
    modelName,
    promptVersion,
    updatedAt: new Date().toISOString(),
    errorMessage: errorMessage ?? null,
  };
}

function toFailureStage(
  stage: AiStageName,
  modelName: string,
  message: string,
): AiStageResponsePayload {
  return {
    stage,
    status: "failed",
    cacheHit: false,
    cacheStatus: "failed",
    runId: null,
    cacheKey: null,
    sourceFingerprint: null,
    inputHash: null,
    renderedOutput: null,
    structuredOutput: {},
    sourceReferences: [],
    modelName,
    promptVersion: getAiPromptVersion(),
    updatedAt: new Date().toISOString(),
    errorMessage: message,
  };
}

function buildStageRunContract({
  stage,
  context,
  modelName,
  input,
  prompt,
  modelSettings = {},
}: {
  stage: AiStageName;
  context: AiPipelineContext;
  modelName: string;
  input: unknown;
  prompt: {
    system: string;
    user: string;
  };
  modelSettings?: Record<string, unknown>;
}) {
  return buildAiRunCacheContract({
    countryCode: context.country.code,
    stage,
    releaseKey: context.releaseKey,
    year: context.year,
    municipalityId: context.municipality.id,
    province: context.municipality.province,
    scoreId: context.score.id,
    modelName,
    promptVersion: getAiPromptVersion(),
    invalidationVersion: getAiInvalidationVersion(),
    input,
    prompt,
    modelSettings,
  });
}

function chooseProvincePlanUrl(context: AiPipelineContext) {
  return [...context.provincePlanCandidates].sort((left, right) => left.priority - right.priority)[0] ?? null;
}

async function getCachedEntry(
  stage: AiStageName,
  context: AiPipelineContext,
  modelName: string,
  runContract: AiRunCacheContract,
) {
  const cached = await loadAiStageCache({
    countryCode: context.country.code,
    stage,
    releaseKey: context.releaseKey,
    year: context.year,
    municipalityId: context.municipality.id,
    province: context.municipality.province,
    scoreId: context.score.id,
    modelName,
    promptVersion: getAiPromptVersion(),
    inputFingerprint: runContract.cacheKey,
    cacheKey: runContract.cacheKey,
    sourceFingerprint: runContract.sourceFingerprint,
    inputHash: runContract.inputHash,
  });

  return cached?.status === "completed" ? cached : null;
}

async function persistEntry(
  stage: AiStageName,
  context: AiPipelineContext,
  modelName: string,
  runContract: AiRunCacheContract,
  modelSettings: Record<string, unknown>,
  response: AiStageResponsePayload,
) {
  const runId = await saveAiStageRun({
    countryCode: context.country.code,
    stage,
    releaseKey: context.releaseKey,
    year: context.year,
    municipalityId: context.municipality.id,
    province: context.municipality.province,
    scoreId: context.score.id,
    modelName,
    promptVersion: getAiPromptVersion(),
    inputFingerprint: runContract.cacheKey,
    cacheKey: runContract.cacheKey,
    sourceFingerprint: runContract.sourceFingerprint,
    inputHash: runContract.inputHash,
    promptHash: runContract.promptHash,
    modelSettings,
    renderedOutput: response.renderedOutput,
    structuredOutput: response.structuredOutput,
    sourceReferences: response.sourceReferences,
    status: response.status,
    errorMessage: response.errorMessage,
  });

  if (response.status === "completed") {
    await saveAiStageCache({
      countryCode: context.country.code,
      stage,
      releaseKey: context.releaseKey,
      year: context.year,
      municipalityId: context.municipality.id,
      province: context.municipality.province,
      scoreId: context.score.id,
      modelName,
      promptVersion: getAiPromptVersion(),
      inputFingerprint: runContract.cacheKey,
      cacheKey: runContract.cacheKey,
      sourceFingerprint: runContract.sourceFingerprint,
      inputHash: runContract.inputHash,
      promptHash: runContract.promptHash,
      renderedOutput: response.renderedOutput,
      structuredOutput: response.structuredOutput,
      sourceReferences: response.sourceReferences,
      status: response.status,
      errorMessage: response.errorMessage,
      runId,
    });
  }

  return runId;
}

async function persistEntrySafely(
  stage: AiStageName,
  context: AiPipelineContext,
  modelName: string,
  runContract: AiRunCacheContract,
  modelSettings: Record<string, unknown>,
  response: AiStageResponsePayload,
): Promise<string | null> {
  try {
    return await persistEntry(stage, context, modelName, runContract, modelSettings, response);
  } catch (error) {
    console.error(`Failed to persist AI stage ${stage}:`, error);
    return null;
  }
}

async function runCachedStage({
  stage,
  context,
  modelName,
  mode,
  runContract,
  missingCacheMessage,
  modelSettings = {},
  generate,
}: {
  stage: AiStageName;
  context: AiPipelineContext;
  modelName: string;
  mode: AiStageRequestPayload["mode"];
  runContract: AiRunCacheContract;
  missingCacheMessage: string;
  modelSettings?: Record<string, unknown>;
  generate: () => Promise<AiStageResponsePayload>;
}) {
  return runWithAiStageCache({
    mode,
    runContract,
    loadCached: () => getCachedEntry(stage, context, modelName, runContract),
    generate,
    buildFailureResponse: (message) => toFailureStage(stage, modelName, message),
    persistRun: (response) =>
      persistEntrySafely(stage, context, modelName, runContract, modelSettings, response),
    missingCacheMessage,
  });
}

async function runIndicatorNarrativeStage(
  context: AiPipelineContext,
  mode: AiStageRequestPayload["mode"],
) {
  const modelName = getOpenAiModel();
  const prompt = buildIndicatorNarrativePrompt(context);
  const stageInput = {
    municipality: context.municipality,
    score: context.score,
    indicatorSeries: context.indicatorSeries,
    evidence: context.indicatorSeries.map((series) => ({
      indicatorId: series.indicatorId,
      componentId: series.componentId,
      points: series.points,
    })),
  };
  const runContract = buildStageRunContract({
    stage: "indicator_narrative",
    context,
    modelName,
    input: stageInput,
    prompt: {
      system: basePlanningSystemPrompt,
      user: prompt,
    },
  });

  return runCachedStage({
    stage: "indicator_narrative",
    context,
    modelName,
    mode,
    runContract,
    missingCacheMessage: "No cached indicator narrative found.",
    generate: async () => {
      const generated = await generateOpenAiText({
        system: basePlanningSystemPrompt,
        prompt,
        model: modelName,
      });

      return toCacheEntry({
        stage: "indicator_narrative",
        cacheHit: false,
        renderedOutput: generated.text,
        structuredOutput: {
          municipality: context.municipality,
          score: context.score,
        },
        sourceReferences: [
          {
            label: `${context.score.label} indicator series`,
            type: "indicator_series",
            source: "supabase",
          },
        ],
        modelName,
        promptVersion: getAiPromptVersion(),
      });
    },
  });
}

async function getProvinceDocumentContext(
  context: AiPipelineContext,
  { forceRefresh = false }: { forceRefresh?: boolean } = {},
) {
  const chosen = chooseProvincePlanUrl(context);

  if (!chosen) {
    throw new Error(`No local/SNG plan link found for ${context.localPlanUnitName}.`);
  }

  try {
    const { getProvincePlanContext } = await import("@/lib/ai/documents");
    const direct = await getProvincePlanContext(
      context.country.code,
      context.localPlanUnitName,
      context.localPlanUnitLabel,
      { forceRefresh },
    );
    return {
      document: direct.context,
      sourceReferences: [
        {
          label: direct.context.title,
          type: "document" as const,
          source: direct.context.sourceUrlOrPath,
          metadata: {
            provider: "direct_parse",
            countryCode: context.country.code,
            localPlanUnitName: context.localPlanUnitName,
            localPlanUnitLabel: context.localPlanUnitLabel,
            candidates: direct.candidates,
          },
        },
      ],
    };
  } catch (directError) {
    const exaResult = await tryExtractWithExa(chosen.link);

    if (!exaResult) {
      throw directError;
    }

    const document: AiDocumentContext = {
      countryCode: context.country.code,
      sourceType: "province_plan",
      title: exaResult.title,
      province: context.localPlanUnitName,
      sourceUrlOrPath: exaResult.sourceUrlOrPath,
      contentMode: "full_text",
      extractedText: exaResult.extractedText,
      passages: exaResult.extractedText
        .split(/\n{2,}/)
        .map((passage) => passage.trim())
        .filter((passage) => passage.length > 80)
        .slice(0, 80)
        .map((passage, index) => ({
          id: `passage-${index + 1}`,
          title: null,
          text: passage,
        })),
      chunks: [],
      extractionMetadata: {
        ...(exaResult.metadata ?? {}),
        candidateNotes: chosen.notes,
        localPlanUnitLabel: context.localPlanUnitLabel,
        fallbackReason:
          directError instanceof Error ? directError.message : "direct local-plan parse failed",
        chunkingReady: true,
      },
      contentFingerprint: createFingerprint(exaResult.extractedText),
      extractionVersion: "v2",
    };

    await saveDocumentContext(document);

    return {
      document,
      sourceReferences: [
        {
          label: exaResult.title,
          type: "document" as const,
          source: exaResult.sourceUrlOrPath,
          metadata: {
            provider: "exa_fallback",
            countryCode: context.country.code,
            localPlanUnitName: context.localPlanUnitName,
          },
        },
      ],
    };
  }
}

async function runProvincePlanStage(
  context: AiPipelineContext,
  mode: AiStageRequestPayload["mode"],
) {
  const chosen = chooseProvincePlanUrl(context);
  const stageInput = {
    countryCode: context.country.code,
    localPlanUnitName: context.localPlanUnitName,
    selectedPlanUrl: chosen?.link ?? null,
    evidence: chosen
      ? [{ url: chosen.link, title: chosen.title, priority: chosen.priority }]
      : [],
    extractionVersion: "v2",
    displayVersion: "v2",
  };
  const runContract = buildStageRunContract({
    stage: "province_plan_context",
    context,
    modelName: DOCUMENT_MODEL_NAME,
    input: stageInput,
    prompt: {
      system: DOCUMENT_MODEL_NAME,
      user: JSON.stringify(stageInput),
    },
  });

  return runCachedStage({
    stage: "province_plan_context",
    context,
    modelName: DOCUMENT_MODEL_NAME,
    mode,
    runContract,
    missingCacheMessage: "No cached local/SNG plan context found.",
    generate: async () => {
      if (!chosen) {
        throw new Error(`No local/SNG plan URL is available for ${context.localPlanUnitName}.`);
      }

      const { document, sourceReferences } = await getProvinceDocumentContext(context, {
        forceRefresh: mode === "regenerate",
      });
      const stageOutput = buildDocumentStageOutput(
        document,
        `${context.localPlanUnitName} local/SNG plan`,
      );

      return toCacheEntry({
        stage: "province_plan_context",
        cacheHit: false,
        renderedOutput: stageOutput.renderedOutput,
        structuredOutput: stageOutput.structuredOutput,
        sourceReferences,
        modelName: DOCUMENT_MODEL_NAME,
        promptVersion: getAiPromptVersion(),
      });
    },
  });
}

async function runNationalPlanStage(
  context: AiPipelineContext,
  mode: AiStageRequestPayload["mode"],
) {
  const { getNationalPlanContext, loadNationalPlanSources } = await import("@/lib/ai/documents");
  const selectedNationalSources = await loadNationalPlanSources(
    context.country.code,
    context.score.id,
  );
  const stageInput = {
    countryCode: context.country.code,
    scoreId: context.score.id,
    selectedPlanUrls: selectedNationalSources.map((source) => source.link),
    evidence: selectedNationalSources.map((source) => ({
      url: source.link,
      title: source.title,
      priority: source.priority,
      documentType: source.documentType,
      scoreTheme: source.scoreTheme,
    })),
    extractionVersion: "v2",
    displayVersion: "v2",
  };
  const runContract = buildStageRunContract({
    stage: "national_plan_context",
    context,
    modelName: DOCUMENT_MODEL_NAME,
    input: stageInput,
    prompt: {
      system: DOCUMENT_MODEL_NAME,
      user: JSON.stringify(stageInput),
    },
  });

  return runCachedStage({
    stage: "national_plan_context",
    context,
    modelName: DOCUMENT_MODEL_NAME,
    mode,
    runContract,
    missingCacheMessage: "No cached national plan context found.",
    generate: async () => {
      const { context: document, sources } = await getNationalPlanContext(
        context.country.code,
        context.score.id,
        { forceRefresh: mode === "regenerate" },
      );
      const stageOutput = buildDocumentStageOutput(
        document,
        sources.length === 1
          ? `${context.country.name} national plan`
          : `${context.country.name} national planning documents`,
      );

      return toCacheEntry({
        stage: "national_plan_context",
        cacheHit: false,
        renderedOutput: stageOutput.renderedOutput,
        structuredOutput: stageOutput.structuredOutput,
        sourceReferences: sources.map((source) => ({
          label: source.title,
          type: "document" as const,
          source: source.link,
          metadata: {
            documentType: source.documentType,
            scoreTheme: source.scoreTheme,
            priority: source.priority,
          },
        })),
        modelName: DOCUMENT_MODEL_NAME,
        promptVersion: getAiPromptVersion(),
      });
    },
  });
}

async function runWebContextSearchStage(
  context: AiPipelineContext,
  mode: AiStageRequestPayload["mode"],
) {
  const modelName = getOpenAiModel();
  const searchQuery = buildWebContextQuery(context);
  const stageInput = {
    municipality: context.municipality,
    score: context.score,
    searchQuery,
    evidence: [{ provider: "exa", query: searchQuery }],
    searchProvider: "exa",
    searchVersion: "v1",
  };
  const runContract = buildStageRunContract({
    stage: "web_context_search",
    context,
    modelName,
    input: stageInput,
    prompt: {
      system: basePlanningSystemPrompt,
      user: searchQuery,
    },
  });

  return runCachedStage({
    stage: "web_context_search",
    context,
    modelName,
    mode,
    runContract,
    missingCacheMessage: "No cached web context found.",
    generate: async () => {
      let hits: Array<{
        title: string;
        url: string;
        text: string;
        publishedDate: string | null;
        score: number | null;
      }> = [];

      try {
        hits = await searchWithExa(searchQuery, 5);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The web context search provider raised an unexpected error.";

        return toCacheEntry({
          stage: "web_context_search",
          cacheHit: false,
          renderedOutput: `No additional web context was injected. The optional Exa web search failed: ${message}`,
          structuredOutput: {
            queryHits: [],
            skipped: true,
            reason: message,
          },
          sourceReferences: [],
          modelName,
          promptVersion: getAiPromptVersion(),
        });
      }

      if (hits.length === 0) {
        return toCacheEntry({
          stage: "web_context_search",
          cacheHit: false,
          renderedOutput:
            "No additional web context was injected. No reliable external search results were retrieved for the selected unit and score.",
          structuredOutput: {
            queryHits: [],
            skipped: true,
            reason: "No reliable Exa search results were available.",
          },
          sourceReferences: [],
          modelName,
          promptVersion: getAiPromptVersion(),
        });
      }

      const prompt = buildWebContextSummaryPrompt({
        context,
        hits,
      });
      const generated = await generateOpenAiText({
        system: basePlanningSystemPrompt,
        prompt,
        model: modelName,
      });

      const stageOutput = buildWebContextStageOutput(hits, generated.text);

      return toCacheEntry({
        stage: "web_context_search",
        cacheHit: false,
        renderedOutput: stageOutput.renderedOutput,
        structuredOutput: stageOutput.structuredOutput,
        sourceReferences: hits.map((hit) => ({
          label: hit.title,
          type: "web_search" as const,
          source: hit.url,
          metadata: {
            publishedDate: hit.publishedDate,
            searchScore: hit.score,
          },
        })),
        modelName,
        promptVersion: getAiPromptVersion(),
      });
    },
  });
}

async function runAlignmentStage(
  context: AiPipelineContext,
  mode: AiStageRequestPayload["mode"],
  resolveDependency: AiStageDependencyResolver,
) {
  const modelName = getOpenAiModel();
  const [provinceStage, nationalStage] = await Promise.all([
    resolveDependency("province_plan_context"),
    resolveDependency("national_plan_context"),
  ]);
  const webContextStage = await resolveDependency("web_context_search");

  if (
    !provinceStage ||
    !nationalStage ||
    provinceStage.status === "failed" ||
    nationalStage.status === "failed" ||
    !provinceStage.structuredOutput.sourceUrlOrPath ||
    !nationalStage.structuredOutput.sourceUrlOrPath
  ) {
    return toFailureStage(
      "plan_alignment",
      modelName,
      "Local/SNG and national plan contexts must be available before alignment can run.",
    );
  }

  const provinceDocument = documentFromStructuredOutput(
    provinceStage.structuredOutput,
    "province_plan",
    context.country.code,
  );
  const nationalDocument = documentFromStructuredOutput(
    nationalStage.structuredOutput,
    "national_plan",
    context.country.code,
  );

  if (!provinceDocument || !nationalDocument) {
    return toFailureStage(
      "plan_alignment",
      modelName,
      "Local/SNG and national plan contexts were cached, but could not be reconstructed for alignment.",
    );
  }

  const prompt = buildPlanAlignmentPrompt(
    provinceDocument,
    nationalDocument,
    context,
    getWebContextSummaryFromStage(webContextStage),
  );
  const stageInput = {
    countryCode: context.country.code,
    provinceFingerprint: provinceDocument.contentFingerprint,
    nationalFingerprint: nationalDocument.contentFingerprint,
    webContext: getWebContextSummaryFromStage(webContextStage),
    municipality: context.municipality,
    score: context.score,
    evidence: [
      {
        type: "province_plan",
        url: provinceDocument.sourceUrlOrPath,
        fingerprint: provinceDocument.contentFingerprint,
      },
      {
        type: "national_plan",
        url: nationalDocument.sourceUrlOrPath,
        fingerprint: nationalDocument.contentFingerprint,
      },
      ...(webContextStage?.sourceReferences ?? []),
    ],
  };
  const runContract = buildStageRunContract({
    stage: "plan_alignment",
    context,
    modelName,
    input: stageInput,
    prompt: {
      system: basePlanningSystemPrompt,
      user: prompt,
    },
  });

  return runCachedStage({
    stage: "plan_alignment",
    context,
    modelName,
    mode,
    runContract,
    missingCacheMessage: "No cached plan alignment found.",
    generate: async () => {
      const generated = await generateOpenAiText({
        system: basePlanningSystemPrompt,
        prompt,
        model: modelName,
      });

      return toCacheEntry({
        stage: "plan_alignment",
        cacheHit: false,
        renderedOutput: generated.text,
        structuredOutput: {
          countryCode: context.country.code,
          municipality: context.municipality,
          localPlanUnitName: context.localPlanUnitName,
        },
        sourceReferences: [
          {
            label: provinceDocument.title,
            type: "document",
            source: provinceDocument.sourceUrlOrPath,
          },
          {
            label: nationalDocument.title,
            type: "document",
            source: nationalDocument.sourceUrlOrPath,
          },
          ...(webContextStage?.sourceReferences ?? []),
        ],
        modelName,
        promptVersion: getAiPromptVersion(),
      });
    },
  });
}

async function runSwotStage(
  context: AiPipelineContext,
  mode: AiStageRequestPayload["mode"],
  resolveDependency: AiStageDependencyResolver,
) {
  const modelName = getOpenAiModel();
  const indicatorStage = await resolveDependency("indicator_narrative");
  if (!indicatorStage?.renderedOutput) {
    return toFailureStage("swot_analysis", modelName, "Indicator narrative must be generated before SWOT can run.");
  }

  const [provinceStage, nationalStage] = await Promise.all([
    resolveDependency("province_plan_context"),
    resolveDependency("national_plan_context"),
  ]);
  const webContextStage = await resolveDependency("web_context_search");

  if (!provinceStage?.structuredOutput || !nationalStage?.structuredOutput) {
    return toFailureStage(
      "swot_analysis",
      modelName,
      "Local/SNG and national plan contexts must be generated before SWOT can run.",
    );
  }

  const provinceDocument = documentFromStructuredOutput(
    provinceStage.structuredOutput,
    "province_plan",
    context.country.code,
  );
  const nationalDocument = documentFromStructuredOutput(
    nationalStage.structuredOutput,
    "national_plan",
    context.country.code,
  );

  if (!provinceDocument || !nationalDocument) {
    return toFailureStage(
      "swot_analysis",
      modelName,
      "Local/SNG and national plan contexts were cached, but could not be reconstructed for SWOT generation.",
    );
  }

  const prompt = buildSwotPrompt({
    context,
    indicatorNarrative: indicatorStage.renderedOutput,
    provinceDocument,
    nationalDocument,
    webContextSummary: getWebContextSummaryFromStage(webContextStage),
  });
  const stageInput = {
    countryCode: context.country.code,
    indicatorNarrative: indicatorStage.renderedOutput,
    provinceFingerprint: provinceDocument.contentFingerprint,
    nationalFingerprint: nationalDocument.contentFingerprint,
    webContext: getWebContextSummaryFromStage(webContextStage),
    municipality: context.municipality,
    score: context.score,
    evidence: [
      {
        type: "indicator_narrative",
        runId: indicatorStage.runId,
        cacheKey: indicatorStage.cacheKey,
      },
      {
        type: "province_plan",
        url: provinceDocument.sourceUrlOrPath,
        fingerprint: provinceDocument.contentFingerprint,
      },
      {
        type: "national_plan",
        url: nationalDocument.sourceUrlOrPath,
        fingerprint: nationalDocument.contentFingerprint,
      },
      ...(webContextStage?.sourceReferences ?? []),
    ],
  };
  const runContract = buildStageRunContract({
    stage: "swot_analysis",
    context,
    modelName,
    input: stageInput,
    prompt: {
      system: basePlanningSystemPrompt,
      user: prompt,
    },
  });

  return runCachedStage({
    stage: "swot_analysis",
    context,
    modelName,
    mode,
    runContract,
    missingCacheMessage: "No cached SWOT analysis found.",
    generate: async () => {
      const generated = await generateOpenAiText({
        system: basePlanningSystemPrompt,
        prompt,
        model: modelName,
      });

      return toCacheEntry({
        stage: "swot_analysis",
        cacheHit: false,
        renderedOutput: generated.text,
        structuredOutput: {
          countryCode: context.country.code,
          municipality: context.municipality,
          score: context.score,
        },
        sourceReferences: [
          {
            label: "Indicator narrative",
            type: "generated",
            source: "indicator_narrative",
          },
          {
            label: provinceDocument.title,
            type: "document",
            source: provinceDocument.sourceUrlOrPath,
          },
          {
            label: nationalDocument.title,
            type: "document",
            source: nationalDocument.sourceUrlOrPath,
          },
          ...(webContextStage?.sourceReferences ?? []),
        ],
        modelName,
        promptVersion: getAiPromptVersion(),
      });
    },
  });
}

async function runRecommendationsStage(
  context: AiPipelineContext,
  mode: AiStageRequestPayload["mode"],
  resolveDependency: AiStageDependencyResolver,
) {
  const modelName = getOpenAiModel();
  const [indicatorStage, alignmentStage, swotStage] = await Promise.all([
    resolveDependency("indicator_narrative"),
    resolveDependency("plan_alignment"),
    resolveDependency("swot_analysis"),
  ]);
  const webContextStage = await resolveDependency("web_context_search");

  if (!indicatorStage?.renderedOutput || !alignmentStage?.renderedOutput || !swotStage?.renderedOutput) {
    return toFailureStage(
      "investment_recommendations",
      modelName,
      "Indicator narrative, plan alignment, and SWOT analysis must be available before recommendations can run.",
    );
  }

  const prompt = buildInvestmentRecommendationsPrompt({
    context,
    indicatorNarrative: indicatorStage.renderedOutput,
    alignment: alignmentStage.renderedOutput,
    swot: swotStage.renderedOutput,
    webContextSummary: getWebContextSummaryFromStage(webContextStage),
  });
  const stageInput = {
    countryCode: context.country.code,
    indicatorNarrative: indicatorStage.renderedOutput,
    alignment: alignmentStage.renderedOutput,
    swot: swotStage.renderedOutput,
    webContext: getWebContextSummaryFromStage(webContextStage),
    municipality: context.municipality,
    score: context.score,
    evidence: [
      {
        type: "indicator_narrative",
        runId: indicatorStage.runId,
        cacheKey: indicatorStage.cacheKey,
      },
      {
        type: "plan_alignment",
        runId: alignmentStage.runId,
        cacheKey: alignmentStage.cacheKey,
      },
      {
        type: "swot_analysis",
        runId: swotStage.runId,
        cacheKey: swotStage.cacheKey,
      },
      ...(webContextStage?.sourceReferences ?? []),
    ],
  };
  const runContract = buildStageRunContract({
    stage: "investment_recommendations",
    context,
    modelName,
    input: stageInput,
    prompt: {
      system: basePlanningSystemPrompt,
      user: prompt,
    },
  });

  return runCachedStage({
    stage: "investment_recommendations",
    context,
    modelName,
    mode,
    runContract,
    missingCacheMessage: "No cached investment recommendations found.",
    generate: async () => {
      const generated = await generateOpenAiText({
        system: basePlanningSystemPrompt,
        prompt,
        model: modelName,
      });

      return toCacheEntry({
        stage: "investment_recommendations",
        cacheHit: false,
        renderedOutput: generated.text,
        structuredOutput: {
          countryCode: context.country.code,
          municipality: context.municipality,
          score: context.score,
        },
        sourceReferences: [
          {
            label: "Indicator narrative",
            type: "generated",
            source: "indicator_narrative",
          },
          {
            label: "Plan alignment",
            type: "generated",
            source: "plan_alignment",
          },
          {
            label: "SWOT analysis",
            type: "generated",
            source: "swot_analysis",
          },
          ...(webContextStage?.sourceReferences ?? []),
        ],
        modelName,
        promptVersion: getAiPromptVersion(),
      });
    },
  });
}

function createAiStageDispatcher(context: AiPipelineContext) {
  const dependencyPromises = new Map<
    AiStageName,
    Promise<AiStageResponsePayload | null>
  >();

  const dispatch = async (
    stage: AiStageName,
    mode: AiStageRequestPayload["mode"],
  ): Promise<AiStageResponsePayload> => {
    switch (stage) {
      case "indicator_narrative":
        return runIndicatorNarrativeStage(context, mode);
      case "province_plan_context":
        return runProvincePlanStage(context, mode);
      case "national_plan_context":
        return runNationalPlanStage(context, mode);
      case "web_context_search":
        return runWebContextSearchStage(context, mode);
      case "plan_alignment":
        return runAlignmentStage(context, mode, resolveDependency);
      case "swot_analysis":
        return runSwotStage(context, mode, resolveDependency);
      case "investment_recommendations":
        return runRecommendationsStage(context, mode, resolveDependency);
      default:
        return toFailureStage(stage, getOpenAiModel(), "Unsupported AI stage.");
    }
  };

  const resolveDependency: AiStageDependencyResolver = (stage) => {
    const existing = dependencyPromises.get(stage);

    if (existing) {
      return existing;
    }

    const dependency = dispatch(stage, "load_cached").then((response) =>
      response.status === "completed" ? response : null,
    );
    dependencyPromises.set(stage, dependency);
    return dependency;
  };

  return { dispatch };
}

export async function runAiStage(
  stage: AiStageName,
  payload: AiStageRequestPayload,
): Promise<AiStageResponsePayload> {
  const context = await getAiPipelineContextForRequest({
    countryCode: payload.countryCode,
    releaseKey: payload.releaseKey,
    year: payload.year,
    municipalityId: payload.municipalityId,
    scoreId: payload.scoreId,
    includeProvincePlanCandidates: [
      "province_plan_context",
      "plan_alignment",
      "swot_analysis",
      "investment_recommendations",
    ].includes(stage),
  });

  return createAiStageDispatcher(context).dispatch(stage, payload.mode);
}
