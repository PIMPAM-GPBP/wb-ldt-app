import { NextResponse } from "next/server";

import { getAiPromptVersion } from "@/lib/ai/cache";
import {
  InvalidAiScopeError,
  validateAiStageRequestPayload,
} from "@/lib/ai/request";
import type { AiStageRequestPayload } from "@/lib/ai/types";

function isAiGenerationAllowed(request: Request) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  if (process.env.AI_GENERATION_ENABLED === "true") {
    return true;
  }

  const adminToken = process.env.AI_ADMIN_TOKEN;
  if (!adminToken) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const headerToken = request.headers.get("x-ai-admin-token");

  return bearerToken === adminToken || headerToken === adminToken;
}

function serializeStageError(error: unknown) {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;

    if (cause instanceof Error && cause.message && cause.message !== error.message) {
      return `${error.message}: ${cause.message}`;
    }

    if (typeof cause === "string" && cause && cause !== error.message) {
      return `${error.message}: ${cause}`;
    }

    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}"
      ? serialized
      : "Unknown AI stage failure.";
  } catch {
    return "Unknown AI stage failure.";
  }
}

export async function parseAiStageRequest(request: Request) {
  let payload: Partial<AiStageRequestPayload>;

  try {
    payload = (await request.json()) as Partial<AiStageRequestPayload>;
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Invalid JSON request body.",
        },
        { status: 400 },
      ),
    };
  }

  const validated = validateAiStageRequestPayload(payload);

  if (!validated.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: validated.error,
        },
        { status: 400 },
      ),
    };
  }

  if (validated.payload.mode !== "load_cached" && !isAiGenerationAllowed(request)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error:
            "AI generation is disabled. Enable it with AI_GENERATION_ENABLED=true or provide a valid AI admin token.",
        },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true as const,
    payload: validated.payload,
  };
}

export function toStageErrorResponse(stage: string, error: unknown) {
  if (error instanceof InvalidAiScopeError) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 400 },
    );
  }

  const message = serializeStageError(error);
  console.error(`AI stage ${stage} failed:`, error);

  return NextResponse.json(
    {
      stage,
      status: "failed",
      cacheHit: false,
      renderedOutput: null,
      structuredOutput: {},
      sourceReferences: [],
      modelName: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      promptVersion: getAiPromptVersion(),
      updatedAt: new Date().toISOString(),
      errorMessage: message,
    },
    { status: 500 },
  );
}
