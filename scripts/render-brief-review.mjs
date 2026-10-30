#!/usr/bin/env node
// Renders a generation run from scripts/generate-brief-section-one.mjs as one HTML page for review:
// per golden-set unit and pillar, the code-only text the public would see, and the model's text with
// every sentence marked kept or dropped, the verifier's reason, and the facts it cites.
//
// Usage: node scripts/render-brief-review.mjs data/brief-review/section-one-<date>.jsonl
import { readFileSync, writeFileSync } from "node:fs";

const [input] = process.argv.slice(2);
if (!input) throw new Error("Pass the JSONL file from generate-brief-section-one.mjs.");

const records = readFileSync(input, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
const golden = JSON.parse(readFileSync("src/lib/brief/golden-set.json", "utf8"));
const sheets = new Map();
const sheetFor = (country, unitKey) => {
  const key = `${country}/${unitKey}`;
  if (!sheets.has(key)) sheets.set(key, JSON.parse(readFileSync(`tests/fixtures/brief/fact-sheets/${country.toLowerCase()}/${unitKey}.json`, "utf8")));
  return sheets.get(key);
};

const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const PILLAR_ORDER = ["prosperity", "livability", "infrastructure"];
const COUNTRY_NAMES = { NPL: "Nepal", ZMB: "Zambia", SRB: "Serbia" };

function factList(sheet, factIds) {
  const rows = factIds.map((id) => {
    const fact = sheet.facts[id];
    return `<li><code>${escape(id)}</code> <b>${escape(fact ? JSON.stringify(fact.value) : "unknown")}</b> ${escape(fact?.label ?? "")}</li>`;
  });
  return `<details><summary>${factIds.length} facts</summary><ul class="facts">${rows.join("")}</ul></details>`;
}

function sentenceBlock(sheet, sentence, kept) {
  const problems = sentence.problems?.length ? `<p class="problem">Dropped: ${escape(sentence.problems.join("; "))}</p>` : "";
  return `<li class="${kept ? "kept" : "dropped"}"><p>${escape(sentence.text)}</p>${problems}${factList(sheet, sentence.factIds)}</li>`;
}

const allSentences = records.flatMap((record) => record.sentences);
const kept = allSentences.filter((sentence) => sentence.problems.length === 0).length;
const cost = records.reduce((sum, record) => sum + (record.costUsd ?? 0), 0);
const problemKinds = new Map();
for (const sentence of allSentences) {
  for (const problem of sentence.problems) {
    const kind = problem.replace(/^"[^"]*" matches/, "a number matches").replace(/"[^"]*"/g, "a phrase").replace(/compares \w+/, "compares X").replace(/names .+ without/, "names X without");
    problemKinds.set(kind, (problemKinds.get(kind) ?? 0) + 1);
  }
}

const sections = [];
for (const country of ["NPL", "ZMB", "SRB"]) {
  const units = golden.units.filter((unit) => unit.country === country);
  const blocks = units.map((unit) => {
    const sheet = sheetFor(country, unit.unitKey);
    const pillars = PILLAR_ORDER.map((pillarKey) => {
      const record = records.find((entry) => entry.country === country && entry.unitKey === unit.unitKey && entry.pillar === pillarKey);
      const label = sheet.pillars.find((pillar) => pillar.key === pillarKey)?.label ?? pillarKey;
      if (!record) return `<section class="pillar"><h4>${escape(label)}</h4><p class="note">Not generated in this run.</p></section>`;
      const model =
        record.status === "completed"
          ? `<ol class="sentences">${record.sentences.map((sentence) => sentenceBlock(sheet, sentence, sentence.problems.length === 0)).join("")}</ol>`
          : `<p class="problem">${escape(record.status)}: ${escape(record.error ?? "")}</p>`;
      const keptHere = record.sentences.filter((sentence) => sentence.problems.length === 0).length;
      return `<section class="pillar">
  <h4>${escape(label)}</h4>
  <div class="columns">
    <div><h5>Code only, shown before review</h5><ol class="sentences">${record.template.map((sentence) => sentenceBlock(sheet, { ...sentence, problems: [] }, true)).join("")}</ol></div>
    <div><h5>Model draft, ${keptHere} of ${record.sentences.length} sentences kept</h5>${model}</div>
  </div>
</section>`;
    });
    return `<article class="unit" id="${escape(`${country}-${unit.unitKey}`)}">
  <h3>${escape(unit.name)} <span>${escape(unit.province)}</span></h3>
  <p class="meta">In the golden set because: ${escape(unit.reasons.join("; "))}. Local plan: ${escape(unit.planStatus)}.</p>
  ${pillars.join("\n")}
</article>`;
  });
  sections.push(`<section class="country"><h2>${COUNTRY_NAMES[country]}</h2>${blocks.join("\n")}</section>`);
}

const first = records[0] ?? {};
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Section one review</title>
<style>
:root { --ink: #1b2340; --muted: #586179; --rule: #d9dce5; --paper: #ffffff; --wash: #f5f6f9; --kept: #23735a; --dropped: #b0472c; }
@media (prefers-color-scheme: dark) { :root { --ink: #f5f7ff; --muted: #a9b4cf; --rule: #2c3350; --paper: #11152a; --wash: #181d36; --kept: #62c39a; --dropped: #f49b78; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1180px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { font-size: 26px; margin: 0 0 4px; }
h2 { font-size: 20px; margin: 48px 0 8px; padding-bottom: 6px; border-bottom: 2px solid var(--ink); }
h3 { font-size: 17px; margin: 32px 0 2px; }
h3 span, .meta, .note, h5 { color: var(--muted); font-weight: 400; }
h4 { font-size: 14px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.04em; }
h5 { font-size: 13px; margin: 0 0 6px; }
.meta { margin: 0; font-size: 13px; }
.summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 20px 0; }
.summary div { background: var(--wash); padding: 12px; border-radius: 4px; }
.summary b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
.columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media (max-width: 760px) { .columns { grid-template-columns: 1fr; } }
.pillar { border-top: 1px solid var(--rule); }
.sentences { margin: 0; padding-left: 20px; }
.sentences li { margin-bottom: 8px; }
.sentences p { margin: 0; }
.dropped > p:first-child { text-decoration: line-through; color: var(--muted); }
.problem { color: var(--dropped); font-size: 13px; margin: 2px 0 0; }
details { font-size: 12px; color: var(--muted); }
summary { cursor: pointer; }
.facts { padding-left: 16px; margin: 4px 0; }
code { font-size: 11px; }
ul.kinds { margin: 0; padding-left: 20px; }
</style>
</head>
<body>
<main>
<h1>Planning brief, section one review</h1>
<p class="meta">Model ${escape(first.model ?? "")}, prompt ${escape(first.promptVersion ?? "")}, fact sheet v${escape(first.factSheetVersion ?? "")}. Unreviewed model output for the golden set; internal use only.</p>
<div class="summary">
  <div><b>${records.length}</b>calls</div>
  <div><b>$${cost.toFixed(3)}</b>estimated cost</div>
  <div><b>${kept} of ${allSentences.length}</b>model sentences kept</div>
  <div><b>${records.filter((record) => record.status !== "completed").length}</b>calls without usable output</div>
</div>
${problemKinds.size > 0 ? `<h5>Why sentences were dropped</h5><ul class="kinds">${[...problemKinds].sort((a, b) => b[1] - a[1]).map(([kind, count]) => `<li>${count} × ${escape(kind)}</li>`).join("")}</ul>` : ""}
${sections.join("\n")}
</main>
</body>
</html>
`;

const output = input.replace(/\.jsonl$/, ".html");
writeFileSync(output, html);
console.log(`Wrote ${output}`);
