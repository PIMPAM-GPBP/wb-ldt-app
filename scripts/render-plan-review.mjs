#!/usr/bin/env node
// Renders an extraction run as one HTML page for review: plan store and extraction numbers per
// country, then per golden-set unit the verified commitments by pillar (section two), the coverage
// matrix and gap sentences (section three), and the quotes that were dropped and why.
//
// Usage: node scripts/render-plan-review.mjs data/plan-store/commitments-<date>.jsonl
import { readFileSync, writeFileSync } from "node:fs";

import { MACHINE_TRANSLATION, coverageSection, displayQuote, pageLink } from "../src/lib/brief/plan-sections.ts";
import { verifySentence } from "../src/lib/brief/verify.ts";

const [input] = process.argv.slice(2);
if (!input) throw new Error("Pass the JSONL file from extract-plan-commitments.mjs.");

const records = readFileSync(input, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
const { documents } = JSON.parse(readFileSync("data/plan-store/documents.json", "utf8"));
const golden = JSON.parse(readFileSync("src/lib/brief/golden-set.json", "utf8")).units;
const sheetFor = (unit) => JSON.parse(readFileSync(`tests/fixtures/brief/fact-sheets/${unit.country.toLowerCase()}/${unit.unitKey}.json`, "utf8"));

const escape = (text) => String(text ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const normalizeName = (name) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const COUNTRY_NAMES = { NPL: "Nepal", ZMB: "Zambia", SRB: "Serbia" };
const PILLAR_ORDER = ["prosperity", "infrastructure", "livability"];
const SHOWN_PER_COMPONENT = 4;

const toPlanCommitments = (record) => record.kept.map((commitment) => ({ ...commitment, planId: record.id, planUrl: record.url, planTitle: record.title }));

function storeTable() {
  const rows = ["NPL", "ZMB", "SRB"].map((country) => {
    const mine = documents.filter((document) => document.country === country);
    const count = (status) => mine.filter((document) => document.status === status).length;
    const pages = mine.reduce((sum, document) => ({ ok: sum.ok + document.pageQuality.ok, other: sum.other + document.pageQuality.empty + document.pageQuality.garbled }), { ok: 0, other: 0 });
    return `<tr><th>${COUNTRY_NAMES[country]}</th><td>${mine.length}</td><td>${count("text")}</td><td>${count("needs OCR")}</td><td>${count("not a PDF")}</td><td>${count("failed")}</td><td>${pages.ok.toLocaleString("en-US")}</td><td>${pages.other.toLocaleString("en-US")}</td></tr>`;
  });
  return `<table><thead><tr><th>Country</th><th>Plans</th><th>Text</th><th>Needs OCR</th><th>Not a PDF</th><th>Failed</th><th>Readable pages</th><th>Empty or garbled pages</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

function extractionTable() {
  const rows = ["ZMB", "SRB", "NPL"].map((country) => {
    const mine = records.filter((record) => record.country === country);
    if (mine.length === 0) return "";
    const kept = mine.flatMap((record) => record.kept);
    const dropped = mine.flatMap((record) => record.dropped);
    // Too-short items are dropped by rule and shown in their own column, not counted as misquotes.
    const quoteDrops = dropped.filter((entry) => entry.reason === "quote unmatched").length;
    const tooShort = dropped.filter((entry) => entry.reason === "quote too short").length;
    const rate = kept.length + quoteDrops ? ((100 * kept.length) / (kept.length + quoteDrops)).toFixed(1) : "n/a";
    const cost = mine.reduce((sum, record) => sum + record.costUsd, 0);
    return `<tr><th>${COUNTRY_NAMES[country]}</th><td>${mine.length}</td><td>${mine.reduce((sum, record) => sum + record.chunks, 0)}</td><td>${kept.length}</td><td>${kept.filter((entry) => entry.match === "exact").length}</td><td>${kept.filter((entry) => entry.match === "fuzzy").length}</td><td>${kept.filter((entry) => entry.page !== entry.citedPage).length}</td><td>${rate}%</td><td>${quoteDrops}</td><td>${tooShort}</td><td>${dropped.length - quoteDrops - tooShort}</td><td>$${cost.toFixed(3)}</td></tr>`;
  });
  return `<table><thead><tr><th>Country</th><th>Plans read</th><th>Chunks</th><th>Kept</th><th>Exact</th><th>Fuzzy</th><th>Other page than cited</th><th>Quote match rate</th><th>Unmatched</th><th>Too short</th><th>No component</th><th>Cost</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

function commitmentItem(commitment) {
  const translation = commitment.english ? `<p class="translation"><span>${MACHINE_TRANSLATION}:</span> ${escape(commitment.english)}</p>` : "";
  return `<li><blockquote>${escape(displayQuote(commitment.quote))}</blockquote>${translation}<p class="meta"><a href="${escape(pageLink(commitment))}" target="_blank" rel="noreferrer">Page ${commitment.page}</a> · ${commitment.kind}, ${commitment.strength}${commitment.match === "fuzzy" ? ` · fuzzy match ${commitment.similarity.toFixed(2)}` : ""}</p></li>`;
}

function unitBlock(unit) {
  const sheet = sheetFor(unit);
  const plans = documents.filter((document) => document.country === unit.country && document.level === "local" && document.units.some((name) => normalizeName(name) === normalizeName(unit.name)));
  const readPlans = records.filter((record) => plans.some((plan) => plan.id === record.id));
  const national = records.filter((record) => record.country === unit.country && record.level === "national");
  const commitments = readPlans.flatMap(toPlanCommitments);
  const nationalCommitments = national.flatMap(toPlanCommitments);
  const hasPlan = readPlans.length > 0;
  const planLine = plans.length === 0
    ? "No local plan is listed."
    : plans.map((plan) => `<a href="${escape(plan.url)}" target="_blank" rel="noreferrer">${escape(plan.title)}</a> (${plan.status}${plan.units.length > 1 ? `, shared by ${plan.units.length} units` : ""}${plan.script ? `, ${plan.script}` : ""})`).join("; ");

  const pillars = PILLAR_ORDER.map((pillarKey) => {
    const pillar = sheet.pillars.find((entry) => entry.key === pillarKey);
    const section = coverageSection(sheet, pillarKey, commitments, hasPlan);
    const groups = section.rows
      .filter((row) => row.commitments.length > 0)
      .map((row) => {
        const ordered = [...row.commitments].sort((a, b) => (a.strength === b.strength ? a.page - b.page : a.strength === "specific" ? -1 : 1));
        const more = ordered.length > SHOWN_PER_COMPONENT ? `<p class="meta">And ${ordered.length - SHOWN_PER_COMPONENT} more.</p>` : "";
        return `<h5>${escape(row.component.label.replace(/ Score$/, ""))}</h5><ul class="commitments">${ordered.slice(0, SHOWN_PER_COMPONENT).map(commitmentItem).join("")}</ul>${more}`;
      });
    const nationalOnPillar = nationalCommitments.filter((commitment) => commitment.components.some((key) => pillar.components.some((component) => component.key === key)));
    const matrix = section.rows
      .map((row) => {
        const value = sheet.facts[`${pillarKey}.component.${row.component.key}.value`]?.value;
        const average = sheet.facts[`${pillarKey}.component.${row.component.key}.national_average`]?.value;
        const score = row.scoreStatus === "not measured" ? "not measured" : `${row.scoreStatus} (${value} against ${Number(average).toFixed(1)})`;
        const flag = row.scoreStatus === "below average" && row.salience === "silent" ? ' class="gap"' : "";
        return `<tr${flag}><td>${escape(row.component.label.replace(/ Score$/, ""))}</td><td>${score}</td><td>${hasPlan ? `${row.salience} (${row.commitments.length})` : "no plan read"}</td></tr>`;
      })
      .join("");
    const gaps = section.sentences
      .map((sentence) => {
        const problems = verifySentence(section.sheet, sentence).problems;
        return `<li>${escape(sentence.text)}${problems.length ? `<p class="problem">Verifier: ${escape(problems.join("; "))}</p>` : ""}</li>`;
      })
      .join("");
    return `<section class="pillar"><h4>${escape(pillar.label)}</h4>
  <div class="columns">
    <div><h5 class="label">What the plan commits to</h5>${groups.length ? groups.join("") : `<p class="note">${hasPlan ? "No verified commitment on this score's components." : "No local plan read."}</p>`}
      ${nationalOnPillar.length ? `<details><summary>${nationalOnPillar.length} national plan commitments on these components</summary><ul class="commitments">${nationalOnPillar.slice(0, 6).map(commitmentItem).join("")}</ul></details>` : ""}</div>
    <div><h5 class="label">Coverage gaps</h5><table class="matrix"><thead><tr><th>Component</th><th>Score</th><th>Plan</th></tr></thead><tbody>${matrix}</tbody></table><ul class="gaps">${gaps}</ul></div>
  </div></section>`;
  });

  const dropped = readPlans.flatMap((record) => record.dropped);
  const droppedBlock = dropped.length
    ? `<details><summary>${dropped.length} dropped</summary><ul class="dropped">${dropped.map((entry) => `<li><b>${escape(entry.reason)}</b>, cited page ${entry.page}: ${escape(entry.quote)}</li>`).join("")}</ul></details>`
    : "";
  return `<article class="unit"><h3>${escape(unit.name)} <span>${escape(unit.province)}</span></h3><p class="meta">Local plan: ${planLine}</p>${droppedBlock}${pillars.join("")}</article>`;
}

const cost = records.reduce((sum, record) => sum + record.costUsd, 0);
const first = records[0] ?? {};
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Plan commitments review</title>
<style>
:root { --ink: #1b2340; --muted: #586179; --rule: #d9dce5; --paper: #ffffff; --wash: #f5f6f9; --accent: #2b5fae; --flag: #b0472c; --flag-wash: #fbeee9; }
@media (prefers-color-scheme: dark) { :root { --ink: #f5f7ff; --muted: #a9b4cf; --rule: #2c3350; --paper: #11152a; --wash: #181d36; --accent: #8fb3f0; --flag: #f49b78; --flag-wash: #3a2422; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1180px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { font-size: 26px; margin: 0 0 4px; } h2 { font-size: 20px; margin: 48px 0 8px; padding-bottom: 6px; border-bottom: 2px solid var(--ink); }
h3 { font-size: 17px; margin: 36px 0 2px; } h3 span, .meta, .note { color: var(--muted); font-weight: 400; }
h4 { font-size: 14px; margin: 20px 0 6px; text-transform: uppercase; letter-spacing: 0.04em; } h5 { font-size: 14px; margin: 12px 0 4px; } h5.label { color: var(--muted); font-weight: 500; margin-top: 0; }
.meta { font-size: 13px; margin: 2px 0; } a { color: var(--accent); }
table { border-collapse: collapse; width: 100%; font-size: 13px; margin: 8px 0 16px; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--rule); vertical-align: top; }
tr.gap td { background: var(--flag-wash); color: var(--flag); font-weight: 600; }
.columns { display: grid; grid-template-columns: 3fr 2fr; gap: 28px; } @media (max-width: 820px) { .columns { grid-template-columns: 1fr; } }
.pillar { border-top: 1px solid var(--rule); }
ul.commitments { list-style: none; padding: 0; margin: 0; } ul.commitments li { margin: 0 0 10px; }
blockquote { margin: 0; padding-left: 10px; border-left: 3px solid var(--rule); }
.translation { margin: 2px 0 0 13px; font-size: 13px; color: var(--muted); } .translation span { font-weight: 600; }
.gaps { padding-left: 18px; } .problem { color: var(--flag); font-size: 13px; margin: 2px 0; }
details { font-size: 13px; color: var(--muted); margin: 6px 0; } summary { cursor: pointer; } ul.dropped li { margin-bottom: 4px; }
</style></head><body><main>
<h1>Plan commitments review</h1>
<p class="meta">Model ${escape(first.model)}, prompt ${escape(first.promptVersion)}, $${cost.toFixed(3)} for this run. Model-extracted commitments, each quote found in the plan's own text; unreviewed, internal use only.</p>
<h2>Plan store</h2>${storeTable()}
<h2>Extraction</h2>${extractionTable()}
${["ZMB", "SRB", "NPL"].map((country) => `<h2>${COUNTRY_NAMES[country]}</h2>${golden.filter((unit) => unit.country === country).map(unitBlock).join("\n")}`).join("\n")}
</main></body></html>
`;
const output = input.replace(/\.jsonl$/, ".html");
writeFileSync(output, html);
console.log(`Wrote ${output}`);
