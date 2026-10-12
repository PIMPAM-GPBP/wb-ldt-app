import "server-only";

import { createHash } from "node:crypto";

import {
  loadDocumentContext,
  loadLatestDocumentContextBySource,
  saveDocumentContext,
} from "@/lib/ai/cache";
import { fetchPlanDocument } from "@/lib/ai/plan-document-fetch";
import {
  installPdfJsNodePolyfills,
  installPdfWorkerGlobalForNode,
} from "@/lib/ai/pdf-worker";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AiDocumentContext,
  NationalPlanSource,
  ProvincePlanCandidate,
} from "@/lib/ai/types";

const DOCUMENT_EXTRACTION_VERSION = "v2";

type DocumentContextOptions = {
  forceRefresh?: boolean;
};

let pdfParseModulePromise: Promise<typeof import("pdf-parse")> | null = null;

async function loadPdfParseModule() {
  installPdfJsNodePolyfills();
  pdfParseModulePromise ??= import("pdf-parse");
  return pdfParseModulePromise;
}

function toFingerprint(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPassagesFromText(text: string) {
  return text
    .split(/\n{2,}/)
    .map((passage) => passage.trim())
    .filter((passage) => passage.length > 80)
    .slice(0, 80)
    .map((passage, index) => ({
      id: `passage-${index + 1}`,
      title: null,
      text: passage,
    }));
}

function chooseProvincePlan(candidates: ProvincePlanCandidate[]) {
  return [...candidates].sort((left, right) => left.priority - right.priority)[0] ?? null;
}

type PlanDocumentSourceRow = {
  country_code: AiDocumentContext["countryCode"];
  plan_level: "province" | "national";
  province: string | null;
  title: string;
  link: string;
  notes: string | null;
  priority: number;
  document_type: string | null;
  score_theme: string | null;
  is_active: boolean;
};

type PlanDocumentSource = {
  countryCode: AiDocumentContext["countryCode"];
  planLevel: "province" | "national";
  province: string | null;
  title: string;
  link: string;
  notes: string | null;
  priority: number;
  documentType: string | null;
  scoreTheme: string | null;
  isActive: boolean;
};

function isMissingRelationError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : null;
  return code === "PGRST205" || code === "42P01";
}

function getScoreThemeFromScoreId(scoreId: string) {
  const normalized = scoreId.toLowerCase();

  if (normalized.startsWith("prosperity")) {
    return "prosperity";
  }

  if (normalized.startsWith("infrastructure")) {
    return "infrastructure";
  }

  if (normalized.startsWith("livability")) {
    return "livability";
  }

  return null;
}

async function loadPlanDocumentSources(
  countryCode: AiDocumentContext["countryCode"],
): Promise<PlanDocumentSource[]> {
  const supabase = getSupabaseServerClient().schema("analytics");
  const { data, error } = await supabase
    .from("plan_document_sources")
    .select("country_code, plan_level, province, title, link, notes, priority, document_type, score_theme, is_active")
    .eq("country_code", countryCode)
    .eq("is_active", true)
    .order("plan_level", { ascending: true })
    .order("province", { ascending: true })
    .order("priority", { ascending: true });

  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error(
        "Missing analytics.plan_document_sources. Apply the new Supabase migration before running the AI planning-document stages.",
      );
    }

    throw error;
  }

  const sources = ((data ?? []) as PlanDocumentSourceRow[]).map((row) => ({
    countryCode: row.country_code,
    planLevel: row.plan_level,
    province: row.province,
    title: row.title,
    link: row.link,
    notes: row.notes,
    priority: row.priority,
    documentType: row.document_type,
    scoreTheme: row.score_theme,
    isActive: row.is_active,
  }));
  if (sources.length === 0) {
    throw new Error(
      `No ${countryCode} plan-document source rows were found in analytics.plan_document_sources. Run the plan-source ingest first.`,
    );
  }

  return sources;
}

