import type { Fact, FactSheet } from "./facts.ts";

/**
 * Checks a sentence against the fact sheet it cites. A sentence that fails is
 * dropped from the brief, not shown with a warning.
 */

export type SentenceToCheck = { text: string; factIds: string[] };
export type CheckedSentence = SentenceToCheck & { problems: string[] };

const BAND_PHRASE = /\b(?:top|second|middle|fourth|bottom) fifth\b|\b(?:top|bottom) group of \d+\b|\bgroup \d+ of \d+ from the top\b|\bone group\b/gi;
// Digits only: a spelled-out number can't be matched to a fact. Ordinals stay legal for band names.
const NUMBER_WORD =
  /\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|twice|double|triple|half|quarter)\b/i;
// The brief states bands, never ranks (decision 7).
const RANK = /\b\d+(?:st|nd|rd|th)\b|\branks?\b|\branked\b|\branking\b|#\s?\d/i;
const NUMBER = /(?<![\w.])[-−]?\d+(?:\.\d+)?(?!\w)/g;

const ABOVE = /\b(?:above|higher than|more than|greater than|exceeds?|exceeding|ahead of|outperforms?|lifts?|lifting|raises?|boosts?)\b/i;
const BELOW = /\b(?:below|lower than|less than|behind|trails?|pulls? (?:it |the score )?down|pulling (?:it )?down|drags?|weighs? on)\b/i;
const LEVEL = /\b(?:level with|the same as|equal to|in line with)\b/i;
const ROSE = /\b(?:rose|risen|increased?|increasing|grew|grown|gained|improved|up from)\b/i;
const FELL = /\b(?:fell|fallen|decreased?|decreasing|declined?|dropped|worsened|down from)\b/i;
const STABLE = /\b(?:broadly stable|stable|little changed|unchanged)\b/i;
const SUPERLATIVE = /\b(?:most|largest|biggest|highest|lowest|least|smallest|strongest|weakest|best|worst)\b/i;

const componentName = (label: string) => label.replace(/ Score$/, "");

function numberMatches(text: string, fact: Fact) {
  if (typeof fact.value !== "number") return false;
  const negative = /^[-−]/.test(text);
  const value = Number(text.replace("−", "-"));
  const decimals = text.split(".")[1]?.length ?? 0;
  const target = fact.signed && !negative ? Math.abs(fact.value) : fact.value;
  // The text may round the fact to any precision it shows, but not misstate it.
  return Math.abs(value - target) <= 0.5 * 10 ** -decimals + 1e-9;
}

/** The fact id that a component fact belongs to, such as "prosperity.component.tourism". */
const componentBase = (id: string) => /^([a-z]+\.component\.[a-z_]+)\./.exec(id)?.[1] ?? null;

/** Signs of the comparisons the cited facts support: a signed fact, or a value next to its average. */
function comparisonSigns(sheet: FactSheet, cited: readonly string[]) {
  const signs: number[] = [];
  const valueOf = (id: string) => sheet.facts[id]?.value;
  const signOf = (value: number) => (Math.abs(value) < 0.05 ? 0 : Math.sign(value));
  for (const id of cited) {
    const fact = sheet.facts[id];
    if (fact?.signed && typeof fact.value === "number") signs.push(signOf(fact.value));
    const base = id.endsWith(".value") ? id.slice(0, -".value".length) : id.endsWith(".score") ? id.slice(0, -".score".length) : null;
    if (!base) continue;
    const value = valueOf(id);
    for (const scope of ["national_average", "province_average"]) {
      const average = valueOf(`${base}.${scope}`);
      if (cited.includes(`${base}.${scope}`) && typeof value === "number" && typeof average === "number") {
        signs.push(signOf(value - average));
      }
    }
  }
  return signs;
}

