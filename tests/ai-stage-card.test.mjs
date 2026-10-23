import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const repositoryRoot = new URL("../", import.meta.url);
const requireFromRepository = createRequire(
  new URL("../package.json", import.meta.url),
);
const reactJsxRuntimePath = requireFromRepository.resolve("react/jsx-runtime");

const componentSources = [
  ["src/components/analytics/ai-stage-card.tsx", "ai-stage-card.cjs"],
  [
    "src/components/analytics/evidence-gap-badge.tsx",
    "evidence-gap-badge.cjs",
  ],
  ["src/lib/evidence-gaps.ts", "evidence-gaps.cjs"],
];

// The repository test hook resolves TSX files but does not transpile JSX, so this test compiles the real component and its runtime dependencies locally.
async function loadAiStageCard() {
  const tempRoot = await mkdtemp(join(tmpdir(), "ldt-ai-stage-card-"));

  try {
    for (const [sourcePath, outputName] of componentSources) {
      let source = await readFile(new URL(sourcePath, repositoryRoot), "utf8");
      source = source
        .replaceAll(
          "@/components/analytics/evidence-gap-badge",
          "./evidence-gap-badge.cjs",
        )
        .replaceAll("@/lib/evidence-gaps", "./evidence-gaps.cjs");

      let output = ts.transpileModule(source, {
        compilerOptions: {
          esModuleInterop: true,
          isolatedModules: true,
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: sourcePath,
      }).outputText;
      output = output.replaceAll(
        'require("react/jsx-runtime")',
        `require(${JSON.stringify(reactJsxRuntimePath)})`,
      );

      await writeFile(join(tempRoot, outputName), output, "utf8");
    }

    return {
      card: requireFromRepository(join(tempRoot, "ai-stage-card.cjs")).AiStageCard,
      deriveAiStageEvidenceGap:
        requireFromRepository(join(tempRoot, "evidence-gaps.cjs"))
          .deriveAiStageEvidenceGap,
    };
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
}

function completedStageResult() {
  return {
    stage: "indicator_narrative",
    status: "completed",
    cacheHit: true,
    cacheStatus: "cache_hit",
    runId: "run-123",
    cacheKey: "cache-key",
    sourceFingerprint: "source-fingerprint",
    inputHash: "input-hash",
    renderedOutput: "The completed stage output.",
    structuredOutput: {},
    sourceReferences: [],
    modelName: "gpt-4.1-mini",
    promptVersion: "v1",
    updatedAt: "2026-10-11T00:00:00.000Z",
    errorMessage: null,
  };
}

test("AI stage cards keep real stage gaps and suppress wrapper gaps", async () => {
  const { card: AiStageCard, deriveAiStageEvidenceGap } = await loadAiStageCard();
  const baseProps = {
    eyebrow: "Step 1",
    title: "Stage title",
    description: "Stage description",
  };
  const renderCard = (props = {}) =>
    renderToStaticMarkup(
      createElement(AiStageCard, {
        ...baseProps,
        ...props,
      }),
    );

  assert.equal(deriveAiStageEvidenceGap(undefined)?.label, "Not generated");

  const missingStageMarkup = renderCard();
  assert.match(missingStageMarkup, /Evidence gap/);
  assert.match(missingStageMarkup, /Not generated/);

  const completedStageMarkup = renderCard({ result: completedStageResult() });
  assert.match(completedStageMarkup, /Completed/);
  assert.doesNotMatch(completedStageMarkup, /Evidence gap/);

  const wrapperMarkup = renderCard({
    showEvidenceGap: false,
    title: "Choose local unit and score",
  });
  assert.doesNotMatch(wrapperMarkup, /Evidence gap/);
  assert.doesNotMatch(wrapperMarkup, /Not generated/);
});