export async function loadProvincePlanCandidates(
  countryCode: AiDocumentContext["countryCode"],
): Promise<ProvincePlanCandidate[]> {
  const sources = await loadPlanDocumentSources(countryCode);
  const provincePlanCandidates = sources
    .filter((source) => source.planLevel === "province" && source.province)
    .map((source) => ({
      countryCode: source.countryCode,
      province: source.province ?? "",
      planUnitName: source.province ?? "",
      planUnitLabel: "local/SNG plan unit",
      title: source.title,
      link: source.link,
      notes: source.notes,
      priority: source.priority,
      documentType: source.documentType,
      scoreTheme: source.scoreTheme,
    }));

  return provincePlanCandidates;
}

export async function getProvincePlanCandidatesForProvince(
  countryCode: AiDocumentContext["countryCode"],
  province: string,
) {
  const candidates = await loadProvincePlanCandidates(countryCode);
  return candidates.filter((candidate) => candidate.province === province);
}

export async function loadNationalPlanSources(
  countryCode: AiDocumentContext["countryCode"],
  scoreId?: string,
): Promise<NationalPlanSource[]> {
  const sources = await loadPlanDocumentSources(countryCode);
  const scoreTheme = scoreId ? getScoreThemeFromScoreId(scoreId) : null;
  const nationalPlanSources = sources
    .filter((source) => source.planLevel === "national")
    .filter((source) => source.scoreTheme === null || scoreTheme === null || source.scoreTheme === scoreTheme)
    .map((source) => ({
      title: source.title,
      link: source.link,
      notes: source.notes,
      priority: source.priority,
      documentType: source.documentType,
      scoreTheme: source.scoreTheme,
    }))
    .sort((left, right) => left.priority - right.priority);

  if (nationalPlanSources.length === 0) {
    throw new Error(
      `No ${countryCode} national-plan source rows were found in analytics.plan_document_sources for the selected score context.`,
    );
  }

  return nationalPlanSources;
}

async function parsePdfFromBuffer(buffer: Buffer) {
  await installPdfWorkerGlobalForNode();
  const { PDFParse } = await loadPdfParseModule();
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text.trim();
}

async function parseRemoteDocument(url: string) {
  const document = await fetchPlanDocument(url);
  const contentType = document.contentType.toLowerCase();
  const finalUrl = document.finalUrl.toLowerCase();

  if (contentType.includes("pdf") || finalUrl.endsWith(".pdf") || url.toLowerCase().endsWith(".pdf")) {
    return parsePdfFromBuffer(document.body);
  }

  const html = document.body.toString("utf8");
  return stripHtml(html);
}

function buildNationalSourceCollectionPath(
  countryCode: AiDocumentContext["countryCode"],
  sources: NationalPlanSource[],
) {
  const sourceDescriptor = sources
    .map((source) => `${source.title}|${source.link}|${source.scoreTheme ?? "all"}`)
    .join("||");
  return `supabase://analytics.plan_document_sources/${countryCode}/national/${toFingerprint(sourceDescriptor)}`;
}

