import type {
  AiStageName,
  AiStageRequestPayload,
  AiStageResponsePayload,
} from "@/lib/ai/types";

export const aiStageRouteMap: Record<AiStageName, string> = {
  indicator_narrative: "/api/ai/indicator-narrative",
  province_plan_context: "/api/ai/province-plan-context",
  national_plan_context: "/api/ai/national-plan-context",
  web_context_search: "/api/ai/web-context-search",
  plan_alignment: "/api/ai/plan-alignment",
  swot_analysis: "/api/ai/swot-analysis",
  investment_recommendations: "/api/ai/investment-recommendations",
};

const independentAiStages: AiStageName[] = [
  "indicator_narrative",
  "province_plan_context",
  "national_plan_context",
  "web_context_search",
];

const aiStageDownstream: Record<AiStageName, AiStageName[]> = {
  indicator_narrative: ["swot_analysis", "investment_recommendations"],
  province_plan_context: ["plan_alignment", "swot_analysis", "investment_recommendations"],
  national_plan_context: ["plan_alignment", "swot_analysis", "investment_recommendations"],
  web_context_search: ["plan_alignment", "swot_analysis", "investment_recommendations"],
  plan_alignment: ["investment_recommendations"],
  swot_analysis: ["investment_recommendations"],
  investment_recommendations: [],
};

export type AiStageRequestScope = Omit<AiStageRequestPayload, "mode">;
export type AiStageResults = Partial<Record<AiStageName, AiStageResponsePayload>>;

export type AiStageAction = {
  readonly id: number;
  readonly controller: AbortController;
  results: AiStageResults;
  inFlight: AiStageName | null;
};

export type AiStageActionResult = {
  status: "applied" | "busy" | "stale";
  response: AiStageResponsePayload | null;
  results: AiStageResults;
};

export type AiStageActionCoordinator = {
  begin(initialResults: AiStageResults): AiStageAction | null;
  isCurrent(action: AiStageAction): boolean;
  finish(action: AiStageAction): void;
  cancel(): void;
};

type RequestAiStageOptions = {
  mode: AiStageRequestPayload["mode"];
  signal?: AbortSignal;
  baseUrl?: string;
};

type HydrateAiStagesOptions = {
  signal?: AbortSignal;
  baseUrl?: string;
};

export class AiStageRequestError extends Error {
  readonly stage: AiStageName;
  readonly status: number | null;

  constructor(stage: AiStageName, message: string, status: number | null = null) {
    super(message);
    this.name = "AiStageRequestError";
    this.stage = stage;
    this.status = status;
  }
}

export function toFailedAiStagePayload(
  stage: AiStageName,
  payload: unknown,
): AiStageResponsePayload {
  const errorPayload =
    payload && typeof payload === "object"
      ? (payload as { error?: unknown; errorMessage?: unknown })
      : null;
  const errorMessage =
    typeof errorPayload?.errorMessage === "string"
      ? errorPayload.errorMessage
      : typeof errorPayload?.error === "string"
        ? errorPayload.error
        : "The AI stage request failed.";

  return {
    stage,
    status: "failed",
    cacheHit: false,
    cacheStatus: "failed",
    renderedOutput: null,
    structuredOutput: {},
    sourceReferences: [],
    modelName: "n/a",
    promptVersion: "n/a",
    updatedAt: new Date().toISOString(),
    errorMessage,
  };
}

