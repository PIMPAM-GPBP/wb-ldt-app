/**
 * Finds a model's quote in the plan's own text. A quote that cannot be found is dropped:
 * the brief only shows words the plan contains, on the page they are on.
 */

export type QuoteMatch = {
  status: "exact" | "fuzzy" | "too short" | "unmatched";
  /** The PDF page the quote is on; it may differ from the page the model cited. */
  page: number | null;
  /** 1 for an exact match; the edit similarity of the best window for a fuzzy one. */
  similarity: number;
};

/** Below this many letters and digits a phrase matches too easily to prove anything. */
export const MIN_QUOTE_KEY_LENGTH = 25;
/** A fuzzy match tolerates a few characters the PDF text broke, never a different sentence. */
export const MIN_FUZZY_SIMILARITY = 0.92;

/**
 * Letters and digits only, lower case, compatibility-normalised. Line breaks, hyphenation
 * across lines, spaces inside a word ("Оре овици"), and quote styles all drop out.
 */
export function matchKey(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function bigrams(text: string) {
  const counts = new Map<string, number>();
  for (let index = 0; index < text.length - 1; index += 1) {
    const pair = text.slice(index, index + 2);
    counts.set(pair, (counts.get(pair) ?? 0) + 1);
  }
  return counts;
}

function dice(a: Map<string, number>, b: Map<string, number>, total: number) {
  let shared = 0;
  for (const [pair, count] of a) shared += Math.min(count, b.get(pair) ?? 0);
  return (2 * shared) / total;
}

function editSimilarity(a: string, b: string) {
  if (a === b) return 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

/** Best edit similarity of the quote against windows of the page, shortlisted by bigram overlap. */
function bestWindow(quoteKey: string, pageKey: string) {
  if (pageKey.length < quoteKey.length * 0.8) return 0;
  const quoteBigrams = bigrams(quoteKey);
  const width = quoteKey.length;
  const step = Math.max(1, Math.floor(width / 10));
  const candidates: Array<{ start: number; score: number }> = [];
  for (let start = 0; start <= Math.max(0, pageKey.length - width); start += step) {
    const window = pageKey.slice(start, start + width);
    candidates.push({ start, score: dice(quoteBigrams, bigrams(window), quoteKey.length - 1 + window.length - 1) });
  }
  let best = 0;
  for (const { start } of candidates.sort((a, b) => b.score - a.score).slice(0, 3)) {
    // Let the window grow or shrink a little, since the PDF text can gain or lose characters.
    for (const delta of [-Math.ceil(width * 0.05), 0, Math.ceil(width * 0.05)]) {
      const from = Math.max(0, start - step);
      const window = pageKey.slice(from, from + width + step + delta);
      for (let offset = 0; offset <= step * 2 && offset + width <= window.length; offset += 1) {
        best = Math.max(best, editSimilarity(quoteKey, window.slice(offset, offset + width + delta)));
      }
    }
  }
  return best;
}

/**
 * Looks for the quote on the cited page, then the pages next to it, then anywhere in the
 * document. Exact means the quote's letters and digits appear in order on one page.
 */
export function locateQuote(quote: string, pages: ReadonlyArray<{ num: number; text: string }>, citedPage: number | null): QuoteMatch {
  const quoteKey = matchKey(quote);
  if (quoteKey.length < MIN_QUOTE_KEY_LENGTH) return { status: "too short", page: null, similarity: 0 };

  const keyed = pages.map((page) => ({ num: page.num, key: matchKey(page.text) }));
  const distance = (num: number) => (citedPage === null ? 0 : Math.abs(num - citedPage));
  const byDistance = [...keyed].sort((a, b) => distance(a.num) - distance(b.num) || a.num - b.num);

  const exact = byDistance.find((page) => page.key.includes(quoteKey));
  if (exact) return { status: "exact", page: exact.num, similarity: 1 };

  // A sentence can run over a page break; join each page near the cited one to the next,
  // and give the page the quote starts on.
  const byNumber = new Map(keyed.map((page) => [page.num, page.key]));
  for (const page of byDistance.filter((entry) => citedPage === null || distance(entry.num) <= 1)) {
    const next = byNumber.get(page.num + 1);
    if (next === undefined) continue;
    const joined = page.key + next;
    const at = joined.indexOf(quoteKey);
    if (at !== -1 && at < page.key.length) return { status: "exact", page: page.num, similarity: 1 };
  }

  // Fuzzy only near the cited page: across the whole document a near-match is more likely
  // to be a different sentence with the same wording.
  let best: QuoteMatch = { status: "unmatched", page: null, similarity: 0 };
  for (const page of byDistance.filter((entry) => citedPage === null || distance(entry.num) <= 1)) {
    const similarity = bestWindow(quoteKey, page.key);
    if (similarity > best.similarity) best = { status: "unmatched", page: page.num, similarity };
  }
  return best.similarity >= MIN_FUZZY_SIMILARITY ? { ...best, status: "fuzzy" } : { status: "unmatched", page: null, similarity: best.similarity };
}
