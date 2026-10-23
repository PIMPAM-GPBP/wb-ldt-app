import type { AiStageRequestPayload } from "@/lib/ai/types";

const supportedCountryCodes = new Set(["NPL", "ZMB", "SRB"]);
const supportedModes = new Set(["generate", "regenerate", "load_cached"]);

export const invalidAiScopeErrorMessage =
  "AI request scope does not match the selected analytics data.";

export class InvalidAiScopeError extends Error {
  constructor() {
    super(invalidAiScopeErrorMessage);
    this.name = "InvalidAiScopeError";
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateAiStageRequestPayload(
  payload: Partial<AiStageRequestPayload> | null | undefined,
):
  | { ok: true; payload: AiStageRequestPayload }
  | { ok: false; error: "Invalid AI stage request payload." } {
  if (
    !payload ||
    typeof payload.countryCode !== "string" ||
    !supportedCountryCodes.has(payload.countryCode) ||
    !isNonEmptyString(payload.releaseKey) ||
    !Number.isInteger(payload.year) ||
    !isNonEmptyString(payload.municipalityId) ||
    !isNonEmptyString(payload.scoreId) ||
    typeof payload.mode !== "string" ||
    !supportedModes.has(payload.mode)
  ) {
    return {
      ok: false,
      error: "Invalid AI stage request payload.",
    };
  }

  return {
    ok: true,
    payload: payload as AiStageRequestPayload,
  };
}