export function createAiStageActionCoordinator(): AiStageActionCoordinator {
  let nextActionId = 0;
  let activeAction: AiStageAction | null = null;

  return {
    begin(initialResults) {
      if (activeAction) {
        return null;
      }

      const action: AiStageAction = {
        id: ++nextActionId,
        controller: new AbortController(),
        results: { ...initialResults },
        inFlight: null,
      };
      activeAction = action;
      return action;
    },

    isCurrent(action) {
      return activeAction?.id === action.id && !action.controller.signal.aborted;
    },

    finish(action) {
      if (activeAction?.id === action.id) {
        activeAction = null;
      }
    },

    cancel() {
      activeAction?.controller.abort();
      activeAction = null;
    },
  };
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function getStageUrl(stage: AiStageName, baseUrl?: string) {
  const route = aiStageRouteMap[stage];

  if (!baseUrl) {
    return route;
  }

  return new URL(route, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

function parseJsonBody(stage: AiStageName, response: Response, rawBody: string) {
  if (response.headers.get("content-type")?.toLowerCase().includes("text/html")) {
    throw new AiStageRequestError(
      stage,
      `AI stage ${stage} returned HTML instead of JSON (HTTP ${response.status}).`,
      response.status,
    );
  }

  try {
    return rawBody ? (JSON.parse(rawBody) as unknown) : null;
  } catch {
    throw new AiStageRequestError(
      stage,
      `AI stage ${stage} returned invalid JSON (HTTP ${response.status}).`,
      response.status,
    );
  }
}

export async function requestAiStage(
  stage: AiStageName,
  scope: AiStageRequestScope,
  { mode, signal, baseUrl }: RequestAiStageOptions,
): Promise<AiStageResponsePayload> {
  let response: Response;

  try {
    response = await fetch(getStageUrl(stage, baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...scope,
        mode,
      }),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unknown network error.";
    throw new AiStageRequestError(
      stage,
      `Unable to reach AI stage ${stage}: ${message}`,
    );
  }

  const rawBody = await response.text();
  const payload = parseJsonBody(stage, response, rawBody);

  if (!response.ok) {
    if (payload && typeof payload === "object") {
      return toFailedAiStagePayload(stage, payload);
    }

    throw new AiStageRequestError(
      stage,
      `AI stage ${stage} returned HTTP ${response.status}.`,
      response.status,
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new AiStageRequestError(
      stage,
      `AI stage ${stage} returned an empty JSON response (HTTP ${response.status}).`,
      response.status,
    );
  }

  const responsePayload = payload as Partial<AiStageResponsePayload>;
  if (responsePayload.stage !== stage || (responsePayload.status !== "completed" && responsePayload.status !== "failed")) {
    throw new AiStageRequestError(
      stage,
      `AI stage ${stage} returned an invalid response shape (HTTP ${response.status}).`,
      response.status,
    );
  }

  return responsePayload as AiStageResponsePayload;
}

export function isAiCacheMiss(response: AiStageResponsePayload) {
  return response.status === "failed" && response.errorMessage?.toLowerCase().includes("no cached");
}

export function prepareAiStageAction(
  action: AiStageAction,
  changedStage: AiStageName,
) {
  action.results = clearAiDownstreamResults(action.results, changedStage);
  return action.results;
}

export async function runAiStageAction({
  coordinator,
  action,
  stage,
  mode,
  scope,
  baseUrl,
}: {
  coordinator: AiStageActionCoordinator;
  action: AiStageAction;
  stage: AiStageName;
  mode: AiStageRequestPayload["mode"];
  scope: AiStageRequestScope;
  baseUrl?: string;
}): Promise<AiStageActionResult> {
  if (!coordinator.isCurrent(action)) {
    return {
      status: "stale",
      response: null,
      results: action.results,
    };
  }

  if (action.inFlight) {
    return {
      status: "busy",
      response: null,
      results: action.results,
    };
  }

  action.inFlight = stage;
  if (mode === "generate" || mode === "regenerate") {
    prepareAiStageAction(action, stage);
  }

  try {
    const response = await requestAiStage(stage, scope, {
      mode,
      baseUrl,
      signal: action.controller.signal,
    });

    if (!coordinator.isCurrent(action)) {
      return {
        status: "stale",
        response: null,
        results: action.results,
      };
    }

    action.results = {
      ...action.results,
      [stage]: response,
    };
    return {
      status: "applied",
      response,
      results: action.results,
    };
  } catch (error) {
    if (!coordinator.isCurrent(action) || isAbortError(error)) {
      return {
        status: "stale",
        response: null,
        results: action.results,
      };
    }

    const response = toFailedAiStagePayload(stage, {
      error: error instanceof Error ? error.message : "The AI stage request failed.",
    });
    prepareAiStageAction(action, stage);
    action.results = {
      ...action.results,
      [stage]: response,
    };
    return {
      status: "applied",
      response,
      results: action.results,
    };
  } finally {
    if (action.inFlight === stage) {
      action.inFlight = null;
    }
  }
}

async function loadCachedStage(
  stage: AiStageName,
  scope: AiStageRequestScope,
  options: HydrateAiStagesOptions,
) {
  const response = await requestAiStage(stage, scope, {
    mode: "load_cached",
    ...options,
  });

  if (response.status === "completed") {
    return response;
  }

  if (isAiCacheMiss(response)) {
    return null;
  }

  throw new AiStageRequestError(
    stage,
    response.errorMessage ?? `AI stage ${stage} failed while restoring its cache.`,
  );
}

export async function hydrateAiStageResults(
  scope: AiStageRequestScope,
  options: HydrateAiStagesOptions = {},
): Promise<Partial<Record<AiStageName, AiStageResponsePayload>>> {
  const results: Partial<Record<AiStageName, AiStageResponsePayload>> = {};
  const independentResults = await Promise.all(
    independentAiStages.map(async (stage) => [stage, await loadCachedStage(stage, scope, options)] as const),
  );

  for (const [stage, response] of independentResults) {
    if (response) {
      results[stage] = response;
    }
  }

  const hasRequiredPlanningContext =
    results.province_plan_context?.status === "completed" &&
    results.national_plan_context?.status === "completed";
  const hasIndicatorNarrative = results.indicator_narrative?.status === "completed";

  if (hasRequiredPlanningContext) {
    const [alignment, swot] = await Promise.all([
      loadCachedStage("plan_alignment", scope, options),
      hasIndicatorNarrative
        ? loadCachedStage("swot_analysis", scope, options)
        : Promise.resolve(null),
    ]);

    if (alignment) {
      results.plan_alignment = alignment;
    }

    if (swot) {
      results.swot_analysis = swot;
    }
  }

  if (
    hasIndicatorNarrative &&
    results.plan_alignment?.status === "completed" &&
    results.swot_analysis?.status === "completed"
  ) {
    const recommendations = await loadCachedStage(
      "investment_recommendations",
      scope,
      options,
    );

    if (recommendations) {
      results.investment_recommendations = recommendations;
    }
  }

  return results;
}

export function clearAiDownstreamResults(
  results: Partial<Record<AiStageName, AiStageResponsePayload>>,
  changedStage: AiStageName,
) {
  const next = { ...results };
  const cleared = new Set<AiStageName>();
  const pending = [...aiStageDownstream[changedStage]];

  while (pending.length > 0) {
    const stage = pending.shift();

    if (!stage || cleared.has(stage)) {
      continue;
    }

    cleared.add(stage);
    delete next[stage];
    pending.push(...aiStageDownstream[stage]);
  }

  return next;
}
