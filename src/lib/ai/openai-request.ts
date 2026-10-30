// Pure helpers for the OpenAI Responses API call. No framework or "@/" imports
// so node --test can load this file directly.

export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";

// Routes declare maxDuration = 300; the page-data load and a first-time PDF
// parse happen before the model call, so the call itself gets 120 seconds.
export const OPENAI_REQUEST_TIMEOUT_MS = 120_000;

export type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";

export type AiStageModelSettings = {
  // Sent to reasoning models (gpt-5 family, o-series).
  effort: ReasoningEffort;
  // Sent to non-reasoning models such as gpt-4.1-mini.
  temperature: number;
  // Reasoning tokens count against this budget, so it is roughly three times
  // the visible output the prompt asks for.
  maxOutputTokens: number;
};

export type AiModelStageName =
  | "indicator_narrative"
  | "web_context_search"
  | "plan_alignment"
  | "swot_analysis"
  | "investment_recommendations";

// Temperature 0 on non-reasoning models keeps regression runs comparable.
// Effort: prose that restates evidence runs at low; the two stages that weigh
// two documents against each other (alignment) or rank options
// (recommendations) run at medium.
export const stageModelSettings: Record<AiModelStageName, AiStageModelSettings> = {
  // Summary plus strengthening and weakening sections, about 1,000 visible tokens.
  indicator_narrative: { effort: "low", temperature: 0, maxOutputTokens: 5_000 },
  // Four short headings over at most five hits.
  web_context_search: { effort: "low", temperature: 0, maxOutputTokens: 5_000 },
  // Four headings with 4 to 6 cited bullets each, up to about 2,000 visible tokens.
  plan_alignment: { effort: "medium", temperature: 0, maxOutputTokens: 10_000 },
  // Exactly 3 bullets per quadrant plus up to 2 gaps, about 1,200 visible tokens.
  swot_analysis: { effort: "low", temperature: 0, maxOutputTokens: 6_000 },
  // Three recommendations with five sections each, about 2,000 visible tokens.
  investment_recommendations: { effort: "medium", temperature: 0, maxOutputTokens: 10_000 },
};

export function getStageModelSettings(stage: AiModelStageName): AiStageModelSettings {
  return stageModelSettings[stage];
}

// gpt-5 and o-series models take reasoning.effort and reject temperature;
// gpt-5-chat is the one gpt-5 name without reasoning.
export function isReasoningModel(model: string) {
  return /^(gpt-5(?!-chat)|o[1-9])/i.test(model.trim());
}

// Plain text for the legacy stages; a strict JSON schema for brief sections,
// whose sentences carry the fact ids the verifier checks.
export type OpenAiTextFormat =
  | { type: "text" }
  | { type: "json_schema"; name: string; schema: Record<string, unknown>; strict: true };

export type OpenAiRequestSettings = {
  max_output_tokens: number;
  text: { format: OpenAiTextFormat };
} & ({ reasoning: { effort: ReasoningEffort } } | { temperature: number });

export function resolveOpenAiRequestSettings(
  model: string,
  settings: AiStageModelSettings,
  format: OpenAiTextFormat = { type: "text" },
): OpenAiRequestSettings {
  const shared = {
    max_output_tokens: settings.maxOutputTokens,
    text: { format },
  };

  return isReasoningModel(model)
    ? { ...shared, reasoning: { effort: settings.effort } }
    : { ...shared, temperature: settings.temperature };
}

export function buildOpenAiRequestBody({
  model,
  system,
  prompt,
  settings,
}: {
  model: string;
  system: string;
  prompt: string;
  settings: OpenAiRequestSettings;
}) {
  return {
    model,
    input: [
      { role: "system", content: [{ type: "input_text", text: system }] },
      { role: "user", content: [{ type: "input_text", text: prompt }] },
    ],
    ...settings,
  };
}

