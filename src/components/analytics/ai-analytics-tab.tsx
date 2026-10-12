"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AiIndicatorChart } from "@/components/analytics/ai-indicator-chart";
import {
  AiAlignmentResult,
  AiIndicatorNarrativeResult,
  AiRecommendationsResult,
  AiSwotResult,
  AiWebContextResult,
  buildRegionalIndicatorRows,
  parseNarrativeSections,
  sectionBodyForTitle,
} from "@/components/analytics/ai-result-renderers";
import type { RegionalIndicatorRow } from "@/components/analytics/ai-result-renderers";
import { AiStageCard } from "@/components/analytics/ai-stage-card";
import {
  createAiStageActionCoordinator,
  hydrateAiStageResults,
  prepareAiStageAction,
  runAiStageAction,
} from "@/lib/ai/client";
import type {
  AiStageAction,
  AiStageResults,
} from "@/lib/ai/client";
import { buildAiBriefMarkdownExport } from "@/lib/ai/export";
import type {
  AiStageName,
  AiStageResponsePayload,
  AiTabData,
} from "@/lib/ai/types";
import { countries } from "@/lib/countries";
import type { AnalyticsPageData } from "@/types/analytics";

const planningContextStages: AiStageName[] = [
  "province_plan_context",
  "national_plan_context",
  "plan_alignment",
];

const exportStageLabels: Array<{ stage: AiStageName; label: string }> = [
  { stage: "indicator_narrative", label: "Component score analysis" },
  { stage: "province_plan_context", label: "Local/SNG plan context" },
  { stage: "national_plan_context", label: "National plan context" },
  { stage: "plan_alignment", label: "Plan alignment" },
  { stage: "web_context_search", label: "Web context" },
  { stage: "swot_analysis", label: "SWOT analysis" },
  { stage: "investment_recommendations", label: "Public investment recommendations" },
];

type AiAnalyticsTabProps = {
  release: AnalyticsPageData["release"];
  selected: AnalyticsPageData["selected"];
  municipality: AnalyticsPageData["municipality"];
  ai: AiTabData;
};

type WorkflowState = "complete" | "running" | "failed" | "blocked" | "optional" | "ready";

type WorkflowStep = {
  number: string;
  title: string;
  detail: string;
  state: WorkflowState;
};

