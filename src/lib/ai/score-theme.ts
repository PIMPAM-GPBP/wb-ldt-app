export type ScoreTheme = "prosperity" | "infrastructure" | "livability";

// National plan sources are filed by theme, and score ids start with the theme name.
export function getScoreThemeFromScoreId(scoreId: string): ScoreTheme | null {
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
