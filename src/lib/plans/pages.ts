/**
 * Page-indexed plan text: parsing the per-page text Phase 0 saved, and flagging pages
 * whose text cannot be quoted from.
 */

export type PageQuality = "ok" | "empty" | "garbled";
export type PlanPage = { num: number; text: string; quality: PageQuality };

/** Under this many visible characters a page has no usable text, as in a scanned page or a photo. */
const MIN_PAGE_CHARACTERS = 40;

/**
 * Splits saved plan text on its "=== page N ===" markers. N is the PDF's own page number,
 * which a link's #page=N opens, not the number printed on the page.
 */
export function parsePlanText(fileText: string): { url: string | null; pages: Array<{ num: number; text: string }> } {
  const url = /^URL: (\S+)/m.exec(fileText)?.[1] ?? null;
  const pages: Array<{ num: number; text: string }> = [];
  const marker = /^=== page (\d+) ===$/gm;
  const matches = [...fileText.matchAll(marker)];
  matches.forEach((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? fileText.length;
    pages.push({ num: Number(match[1]), text: fileText.slice(start, end).trim() });
  });
  return { url, pages };
}

/**
 * Text that cannot be quoted from. Columns read across instead of down leave runs of
 * one-letter tokens, and a broken font map leaves replacement characters or symbols
 * where letters should be.
 */
export function pageQuality(text: string): PageQuality {
  // Empty means almost nothing is there; a page full of broken glyphs is garbled, not empty.
  const characters = text.replace(/\s/g, "");
  if (characters.length < MIN_PAGE_CHARACTERS) return "empty";
  const lettersAndDigits = characters.replace(/[^\p{L}\p{N}]/gu, "");

  const replacement = (characters.match(/�/g) ?? []).length;
  if (replacement / characters.length > 0.01) return "garbled";
  if (lettersAndDigits.length / characters.length < 0.6) return "garbled";

  const tokens = text.split(/\s+/).filter(Boolean);
  const singleLetters = tokens.filter((token) => /^\p{L}$/u.test(token)).length;
  if (tokens.length >= 30 && singleLetters / tokens.length > 0.35) return "garbled";

  return "ok";
}

export function toPlanPages(pages: ReadonlyArray<{ num: number; text: string }>): PlanPage[] {
  return pages.map((page) => ({ ...page, quality: pageQuality(page.text) }));
}

/** A document is readable when at least 80 percent of its pages are, as in the Phase 0 inventory. */
export function documentReadable(pages: readonly PlanPage[]) {
  return pages.length > 0 && pages.filter((page) => page.quality === "ok").length / pages.length >= 0.8;
}