function StageButton({
  onClick,
  label,
  disabled = false,
  tone = "secondary",
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  tone?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-[42px] items-center justify-center rounded-full px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "primary"
          ? "bg-[var(--accent)] text-white shadow-[0_12px_28px_rgba(54,117,183,0.24)]"
          : "border border-[var(--border-soft)] bg-white/80 text-[var(--foreground)]"
      }`}
    >
      {label}
    </button>
  );
}

function WorkflowProgressRail({ steps }: { steps: WorkflowStep[] }) {
  const stateStyles: Record<WorkflowState, string> = {
    complete: "border-[rgba(84,162,75,0.34)] bg-[rgba(84,162,75,0.10)] text-[#2f7a2a]",
    running: "border-[rgba(54,117,183,0.42)] bg-[rgba(54,117,183,0.12)] text-[var(--accent)]",
    failed: "border-[rgba(228,87,86,0.34)] bg-[rgba(228,87,86,0.10)] text-[#b23b3a]",
    blocked: "border-[rgba(148,163,184,0.55)] bg-[rgba(148,163,184,0.16)] text-[var(--foreground)]",
    optional: "border-[rgba(251,191,36,0.36)] bg-[rgba(251,191,36,0.10)] text-[#8a6416]",
    ready: "border-[rgba(54,117,183,0.24)] bg-white/80 text-[var(--foreground)]",
  };

  const stateLabels: Record<WorkflowState, string> = {
    complete: "Complete",
    running: "Running",
    failed: "Needs review",
    blocked: "Blocked",
    optional: "Optional",
    ready: "Ready",
  };

  return (
    <section className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-[0_14px_36px_rgba(2,20,32,0.06)]">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Workflow state
          </p>
          <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">
            AI recommendation pipeline
          </h3>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
          Scan what is ready, blocked, optional, or already grounded in cached evidence before opening result details.
        </p>
      </div>
      <ol className="mt-4 grid gap-3 lg:grid-cols-5">
        {steps.map((step) => (
          <li
            key={step.number}
            className={`rounded-[1rem] border p-3 ${stateStyles[step.state]}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-xs font-semibold">
                {step.number}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                {stateLabels[step.state]}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold">{step.title}</p>
            <p className="mt-1 text-xs leading-5 opacity-80">{step.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function WorkflowGuideCard({
  unitName,
  regionName,
  scoreLabel,
  localPlanUnitName,
  localPlanAvailable,
}: {
  unitName: string;
  regionName: string;
  scoreLabel: string;
  localPlanUnitName: string;
  localPlanAvailable: boolean;
}) {
  const workflowGuidance = [
    {
      title: "Start with score evidence",
      body: "Use component charts and the score narrative to understand what is strengthening or weakening the selected theme.",
    },
    {
      title: "Ground the read in plans",
      body: localPlanAvailable
        ? "Load local/SNG and national plan context, then run alignment before generating SWOT or recommendations."
        : "Run national plan context only. Local alignment, SWOT, and recommendations remain blocked until a local/SNG plan URL is available.",
    },
    {
      title: "Add web context only when useful",
      body: "Use web context for recent public information, but treat it as supplemental to the indicator and planning evidence.",
    },
    {
      title: "Synthesize last",
      body: "Generate SWOT and investment recommendations only after the evidence base is complete enough to support them.",
    },
  ];

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-[0_14px_36px_rgba(2,20,32,0.06)]">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Recommended workflow
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--foreground)]">
            Build the planning brief in evidence order
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted-foreground)]">
            Run stages from diagnostic evidence to planning context, then synthesis.
            This keeps AI outputs traceable and prevents recommendations from being generated before the source base is ready.
          </p>

          <ol className="mt-5 grid gap-3 md:grid-cols-2">
            {workflowGuidance.map((item, index) => (
              <li
                key={item.title}
                className="rounded-[1.1rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <h4 className="text-sm font-semibold text-[var(--foreground)]">
                    {item.title}
                  </h4>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <aside className="border-t border-[var(--border-soft)] bg-[var(--surface)] p-5 xl:border-l xl:border-t-0">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Current setup
          </p>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Local unit
              </dt>
              <dd className="mt-1 font-medium text-[var(--foreground)]">
                {unitName}
              </dd>
              <dd className="mt-1 text-[var(--muted-foreground)]">
                {regionName}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Score theme
              </dt>
              <dd className="mt-1 font-medium text-[var(--foreground)]">
                {scoreLabel}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Local/SNG plan
              </dt>
              <dd className="mt-2">
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                    localPlanAvailable
                      ? "border-[#2b8a3e]/45 bg-[#2b8a3e]/12 text-[#2b8a3e]"
                      : "border-[#c7923e]/45 bg-[#c7923e]/12 text-[#9a6400] dark:text-[#f4c15d]"
                  }`}
                >
                  {localPlanAvailable ? "Ready for alignment" : "National context only"}
                </span>
              </dd>
              <dd className="mt-2 text-[var(--muted-foreground)]">
                Plan unit: {localPlanUnitName}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}

function getStringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function toFilenamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "brief";
}

function PlanningEvidencePanel({
  title,
  result,
  emptyMessage,
}: {
  title: string;
  result?: AiStageResponsePayload;
  emptyMessage?: string | null;
}) {
  const extractedText = getStringValue(result?.structuredOutput.extractedText);
  const summaryText = result?.renderedOutput ?? extractedText;
  const proofText = [result?.renderedOutput, extractedText]
    .filter((value): value is string => Boolean(value))
    .join("\n\n--- Extracted source text ---\n\n");
  const previewText = summaryText
    ? summaryText.replace(/\s+/g, " ").trim().slice(0, 420)
    : null;

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-white/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-[var(--foreground)]">{title}</h4>
        {result ? (
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
              result.status === "completed"
                ? "bg-[rgba(44,123,229,0.10)] text-[var(--accent)]"
                : "bg-[rgba(214,64,69,0.10)] text-[var(--danger)]"
            }`}
          >
            {result.status}
          </span>
        ) : null}
      </div>
      {result?.status === "failed" ? (
        <p className="mt-3 text-sm text-[var(--danger)]">
          {result.errorMessage ?? "This planning context stage failed."}
        </p>
      ) : previewText ? (
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
          {previewText}
          {summaryText && summaryText.length > previewText.length ? "..." : ""}
        </p>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          {emptyMessage ?? "Not generated yet."}
        </p>
      )}
      {proofText ? (
        <details className="mt-3 rounded-[1rem] border border-[var(--border-soft)] bg-white/80 p-3">
          <summary className="cursor-pointer text-sm font-medium text-[var(--foreground)]">
            Show full proof text
          </summary>
          <div className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-sm leading-7 text-[var(--foreground)]">
            {proofText}
          </div>
        </details>
      ) : null}
      {result?.sourceReferences.length ? (
        <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            Sources
          </p>
          <ul className="mt-2 space-y-2 text-xs leading-5 text-[var(--muted-foreground)]">
            {result.sourceReferences.map((source, index) => (
              <li key={`${source.type}-${source.label}-${source.source}-${index}`}>
                <span className="font-medium text-[var(--foreground)]">{source.label}</span>
                {" - "}
                <span>{source.source}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type AiStageLoading = Partial<Record<AiStageName, string>>;

export function AiAnalyticsTab({
  release,
  selected,
  municipality,
  ai,
}: AiAnalyticsTabProps) {
  const [stageResults, setStageResults] = useState<AiStageResults>(
    ai.cachedStages as AiStageResults,
  );
  const [loadingStages, setLoadingStages] = useState<AiStageLoading>({});
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(false);
  const [isExplicitActionRunning, setIsExplicitActionRunning] = useState(false);
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const hydrationControllerRef = useRef<AbortController | null>(null);
  const scopeVersionRef = useRef(0);
  const actionCoordinator = useMemo(() => createAiStageActionCoordinator(), []);

  const basePayload = useMemo(
    () => ({
      countryCode: release.countryCode,
      releaseKey: release.key,
      year: release.year,
      municipalityId: municipality.id,
      scoreId: ai.selectedScoreId,
    }),
    [ai.selectedScoreId, municipality.id, release.countryCode, release.key, release.year],
  );

  useEffect(() => {
    const controller = new AbortController();
    const scopeVersion = ++scopeVersionRef.current;
    hydrationControllerRef.current = controller;

    queueMicrotask(() => {
      if (controller.signal.aborted || scopeVersionRef.current !== scopeVersion) {
        return;
      }

      setHydrationError(null);
      setIsHydrating(true);
    });

    void hydrateAiStageResults(basePayload, { signal: controller.signal })
      .then((results) => {
        if (controller.signal.aborted || scopeVersionRef.current !== scopeVersion) {
          return;
        }

        setStageResults(results);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || scopeVersionRef.current !== scopeVersion) {
          return;
        }

        setHydrationError(
          error instanceof Error
            ? error.message
            : "Unable to restore saved AI results.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted && scopeVersionRef.current === scopeVersion) {
          setIsHydrating(false);
        }
      });

    return () => {
      controller.abort();
      actionCoordinator.cancel();
      if (hydrationControllerRef.current === controller) {
        hydrationControllerRef.current = null;
      }
      scopeVersionRef.current += 1;
    };
  }, [actionCoordinator, basePayload, hydrationAttempt]);

  const beginExplicitAction = useCallback(() => {
    const action = actionCoordinator.begin(stageResults);

    if (!action) {
      return null;
    }

    hydrationControllerRef.current?.abort();
    hydrationControllerRef.current = null;
    setIsHydrating(false);
    setHydrationError(null);
    setIsExplicitActionRunning(true);
    return action;
  }, [actionCoordinator, stageResults]);

  const finishExplicitAction = useCallback((action: AiStageAction) => {
    if (!actionCoordinator.isCurrent(action)) {
      return;
    }

    actionCoordinator.finish(action);
    setIsExplicitActionRunning(false);
  }, [actionCoordinator]);

  const runStage = useCallback(async function runStage(
    stage: AiStageName,
    mode: "generate" | "regenerate" | "load_cached",
    action?: AiStageAction,
  ): Promise<AiStageResponsePayload | null> {
    const ownsAction = !action;
    const currentAction = action ?? beginExplicitAction();

    if (!currentAction) {
      return null;
    }

    if (!actionCoordinator.isCurrent(currentAction)) {
      return null;
    }

    setLoadingStages((current) => ({ ...current, [stage]: mode }));
    setStageResults(prepareAiStageAction(currentAction, stage));

    try {
      const result = await runAiStageAction({
        coordinator: actionCoordinator,
        action: currentAction,
        stage,
        mode,
        scope: basePayload,
      });

      if (result.status === "applied" && actionCoordinator.isCurrent(currentAction)) {
        setStageResults(result.results);
      }

      return result.response;
    } finally {
      if (actionCoordinator.isCurrent(currentAction)) {
        setLoadingStages((current) => {
          const next = { ...current };
          delete next[stage];
          return next;
        });
      }

      if (ownsAction) {
        finishExplicitAction(currentAction);
      }
    }
  }, [
    actionCoordinator,
    basePayload,
    beginExplicitAction,
    finishExplicitAction,
  ]);

  const hasIndicatorNarrative = stageResults.indicator_narrative?.status === "completed";
  const hasAlignment = stageResults.plan_alignment?.status === "completed";
  const hasWebContext = stageResults.web_context_search?.status === "completed";
  const hasSwot = stageResults.swot_analysis?.status === "completed";
  const isPlanningContextLoading = planningContextStages.some((stage) => loadingStages[stage]);
  const hasAnyPlanningContextResult = planningContextStages.some((stage) => stageResults[stage]);
  const selectedScoreLabel =
    ai.scoreOptions.find((option) => option.id === ai.selectedScoreId)?.label ??
    ai.selectedScoreId;
  const countryName =
    countries.find((country) => country.code === release.countryCode)?.name ??
    release.countryCode;
  const hasAnyStageResult = exportStageLabels.some(({ stage }) => Boolean(stageResults[stage]));

  function retryHydration() {
    setHydrationAttempt((attempt) => attempt + 1);
  }

  function downloadAiBrief() {
    if (!hasAnyStageResult) {
      return;
    }

    const markdown = buildAiBriefMarkdownExport({
      countryName,
      municipalityName: municipality.municipality,
      provinceName: municipality.province,
      scoreLabel: selectedScoreLabel,
      releaseKey: release.key,
      year: release.year,
      generatedAt: new Date().toISOString(),
      stages: exportStageLabels.map(({ stage, label }) => ({
        label,
        result: stageResults[stage] ?? null,
      })),
    });
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = [
      "ldt-ai-brief",
      toFilenamePart(municipality.municipality),
      toFilenamePart(selectedScoreLabel),
      release.year,
    ].join("-") + ".md";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function getWorkflowState(
    stages: AiStageName[],
    options?: { blocked?: boolean; optional?: boolean },
  ): WorkflowState {
    if (stages.some((stage) => loadingStages[stage])) {
      return "running";
    }
    if (stages.some((stage) => stageResults[stage]?.status === "failed")) {
      return "failed";
    }
    if (stages.every((stage) => stageResults[stage]?.status === "completed")) {
      return "complete";
    }
    if (options?.blocked) {
      return "blocked";
    }
    if (options?.optional) {
      return "optional";
    }
    return "ready";
  }

  async function runPlanningContext(mode: "generate" | "regenerate") {
    const action = beginExplicitAction();
    if (!action) {
      return;
    }

    try {
      const nationalContext = await runStage("national_plan_context", mode, action);
      if (nationalContext?.status !== "completed") {
        return;
      }

      if (!ai.localPlanAvailable) {
        return;
      }

      const provinceContext = await runStage("province_plan_context", mode, action);
      if (provinceContext?.status !== "completed") {
        return;
      }

      await runStage("plan_alignment", mode, action);
    } finally {
      finishExplicitAction(action);
    }
  }

  function buildStageActions(stage: AiStageName, disabled: boolean) {
    return (
      <>
        <StageButton
          label={loadingStages[stage] ? "Working..." : "Run step"}
          onClick={() => void runStage(stage, "generate")}
          disabled={isExplicitActionRunning || Boolean(loadingStages[stage]) || disabled}
          tone="primary"
        />
        <StageButton
          label={loadingStages[stage] ? "Working..." : "Regenerate"}
          onClick={() => void runStage(stage, "regenerate")}
          disabled={isExplicitActionRunning || Boolean(loadingStages[stage]) || disabled}
        />
      </>
    );
  }

  function buildIndicatorFooterActions() {
    const stage = "indicator_narrative";
    const hasResult = Boolean(stageResults[stage]);
    const isLoading = Boolean(loadingStages[stage]);

    return hasResult ? (
      <StageButton
        label={isLoading ? "Working..." : "Regenerate analysis"}
        onClick={() => void runStage(stage, "regenerate")}
        disabled={isExplicitActionRunning || isLoading}
      />
    ) : (
      <StageButton
        label={isLoading ? "Working..." : "Run analysis"}
        onClick={() => void runStage(stage, "generate")}
        disabled={isExplicitActionRunning || isLoading}
        tone="primary"
      />
    );
  }

  const indicatorFooterActions = buildIndicatorFooterActions();
  const indicatorDiagnostics = useMemo(() => {
    const narrativeOutput = stageResults.indicator_narrative?.renderedOutput ?? "";
    if (!narrativeOutput) {
      return new Map<string, RegionalIndicatorRow>();
    }

    const { sections } = parseNarrativeSections(narrativeOutput);
    const strengthening = sectionBodyForTitle(sections, /strengthening/i);
    const weakening = sectionBodyForTitle(sections, /weakening/i);

    return new Map(
      buildRegionalIndicatorRows(ai.indicatorSeries, strengthening, weakening).map((row) => [
        row.label,
        row,
      ]),
    );
  }, [ai.indicatorSeries, stageResults.indicator_narrative?.renderedOutput]);
  const workflowSteps: WorkflowStep[] = [
    {
      number: "1",
      title: "Score evidence",
      detail: "Component charts and narrative",
      state: getWorkflowState(["indicator_narrative"]),
    },
    {
      number: "2",
      title: "Plan alignment",
      detail: ai.localPlanAvailable
        ? "Local/SNG, national, and comparison"
        : "National context only until local URL exists",
      state: ai.localPlanAvailable
        ? getWorkflowState(planningContextStages)
        : getWorkflowState(["national_plan_context"], { optional: true }),
    },
    {
      number: "3",
      title: "Web context",
      detail: hasWebContext ? "Included in later stages" : "Optional enrichment",
      state: getWorkflowState(["web_context_search"], { optional: true }),
    },
    {
      number: "4",
      title: "SWOT",
      detail: "Evidence-backed planning read",
      state: getWorkflowState(["swot_analysis"], {
        blocked: !hasIndicatorNarrative || !hasAlignment,
      }),
    },
    {
      number: "5",
      title: "Recommendations",
      detail: "Ranked public investments",
      state: getWorkflowState(["investment_recommendations"], {
        blocked: !hasIndicatorNarrative || !hasAlignment || !hasSwot,
      }),
    },
  ];

  return (
    <div className="space-y-5">
      <AiStageCard
        eyebrow="AI planning workflow"
        title="Choose local unit and score"
        description="Use the shared local-unit selector in the sidebar, then choose the score theme for the AI planning workflow here. The AI flow currently supports only Prosperity, Infrastructure, and Livability."
        showEvidenceGap={false}
        actions={
          <StageButton
            label="Download brief"
            onClick={downloadAiBrief}
            disabled={!hasAnyStageResult || isExplicitActionRunning}
          />
        }
      >
        <form className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <input type="hidden" name="tab" value="ai" />
          <input type="hidden" name="year" value={String(selected.year)} />
          <input type="hidden" name="province" value={selected.province} />
          <input type="hidden" name="municipality" value={selected.municipalityId} />
          <input type="hidden" name="metric" value={selected.metricId} />
          <input type="hidden" name="x" value={selected.xMetricId} />
          <input type="hidden" name="y" value={selected.yMetricId} />
          <label className="flex min-w-0 w-full flex-col gap-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              AI score theme
            </span>
            <select
              name="ai_score"
              defaultValue={ai.selectedScoreId}
              className="w-full min-w-0 rounded-2xl border border-[var(--border-soft)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none"
            >
              {ai.scoreOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex h-[46px] items-center justify-center self-end rounded-full bg-[var(--accent)] px-5 text-sm font-medium text-white shadow-[0_12px_28px_rgba(54,117,183,0.24)]"
          >
            Apply
          </button>
        </form>
      </AiStageCard>

      <WorkflowGuideCard
        unitName={municipality.municipality}
        regionName={municipality.province}
        scoreLabel={selectedScoreLabel}
        localPlanUnitName={ai.localPlanUnitName}
        localPlanAvailable={ai.localPlanAvailable}
      />

      <WorkflowProgressRail steps={workflowSteps} />

      {isHydrating ? (
        <p
          role="status"
          className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--muted-foreground)]"
        >
          Checking saved AI results for this release, local unit, and score theme...
        </p>
      ) : null}
      {hydrationError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgba(228,87,86,0.34)] bg-[rgba(228,87,86,0.08)] px-4 py-3 text-sm text-[#b23b3a]"
        >
          <span>{hydrationError}</span>
          <StageButton
            label={isHydrating ? "Retrying..." : "Retry saved results"}
            onClick={retryHydration}
            disabled={isHydrating || isExplicitActionRunning}
          />
        </div>
      ) : null}

      <AiStageCard
        eyebrow="Step 1"
        title="Component score analysis"
        description={`Review the component-score evidence for ${municipality.municipality}, ${municipality.province}. The narrative stage is prompted only from the score-component series, with no planning-document context injected.`}
        result={stageResults.indicator_narrative}
        resultContent={
          stageResults.indicator_narrative ? (
            <AiIndicatorNarrativeResult
              result={stageResults.indicator_narrative}
              indicatorSeries={ai.indicatorSeries}
            />
          ) : null
        }
        footerActions={indicatorFooterActions}
      >
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {ai.indicatorSeries.map((series) => (
            <AiIndicatorChart
              key={series.componentId}
              series={series}
              municipalityLabel={municipality.municipality}
              provinceLabel={municipality.province}
              diagnostic={indicatorDiagnostics.get(series.label)}
            />
          ))}
        </div>
      </AiStageCard>

      <AiStageCard
        eyebrow="Step 2"
        title="Planning context and alignment"
        description={
          ai.localPlanAvailable
            ? `Retrieve the ${ai.localPlanUnitName} local/SNG plan context and national plan context, then compare them for the selected unit and score theme.`
            : `No local/SNG plan URL is available for ${ai.localPlanUnitName}. You can still run national plan context; local alignment, SWOT, and recommendations remain blocked for this unit.`
        }
        showEvidenceGap={false}
        actions={
          <>
            <StageButton
              label={
                isPlanningContextLoading
                  ? "Working..."
                  : ai.localPlanAvailable
                    ? "Run planning alignment"
                    : "Run national context"
              }
              onClick={() => void runPlanningContext("generate")}
              disabled={isExplicitActionRunning || isPlanningContextLoading}
              tone="primary"
            />
            <StageButton
              label={isPlanningContextLoading ? "Working..." : "Regenerate alignment"}
              onClick={() => void runPlanningContext("regenerate")}
              disabled={
                isExplicitActionRunning ||
                isPlanningContextLoading ||
                !hasAnyPlanningContextResult ||
                !ai.localPlanAvailable
              }
            />
          </>
        }
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <PlanningEvidencePanel
            title="Local/SNG plan context"
            result={stageResults.province_plan_context}
            emptyMessage={ai.localPlanUnavailableMessage}
          />
          <PlanningEvidencePanel
            title="National plan context"
            result={stageResults.national_plan_context}
          />
        </div>
        {stageResults.plan_alignment ? (
          <div className="mt-4">
            <AiAlignmentResult result={stageResults.plan_alignment} />
          </div>
        ) : null}
      </AiStageCard>

      <AiStageCard
        eyebrow="Step 3"
        title="Add current web context"
        description="Optionally search the web for additional public context relevant to the selected unit, country, and score. This can enrich later SWOT and recommendation stages without replacing the planning documents."
        actions={buildStageActions("web_context_search", false)}
        result={stageResults.web_context_search}
        resultContent={
          stageResults.web_context_search ? (
            <AiWebContextResult result={stageResults.web_context_search} />
          ) : null
        }
      />

      <AiStageCard
        eyebrow="Step 4"
        title="SWOT analysis"
        description="Generate a local-unit SWOT grounded in the chosen score, the indicator narrative, current local and national plan contexts, and any optional web context. The workflow still gates SWOT on planning alignment completion."
        actions={buildStageActions(
          "swot_analysis",
          !hasIndicatorNarrative || !hasAlignment || !ai.localPlanAvailable,
        )}
        result={stageResults.swot_analysis}
        resultContent={
          stageResults.swot_analysis ? (
            <AiSwotResult result={stageResults.swot_analysis} />
          ) : null
        }
      />

      <AiStageCard
        eyebrow="Step 5"
        title="Public investment recommendations"
        description="Generate public project investment recommendations grounded in the accumulated evidence rather than in a separate concept-note stage."
        actions={buildStageActions(
          "investment_recommendations",
          !hasIndicatorNarrative || !hasAlignment || !hasSwot || !ai.localPlanAvailable,
        )}
        result={stageResults.investment_recommendations}
        resultContent={
          stageResults.investment_recommendations ? (
            <AiRecommendationsResult result={stageResults.investment_recommendations} />
          ) : null
        }
      />
    </div>
  );
}