export function verifySentence(sheet: FactSheet, sentence: SentenceToCheck): CheckedSentence {
  const problems: string[] = [];
  const { text } = sentence;
  const cited = [...new Set(sentence.factIds)];

  for (const id of cited) {
    if (!sheet.facts[id]) problems.push(`cites unknown fact ${id}`);
  }
  const facts = cited.map((id) => sheet.facts[id]).filter((fact): fact is Fact => Boolean(fact));

  if (RANK.test(text)) problems.push("states a rank; the brief uses bands only");

  // Band phrases must match a cited band, then come out of the text so their words
  // and digits are not read as numbers.
  const citedBands = facts.filter((fact) => fact.id.includes(".band.") && typeof fact.value === "string").map((fact) => String(fact.value).toLowerCase());
  for (const phrase of text.match(BAND_PHRASE) ?? []) {
    if (!citedBands.includes(phrase.toLowerCase())) problems.push(`names the band "${phrase}" without citing that band`);
  }
  const plain = text.replace(BAND_PHRASE, " ");

  const word = NUMBER_WORD.exec(plain);
  if (word) problems.push(`spells out the number "${word[0]}"; use digits`);

  // The edition year may appear uncited, as in "from 2021 to 2025". The first year may not:
  // a base year can be later than it, so "since 2021" must cite the year it means.
  const editionYear = sheet.facts["release.year"];
  for (const number of plain.match(NUMBER) ?? []) {
    if (facts.some((fact) => numberMatches(number, fact))) continue;
    if (editionYear && number === String(editionYear.value)) continue;
    problems.push(`"${number}" matches no cited fact`);
  }

  const signs = comparisonSigns(sheet, cited);
  if (ABOVE.test(plain) && !signs.some((sign) => sign > 0)) problems.push("says above or higher, but no cited fact is above its comparison");
  if (BELOW.test(plain) && !signs.some((sign) => sign < 0)) problems.push("says below or lower, but no cited fact is below its comparison");
  if (LEVEL.test(plain) && !signs.some((sign) => sign === 0)) problems.push("says level with, but no cited fact is level with its comparison");

  const directions = cited
    .filter((id) => /\.change\.(?:direction|points|base_year|base_score)$/.test(id))
    .map((id) => sheet.facts[`${id.split(".")[0]}.change.direction`]?.value);
  if (ROSE.test(plain) && !directions.includes("rose")) problems.push("says the score rose, but no cited change rose");
  if (FELL.test(plain) && !directions.includes("fell")) problems.push("says the score fell, but no cited change fell");
  if (STABLE.test(plain) && !directions.includes("broadly stable")) problems.push("says stable, but no cited change is broadly stable");

  if (SUPERLATIVE.test(plain) && !cited.some((id) => /\.(?:driver|neighbour|band)\./.test(id))) {
    problems.push("uses a superlative without citing a driver, band, or neighbour fact");
  }

  // A component with nothing recorded has a fixed value, so nothing can be compared with it.
  const compares = ABOVE.test(plain) || BELOW.test(plain) || LEVEL.test(plain) || SUPERLATIVE.test(plain);
  if (compares) {
    for (const id of cited) {
      const base = componentBase(id);
      if (!base || id.endsWith(".status") || id.endsWith(".recorded_units")) continue;
      const status = sheet.facts[`${base}.status`]?.value;
      if (status !== "measured") problems.push(`compares ${base.split(".").pop()}, which is ${status}`);
    }
  }

  // A component named in the text must be cited, by its own facts or as a fact's value.
  const citedComponents = new Set(
    cited.flatMap((id) => {
      const base = componentBase(id);
      const value = sheet.facts[id]?.value;
      return [base?.split(".").pop(), typeof value === "string" ? value : undefined].filter(Boolean) as string[];
    }),
  );
  // Longest names first, blanked once matched, so "Emissions per Area" is not also read as "Emissions".
  const components = sheet.pillars
    .flatMap((pillar) => pillar.components)
    .map((component) => ({ key: component.key, name: componentName(component.label) }))
    .sort((a, b) => b.name.length - a.name.length);
  let unnamed = plain;
  for (const component of components) {
    const pattern = new RegExp(`\\b${component.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    if (!pattern.test(unnamed)) continue;
    unnamed = unnamed.replace(pattern, " ");
    if (!citedComponents.has(component.key)) problems.push(`names ${component.name} without citing it`);
  }

  return { ...sentence, factIds: cited, problems: [...new Set(problems)] };
}

export function verifySentences(sheet: FactSheet, sentences: readonly SentenceToCheck[]) {
  return sentences.map((sentence) => verifySentence(sheet, sentence));
}
