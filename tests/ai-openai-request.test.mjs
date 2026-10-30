import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_OPENAI_MODEL,
  OPENAI_REQUEST_TIMEOUT_MS,
  buildOpenAiRequestBody,
  estimateOpenAiCostUsd,
  getStageModelSettings,
  isReasoningModel,
  readOpenAiResponse,
  resolveOpenAiRequestSettings,
} from "../src/lib/ai/openai-request.ts";

const stageSettings = getStageModelSettings("plan_alignment");

function buildBody(model) {
  return buildOpenAiRequestBody({
    model,
    system: "system text",
    prompt: "user text",
    settings: resolveOpenAiRequestSettings(model, stageSettings),
  });
}

function completedPayload(overrides = {}) {
  return {
    status: "completed",
    output: [
      { type: "reasoning", summary: [{ type: "summary_text", text: "private reasoning summary" }] },
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "Alignment summary\n- bullet one" }],
      },
    ],
    usage: {
      input_tokens: 1200,
      input_tokens_details: { cached_tokens: 200 },
      output_tokens: 900,
      output_tokens_details: { reasoning_tokens: 500 },
      total_tokens: 2100,
    },
    ...overrides,
  };
}

test("reasoning models get reasoning.effort and no temperature", () => {
  for (const model of [DEFAULT_OPENAI_MODEL, "gpt-5-mini", "o4-mini"]) {
    const body = buildBody(model);
    assert.equal(body.reasoning?.effort, stageSettings.effort, model);
    assert.equal("temperature" in body, false, model);
  }
});

test("non-reasoning models get temperature and no reasoning block", () => {
  for (const model of ["gpt-4.1-mini", "gpt-4o", "gpt-5-chat-latest"]) {
    const body = buildBody(model);
    assert.equal(body.temperature, stageSettings.temperature, model);
    assert.equal("reasoning" in body, false, model);
  }
});

test("every request carries the stage token budget, a text format, and the two input messages", () => {
  const body = buildBody("gpt-5.6-luna");

  assert.equal(body.max_output_tokens, stageSettings.maxOutputTokens);
  assert.deepEqual(body.text, { format: { type: "text" } });
  assert.deepEqual(
    body.input.map((message) => [message.role, message.content[0].text]),
    [
      ["system", "system text"],
      ["user", "user text"],
    ],
  );
});

test("the default model is routed as a reasoning model and the timeout sits inside the 300 s route budget", () => {
  assert.equal(isReasoningModel(DEFAULT_OPENAI_MODEL), true);
  assert.ok(OPENAI_REQUEST_TIMEOUT_MS <= 150_000);
});

test("an incomplete response is an error even when partial text is present", () => {
  const payload = completedPayload({
    status: "incomplete",
    incomplete_details: { reason: "max_output_tokens" },
  });

  assert.throws(() => readOpenAiResponse(payload), /incomplete.*max_output_tokens/);
});

test("a failed response surfaces the API error message", () => {
  const payload = completedPayload({
    status: "failed",
    error: { code: "server_error", message: "upstream broke" },
  });

  assert.throws(() => readOpenAiResponse(payload), /upstream broke/);
});

test("a completed response returns only the message text plus the four usage counts", () => {
  const { text, usage } = readOpenAiResponse(completedPayload());

  assert.equal(text, "Alignment summary\n- bullet one");
  assert.doesNotMatch(text, /private reasoning summary/);
  assert.deepEqual(usage, {
    inputTokens: 1200,
    cachedInputTokens: 200,
    outputTokens: 900,
    reasoningTokens: 500,
    totalTokens: 2100,
  });
});

test("a completed response with no message text is an error", () => {
  const payload = completedPayload({
    output: [{ type: "reasoning", summary: [] }],
  });

  assert.throws(() => readOpenAiResponse(payload), /no message text/);
});

test("a response without usage still returns the text and a null usage", () => {
  const { text, usage } = readOpenAiResponse(completedPayload({ usage: undefined }));

  assert.equal(text, "Alignment summary\n- bullet one");
  assert.equal(usage, null);
  assert.equal(estimateOpenAiCostUsd("gpt-5.6-luna", usage), null);
});

test("cost bills cached input at the cached rate and reasoning tokens at the output rate", () => {
  const usage = {
    inputTokens: 1_000_000,
    cachedInputTokens: 500_000,
    outputTokens: 100_000,
    reasoningTokens: 60_000,
    totalTokens: 1_100_000,
  };

  // 0.5M at $0.20 + 0.5M at $0.02 + 0.1M at $1.20.
  assert.equal(estimateOpenAiCostUsd("gpt-5.6-luna", usage), 0.23);
  // 0.5M at $0.40 + 0.5M at $0.10 + 0.1M at $1.60.
  assert.equal(estimateOpenAiCostUsd("gpt-4.1-mini", usage), 0.41);
});

test("unknown models and the document parser get a null cost, never a guess", () => {
  const usage = {
    inputTokens: 10,
    cachedInputTokens: 0,
    outputTokens: 10,
    reasoningTokens: 0,
    totalTokens: 20,
  };

  assert.equal(estimateOpenAiCostUsd("gpt-9-future", usage), null);
  assert.equal(estimateOpenAiCostUsd("document-parser", usage), null);
});