export async function getNationalPlanContext(
  countryCode: AiDocumentContext["countryCode"],
  scoreId?: string,
  { forceRefresh = false }: DocumentContextOptions = {},
): Promise<{
  context: AiDocumentContext;
  sources: NationalPlanSource[];
}> {
  const sources = await loadNationalPlanSources(countryCode, scoreId);
  const sourceCollectionPath = buildNationalSourceCollectionPath(countryCode, sources);
  const sourceFingerprint = toFingerprint(sources.map((source) => source.link).join("||"));
  if (!forceRefresh) {
    const latestCached = await loadLatestDocumentContextBySource(
      countryCode,
      "national_plan",
      null,
      sourceCollectionPath,
      DOCUMENT_EXTRACTION_VERSION,
    );

    if (latestCached) {
      return {
        context: latestCached,
        sources,
      };
    }

    const cached = await loadDocumentContext(
      countryCode,
      "national_plan",
      null,
      sourceCollectionPath,
      sourceFingerprint,
      DOCUMENT_EXTRACTION_VERSION,
    );

    if (cached) {
      return {
        context: cached,
        sources,
      };
    }
  }

  const extractedDocuments = await Promise.all(
    sources.map(async (source) => ({
      source,
      extractedText: await parseRemoteDocument(source.link),
    })),
  );
  const extractedText = extractedDocuments
    .map(({ source, extractedText: text }, index) =>
      [
        `Document ${index + 1}: ${source.title}`,
        `Source: ${source.link}`,
        "",
        text,
      ].join("\n"),
    )
    .join("\n\n---\n\n");
  const contentFingerprint = toFingerprint(
    extractedDocuments
      .map(({ source, extractedText: text }) => `${source.title}\n${source.link}\n${text}`)
      .join("\n\n===\n\n"),
  );
  const recached = await loadDocumentContext(
    countryCode,
    "national_plan",
    null,
    sourceCollectionPath,
    contentFingerprint,
    DOCUMENT_EXTRACTION_VERSION,
  );

  if (recached) {
    return {
      context: recached,
      sources,
    };
  }

  const context: AiDocumentContext = {
    countryCode,
    sourceType: "national_plan",
    title:
      sources.length === 1
        ? sources[0]?.title ?? `${countryCode} National Plan`
        : `${countryCode} national planning corpus (${sources.length} documents)`,
    province: null,
    sourceUrlOrPath: sourceCollectionPath,
    contentMode: "full_text",
    extractedText,
    passages: buildPassagesFromText(extractedText),
    chunks: [],
    extractionMetadata: {
      parser: "remote_plan_sources",
      sourceCount: sources.length,
      sources: sources.map((source) => ({
        title: source.title,
        link: source.link,
        documentType: source.documentType,
        scoreTheme: source.scoreTheme,
        priority: source.priority,
      })),
      chunkingReady: true,
    },
    contentFingerprint,
    extractionVersion: DOCUMENT_EXTRACTION_VERSION,
  };

  await saveDocumentContext(context);
  return {
    context,
    sources,
  };
}

export async function getProvincePlanContext(
  countryCode: AiDocumentContext["countryCode"],
  province: string,
  planUnitLabel = "local/SNG plan unit",
  { forceRefresh = false }: DocumentContextOptions = {},
): Promise<{
  context: AiDocumentContext;
  candidates: ProvincePlanCandidate[];
}> {
  const candidates = await getProvincePlanCandidatesForProvince(countryCode, province);
  const chosen = chooseProvincePlan(candidates);

  if (!chosen) {
    throw new Error(`No local/SNG plan link found for ${province}.`);
  }

  const sourceUrlOrPath = chosen.link;
  if (!forceRefresh) {
    const latestCached = await loadLatestDocumentContextBySource(
      countryCode,
      "province_plan",
      province,
      sourceUrlOrPath,
      DOCUMENT_EXTRACTION_VERSION,
    );

    if (latestCached) {
      return {
        context: latestCached,
        candidates,
      };
    }

    const cached = await loadDocumentContext(
      countryCode,
      "province_plan",
      province,
      sourceUrlOrPath,
      toFingerprint(sourceUrlOrPath),
      DOCUMENT_EXTRACTION_VERSION,
    );

    if (cached) {
      return {
        context: cached,
        candidates,
      };
    }
  }

  const extractedText = await parseRemoteDocument(sourceUrlOrPath);
  const contentFingerprint = toFingerprint(extractedText);
  const recached = await loadDocumentContext(
    countryCode,
    "province_plan",
    province,
    sourceUrlOrPath,
    contentFingerprint,
    DOCUMENT_EXTRACTION_VERSION,
  );

  if (recached) {
    return {
      context: recached,
      candidates,
    };
  }

  const context: AiDocumentContext = {
    countryCode,
    sourceType: "province_plan",
    title: chosen.title || `${province} local development plan`,
    province,
    sourceUrlOrPath,
    contentMode: "full_text",
    extractedText,
    passages: buildPassagesFromText(extractedText),
    chunks: [],
    extractionMetadata: {
      notes: chosen.notes,
      planUnitLabel,
      parser: sourceUrlOrPath.toLowerCase().endsWith(".pdf") ? "pdf-parse" : "html-strip",
      candidateCount: candidates.length,
      chunkingReady: true,
    },
    contentFingerprint,
    extractionVersion: DOCUMENT_EXTRACTION_VERSION,
  };

  await saveDocumentContext(context);

  return {
    context,
    candidates,
  };
}
