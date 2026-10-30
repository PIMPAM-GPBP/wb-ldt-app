import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAiRunCacheContract,
  createStableFingerprint,
  isCacheReusableRunStatus,
  shouldBypassAiRunCache,
} from "../src/lib/ai/run-store.ts";

const baseScope = {
  countryCode: "SRB",
  stage: "indicator_narrative",
  releaseKey: "srb-2025-v1",
  year: 2025,
  scope: {
    kind: "unit",
    municipalityId: "srb-2025-v1:beograd",
    province: "Belgrade",
    scoreId: "prosperity_score",
  },
  modelName: "gpt-4.1-mini",
  promptVersion: "v2",
  invalidationVersion: "v1",
};

const nationalInput = {
  input: {
    countryCode: "SRB",
    scoreTheme: "prosperity",
    evidence: [{ url: "https://example.test/national.pdf", title: "National plan" }],
  },
  prompt: { system: "document-parser", user: "{}" },
  modelSettings: {},
};

function buildNationalContract(overrides = {}) {
  return buildAiRunCacheContract({
    ...baseScope,
    stage: "national_plan_context",
    modelName: "document-parser",
    scope: { kind: "country_theme", scoreTheme: "prosperity" },
    ...nationalInput,
    ...overrides,
  });
}

test("stable fingerprints are independent of object key insertion order", () => {
  const left = createStableFingerprint({
    municipality: { id: "a", name: "Beograd" },
    score: { id: "prosperity_score", label: "Prosperity" },
  });
  const right = createStableFingerprint({
    score: { label: "Prosperity", id: "prosperity_score" },
    municipality: { name: "Beograd", id: "a" },
  });

  assert.equal(left, right);
});

test("AI run cache contract is stable for equivalent inputs", () => {
  const first = buildAiRunCacheContract({
    ...baseScope,
    input: {
      selectedIndicators: ["jobs", "mobility"],
      evidence: [{ url: "https://example.test/plan.pdf", fingerprint: "abc" }],
    },
    prompt: {
      system: "system prompt",
      user: "user prompt",
    },
    modelSettings: {
      temperature: 0,
      topP: 1,
    },
  });
  const second = buildAiRunCacheContract({
    ...baseScope,
    input: {
      evidence: [{ fingerprint: "abc", url: "https://example.test/plan.pdf" }],
      selectedIndicators: ["jobs", "mobility"],
    },
    prompt: {
      user: "user prompt",
      system: "system prompt",
    },
    modelSettings: {
      topP: 1,
      temperature: 0,
    },
  });

  assert.equal(first.cacheKey, second.cacheKey);
  assert.equal(first.inputHash, second.inputHash);
  assert.equal(first.sourceFingerprint, second.sourceFingerprint);
  assert.equal(first.promptHash, second.promptHash);
});

test("AI run source fingerprint changes when source evidence changes", () => {
  const first = buildAiRunCacheContract({
    ...baseScope,
    input: {
      selectedIndicators: ["jobs", "mobility"],
      evidence: [{ url: "https://example.test/plan.pdf", fingerprint: "abc" }],
    },
    prompt: {
      system: "system prompt",
      user: "user prompt",
    },
    modelSettings: {},
  });
  const second = buildAiRunCacheContract({
    ...baseScope,
    input: {
      selectedIndicators: ["jobs", "mobility"],
      evidence: [{ url: "https://example.test/plan.pdf", fingerprint: "changed" }],
    },
    prompt: {
      system: "system prompt",
      user: "user prompt",
    },
    modelSettings: {},
  });

  assert.notEqual(first.sourceFingerprint, second.sourceFingerprint);
  assert.notEqual(first.cacheKey, second.cacheKey);
});

test("regenerate mode bypasses reusable cache but load_cached does not", () => {
  assert.equal(shouldBypassAiRunCache("regenerate"), true);
  assert.equal(shouldBypassAiRunCache("generate"), false);
  assert.equal(shouldBypassAiRunCache("load_cached"), false);
});

test("only completed AI runs are reusable cache hits", () => {
  assert.equal(isCacheReusableRunStatus("completed"), true);
  assert.equal(isCacheReusableRunStatus("failed"), false);
  assert.equal(isCacheReusableRunStatus("running"), false);
});

test("unit-scoped cache keys differ between two units with identical inputs", () => {
  const shared = {
    input: { evidence: [{ indicatorId: "jobs" }] },
    prompt: { system: "system prompt", user: "user prompt" },
    modelSettings: {},
  };
  const beograd = buildAiRunCacheContract({ ...baseScope, ...shared });
  const novi = buildAiRunCacheContract({
    ...baseScope,
    scope: { ...baseScope.scope, municipalityId: "srb-2025-v1:novi-sad", province: "Vojvodina" },
    ...shared,
  });

  assert.notEqual(beograd.cacheKey, novi.cacheKey);
});

test("country-theme scope separates themes, releases, models, and prompt versions", () => {
  const base = buildNationalContract();

  assert.notEqual(base.cacheKey, buildNationalContract({ scope: { kind: "country_theme", scoreTheme: "livability" } }).cacheKey);
  assert.notEqual(base.cacheKey, buildNationalContract({ releaseKey: "srb-2026-v1" }).cacheKey);
  assert.notEqual(base.cacheKey, buildNationalContract({ modelName: "document-parser-v2" }).cacheKey);
  assert.notEqual(base.cacheKey, buildNationalContract({ promptVersion: "v3" }).cacheKey);
  assert.notEqual(base.cacheKey, buildNationalContract({ countryCode: "NPL" }).cacheKey);
});