export type AiTokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function readOpenAiUsage(payload: unknown): AiTokenUsage | null {
  const usage = asRecord(asRecord(payload)?.usage);

  if (!usage) {
    return null;
  }

  const inputDetails = asRecord(usage.input_tokens_details);
  const outputDetails = asRecord(usage.output_tokens_details);
  const inputTokens = asCount(usage.input_tokens);
  const outputTokens = asCount(usage.output_tokens);

  return {
    inputTokens,
    cachedInputTokens: asCount(inputDetails?.cached_tokens),
    outputTokens,
    reasoningTokens: asCount(outputDetails?.reasoning_tokens),
    totalTokens: asCount(usage.total_tokens) || inputTokens + outputTokens,
  };
}

// Only message items carry the answer; reasoning items carry summaries that
// must not end up in the brief.
function readOpenAiOutputText(payload: Record<string, unknown>) {
  const output = Array.isArray(payload.output) ? payload.output : [];
  const texts: string[] = [];

  for (const item of output) {
    const record = asRecord(item);

    if (record?.type !== "message" || !Array.isArray(record.content)) {
      continue;
    }

    for (const part of record.content) {
      const partRecord = asRecord(part);

      if (partRecord?.type === "output_text" && typeof partRecord.text === "string") {
        texts.push(partRecord.text);
      }
    }
  }

  return texts.join("\n\n").trim();
}

export function readOpenAiResponse(payload: unknown): {
  text: string;
  usage: AiTokenUsage | null;
} {
  const record = asRecord(payload);

  if (!record) {
    throw new Error("OpenAI returned a non-object response payload.");
  }

  const status = typeof record.status === "string" ? record.status : "missing";

  if (status === "incomplete") {
    const reason = asRecord(record.incomplete_details)?.reason ?? "unknown reason";
    throw new Error(
      `OpenAI response was incomplete (${String(reason)}); the output was discarded rather than used as partial text.`,
    );
  }

  if (status === "failed") {
    const message = asRecord(record.error)?.message ?? "no error message";
    throw new Error(`OpenAI response failed: ${String(message)}`);
  }

  if (status !== "completed") {
    throw new Error(`OpenAI response had unexpected status "${status}".`);
  }

  const text = readOpenAiOutputText(record);

  if (!text) {
    throw new Error("OpenAI returned a completed response with no message text.");
  }

  return { text, usage: readOpenAiUsage(record) };
}

export type OpenAiModelPrice = {
  // USD per million tokens.
  input: number;
  cachedInput: number;
  output: number;
  source: string;
  checkedOn: string;
};

// Prices read from OpenAI's model pages. Add a row only after checking the page;
// an unknown model gets a null cost, never a guess.
export const openAiPriceTable: Record<string, OpenAiModelPrice> = {
  "gpt-5.6-luna": {
    input: 0.2,
    cachedInput: 0.02,
    output: 1.2,
    source: "https://developers.openai.com/api/docs/models/gpt-5.6-luna",
    checkedOn: "2026-10-29",
  },
  "gpt-4.1-mini": {
    input: 0.4,
    cachedInput: 0.1,
    output: 1.6,
    source: "https://developers.openai.com/api/docs/models/gpt-4.1-mini",
    checkedOn: "2026-10-29",
  },
};

// input_tokens includes the cached tokens; output_tokens includes reasoning
// tokens, which bill at the output rate. Rounded to the column's 6 decimals.
export function estimateOpenAiCostUsd(model: string, usage: AiTokenUsage | null) {
  const price = openAiPriceTable[model];

  if (!price || !usage) {
    return null;
  }

  const uncachedInput = Math.max(usage.inputTokens - usage.cachedInputTokens, 0);
  const cost =
    (uncachedInput * price.input +
      usage.cachedInputTokens * price.cachedInput +
      usage.outputTokens * price.output) /
    1_000_000;

  return Math.round(cost * 1_000_000) / 1_000_000;
}
