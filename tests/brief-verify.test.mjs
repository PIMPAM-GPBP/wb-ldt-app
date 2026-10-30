import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseSectionOneOutput } from "../src/lib/brief/prompt.ts";
import { verifySentence } from "../src/lib/brief/verify.ts";

// Each test is one way a model sentence could misstate the facts and still reach the brief,
// plus one fair rephrasing that must not be rejected.
const sheet = JSON.parse(readFileSync("tests/fixtures/brief/fact-sheets/npl/bagmati-bhaktapur-bhaktapur.json", "utf8"));
const problemsOf = (text, factIds) => verifySentence(sheet, { text, factIds }).problems;

const position = ["prosperity.score", "prosperity.gap.national", "prosperity.national_average"];

test("a fair rephrasing of the facts passes", () => {
  assert.deepEqual(
    problemsOf("At 45.6, Bhaktapur's Prosperity Score sits 7.2 points below the national average of 52.8.", position),
    [],
  );
});

test("a number may be rounded further but not misstated", () => {
  assert.deepEqual(problemsOf("Bhaktapur scored 45.6, about 7 points below the national average of 53.", position), []);
  assert.deepEqual(problemsOf("Bhaktapur scored 45.6, 7.21 points below the national average of 52.81.", position), []);
  assert.match(problemsOf("Bhaktapur scored 45.6, 7.3 points below the national average of 52.8.", position).join(), /"7.3" matches no cited fact/);
});

test("a number with no cited fact behind it fails", () => {
  assert.match(problemsOf("Bhaktapur scored 45.6, up from 41 last year.", ["prosperity.score"]).join(), /"41" matches no cited fact/);
  // The edition year may go uncited; the first year may not, since a base year can be later.
  assert.deepEqual(problemsOf("Bhaktapur scored 45.6 on the Prosperity Score in 2025.", ["prosperity.score"]), []);
  assert.match(problemsOf("Its change since 2021 is not stated.", ["prosperity.change.direction"]).join(), /"2021" matches no cited fact/);
});

test("an unknown fact id fails", () => {
  assert.match(problemsOf("Bhaktapur scored 45.6.", ["prosperity.score", "prosperity.rank"]).join(), /unknown fact prosperity.rank/);
});

test("a direction word against the sign of the cited facts fails", () => {
  assert.match(problemsOf("Bhaktapur scored 45.6, 7.2 points above the national average of 52.8.", position).join(), /says above/);
});

test("a rank fails, since the brief states bands only", () => {
  assert.match(problemsOf("Bhaktapur ranks 538th on the Prosperity Score.", ["prosperity.score"]).join(), /states a rank/);
});

test("a band phrase must match the cited band", () => {
  assert.deepEqual(problemsOf("It sits in the fourth fifth of Nepal's municipalities.", ["prosperity.band.national"]), []);
  assert.match(problemsOf("It sits in the middle fifth of Nepal's municipalities.", ["prosperity.band.national"]).join(), /band "middle fifth"/);
});

test("a trend claim must match the cited change", () => {
  assert.match(
    problemsOf("The Prosperity Score rose since 2021.", ["prosperity.change.direction", "release.first_year"]).join(),
    /says the score rose/,
  );
  assert.match(problemsOf("The Prosperity Score has been broadly stable.", ["prosperity.change.direction"]).join(), /says stable/);
});

test("a component with nothing recorded cannot be compared", () => {
  const livability = ["livability.component.emissions.value", "livability.component.emissions.national_average"];
  assert.equal(sheet.facts["livability.component.emissions.status"].value, "not recorded");
  assert.match(problemsOf("Emissions, at 54, is above the national average of 50.4.", livability).join(), /compares emissions, which is not recorded/);
});

test("spelled-out numbers fail, since only digits can be checked", () => {
  assert.match(problemsOf("Two components pull it down most.", ["prosperity.driver.national.down.1"]).join(), /spells out the number "Two"/);
});

test("a superlative needs a driver, band, or neighbour fact", () => {
  assert.match(
    problemsOf("Agricultural Land is its weakest component, at 2.", ["prosperity.component.agricultural_land.value"]).join(),
    /superlative/,
  );
});

test("a component named in the text must be cited", () => {
  assert.match(problemsOf("Tourism scored 13.", ["prosperity.component.luminosity_per_capita.value"]).join(), /names Tourism without citing it/);
});

test("a malformed model response never reaches the brief", () => {
  assert.equal(parseSectionOneOutput("Bhaktapur scored 45.6.").ok, false);
  assert.equal(parseSectionOneOutput(JSON.stringify({ sentences: [{ text: "x" }] })).ok, false);
  assert.equal(parseSectionOneOutput(JSON.stringify({ sentences: [{ text: "x", fact_ids: [] }] })).ok, false);
  const ok = parseSectionOneOutput(JSON.stringify({ sentences: Array.from({ length: 3 }, () => ({ text: " x ", fact_ids: ["release.year"] })) }));
  assert.deepEqual(ok, { ok: true, sentences: Array.from({ length: 3 }, () => ({ text: "x", factIds: ["release.year"] })) });
});
