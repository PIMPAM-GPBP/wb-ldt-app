"use client";

import type { ReactNode } from "react";

import { EvidenceGapBadge } from "@/components/analytics/evidence-gap-badge";
import type { AiStageResponsePayload } from "@/lib/ai/types";
import { deriveAiStageEvidenceGap } from "@/lib/evidence-gaps";

type AiStageCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  footerActions?: ReactNode;
  result?: AiStageResponsePayload | null;
  showEvidenceGap?: boolean;
  resultContent?: ReactNode;
  children?: ReactNode;
};

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "success" | "error";
}) {
  const className =
    tone === "success"
      ? "bg-[rgba(84,162,75,0.12)] text-[#2f7a2a]"
      : tone === "error"
        ? "bg-[rgba(228,87,86,0.12)] text-[#b23b3a]"
        : "bg-[rgba(55,66,145,0.06)] text-[var(--muted-foreground)]";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function shortIdentifier(value: string | null | undefined) {
  return value ? value.slice(0, 12) : "not recorded";
}

export function AiStageCard({
  eyebrow,
  title,
  description,
  actions,
  footerActions,
  result,
  showEvidenceGap = true,
  resultContent,
  children,
}: AiStageCardProps) {
  const extractedText =
    result?.structuredOutput &&
    typeof result.structuredOutput.extractedText === "string"
      ? result.structuredOutput.extractedText
      : null;
  const isDocumentContextCard = Boolean(extractedText);
  const compactProof = isDocumentContextCard
    ? [
        result?.renderedOutput?.split("\n").slice(0, 3).join("\n"),
        extractedText ? `${extractedText.slice(0, 220)}…` : null,
      ]
        .filter(Boolean)
        .join("\n\n")
    : null;
  const evidenceGap = showEvidenceGap ? deriveAiStageEvidenceGap(result) : null;

  return (
    <section className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5 shadow-[0_18px_50px_rgba(2,20,32,0.08)] xl:p-6">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {title}
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--muted-foreground)]">
            {description}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div> : null}
        {evidenceGap ? <EvidenceGapBadge gap={evidenceGap} /> : null}
      </div>

      {children ? <div className="mt-5">{children}</div> : null}

      {resultContent ? (
        <div className="mt-5">{resultContent}</div>
      ) : result ? (
        <div className="mt-5 rounded-[1.35rem] border border-[var(--border-soft)] bg-white/75 p-4 xl:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={result.status === "completed" ? "Completed" : "Failed"}
              tone={result.status === "completed" ? "success" : "error"}
            />
            <StatusBadge
              label={
                result.cacheStatus === "regenerated"
                  ? "Regenerated"
                  : result.cacheHit
                    ? "Loaded from cache"
                    : "Freshly generated"
              }
              tone="neutral"
            />
            <StatusBadge label={`Model: ${result.modelName}`} tone="neutral" />
            <StatusBadge label={`Prompt ${result.promptVersion}`} tone="neutral" />
          </div>

          <dl className="mt-3 grid gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.58)] p-3 text-xs sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Run ID
              </dt>
              <dd
                className="mt-1 truncate font-mono text-[var(--foreground)]"
                title={result.runId ?? undefined}
              >
                {shortIdentifier(result.runId)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Cache key
              </dt>
              <dd
                className="mt-1 truncate font-mono text-[var(--foreground)]"
                title={result.cacheKey ?? undefined}
              >
                {shortIdentifier(result.cacheKey)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Source fingerprint
              </dt>
              <dd
                className="mt-1 truncate font-mono text-[var(--foreground)]"
                title={result.sourceFingerprint ?? undefined}
              >
                {shortIdentifier(result.sourceFingerprint)}
              </dd>
            </div>
          </dl>

          {result.errorMessage ? (
            <p className="mt-4 text-sm leading-7 text-[#b23b3a]">{result.errorMessage}</p>
          ) : null}

          {result.renderedOutput && !isDocumentContextCard ? (
            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--foreground)]">
              {result.renderedOutput}
            </div>
          ) : null}

          {compactProof ? (
            <div className="mt-4 max-h-20 overflow-hidden whitespace-pre-wrap rounded-[1rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.72)] p-3 text-sm leading-6 text-[var(--foreground)]">
              {compactProof}
            </div>
          ) : null}

          {extractedText ? (
            <details className="mt-4 rounded-[1.15rem] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.72)] p-3.5">
              <summary className="cursor-pointer text-sm font-medium text-[var(--foreground)]">
                Show proof text
              </summary>
              <div className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap text-sm leading-7 text-[var(--foreground)]">
                {extractedText}
              </div>
            </details>
          ) : null}

          {result.sourceReferences.length > 0 ? (
            <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Sources
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--muted-foreground)]">
                {result.sourceReferences.map((reference, index) => (
                  <li key={`${reference.source}-${index}`}>
                    <span className="font-medium text-[var(--foreground)]">{reference.label}</span>
                    {" · "}
                    <span>{reference.source}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {footerActions ? <div className="mt-5 flex flex-wrap items-center gap-2">{footerActions}</div> : null}
    </section>
  );
}
