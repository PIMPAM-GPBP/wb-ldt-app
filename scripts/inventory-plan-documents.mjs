#!/usr/bin/env node
// Phase 0 plan inventory. Fetches every plan document the app can use (workbook rows through
// scripts/lib/plan-sources.mjs plus the hard-coded national plans), records what came back, and
// measures the PDF text layer and script mix so OCR and translation can be chosen per country.
//
// Network: GET requests to the public plan documents only. Supabase: one read-only SELECT to
// cross-check the workbook against analytics.plan_document_sources (skipped when env is missing).
//
// Usage: node scripts/inventory-plan-documents.mjs [--date yyyymmdd] [--timeout-ms 30000]
//          [--concurrency 4] [--country NPL|SRB|ZMB] [--resume]
//
// Outputs, under data/ai-audit/ (gitignored):
//   plan-inventory-<date>.jsonl     one line per unique URL, written as each finishes (resume source)
//   plan-inventory-<date>.csv       one row per workbook or national source row, joined to its URL result
//   plan-inventory-<date>.md        per-country summary
//   hand-check-<date>.csv           the ten-per-country hand-check sheet
//   plan-text-<date>/<CC>/<slug>.txt   extracted text per document, pages separated, for the quote test
//
// Thresholds, also stated in the markdown:
//   A page has a usable text layer when its extracted text has at least MIN_PAGE_TEXT_CHARS
//   non-whitespace characters. A PDF is "text" when at least 80 percent of pages have one, "scanned"
//   when at most 20 percent do, and "mixed" in between.
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import zlib from "node:zlib";

import { createClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";

import {
  canUseRelaxedTlsForPlanDocumentUrl,
  isNodeTlsCertificateError,
} from "../src/lib/ai/plan-document-fetch.ts";
import { loadLocalEnv } from "./lib/load-env.mjs";
import { getCountryConfigs } from "./lib/nepal-data.mjs";
import { buildCountryPlanSourcePayloads, readPlanSourceWorkbook } from "./lib/plan-sources.mjs";

const OUTPUT_DIR = "data/ai-audit";
const WORKBOOK_PATH = "data/SNG Development Plans.xlsx";
const USER_AGENT = "LDT-plan-inventory/1.0 (GPB Local Development Tool, Phase 0 plan document audit)";
const MAX_REDIRECTS = 5;
const PARSE_TIMEOUT_MS = 180_000;
const MIN_PAGE_TEXT_CHARS = 100;
const TEXT_SHARE_FOR_TEXT = 0.8;
const TEXT_SHARE_FOR_SCANNED = 0.2;
const SAMPLE_TEXT_LENGTH = 200;
const HAND_CHECK_PER_COUNTRY = 10;

// Nepal's national plan is seeded by supabase/migrations/0007_plan_document_sources.sql rather than
// by scripts/lib/plan-sources.mjs, so it is restated here. Keep the two in step.
const NEPAL_NATIONAL_PLAN = {
  country_code: "NPL",
  country: "Nepal",
  source_sheet: "Nepal",
  plan_level: "national",
  province: null,
  title: "Nepal National Plan (Sixteenth Plan)",
  link: "http://elibrary.moest.gov.np/bitstream/123456789/308/1/16.pdf",
  document_type: "development_plan",
  notes: "Seeded by migration 0007",
  priority: 1,
};

const ENGLISH_STOPWORDS = new Set(["the", "and", "of", "to", "in", "for", "is", "that", "with", "by", "are", "this"]);
const SERBIAN_LATIN_STOPWORDS = new Set(["i", "u", "na", "je", "za", "se", "da", "su", "od", "koji", "kao", "sa", "ili", "iz", "će"]);

function getArgValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function todayStamp() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}${month}${day}`;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function collapse(text) {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function slugify(text) {
  return (
    text
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "document"
  );
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// UTF-8 with a BOM so Excel reads Cyrillic and Devanagari correctly.
function toCsv(columns, rows) {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvCell(row[column])).join(","));
  return `﻿${lines.join("\n")}\n`;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? collapse(match[1]).slice(0, 160) : "";
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`${label} exceeded ${ms} ms`), { name: "TimeoutError" })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function errorCode(error) {
  if (!error || typeof error !== "object") return null;
  if (typeof error.code === "string") return error.code;
  const cause = error.cause;
  return cause && typeof cause === "object" && typeof cause.code === "string" ? cause.code : null;
}

function classifyError(error) {
  const name = error?.name ?? "";
  const code = errorCode(error) ?? "";
  if (name === "TimeoutError" || name === "AbortError" || code === "UND_ERR_CONNECT_TIMEOUT") return "timeout";
  if (isNodeTlsCertificateError(error) || code.startsWith("ERR_TLS")) return "tls";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "dns";
  if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ETIMEDOUT" || code === "EHOSTUNREACH") return "connection";
  return "fetch_other";
}

function errorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  const code = errorCode(error);
  const causeMessage = error?.cause instanceof Error ? error.cause.message : "";
  return collapse([message, code, causeMessage].filter(Boolean).join(" / ")).slice(0, 300);
}

function decodeBody(body, contentEncoding) {
  const encoding = (contentEncoding ?? "").toLowerCase();
  if (encoding === "gzip" || encoding === "x-gzip") return zlib.gunzipSync(body);
  if (encoding === "deflate") return zlib.inflateSync(body);
  if (encoding === "br") return zlib.brotliDecompressSync(body);
  return body;
}

// Plain node:http(s) request with the inventory's own timeout over the whole transfer. Used in two
// cases: the app's relaxed-TLS fallback, which only canUseRelaxedTlsForPlanDocumentUrl hosts
// (gov.zm) may take, and a retry when fetch gives up on the TLS connect after its own 10 s.
function fetchWithNodeHttp(url, timeoutMs, relaxedTls, deadline = Date.now() + timeoutMs, redirectCount = 0) {
  if (redirectCount > MAX_REDIRECTS) return Promise.reject(new Error("too many redirects"));
  if (relaxedTls && !canUseRelaxedTlsForPlanDocumentUrl(url)) {
    return Promise.reject(new Error(`Relaxed TLS is not allowed for ${url}`));
  }

  const target = new URL(url);
  const client = target.protocol === "https:" ? https : http;
  const options = { headers: { "user-agent": USER_AGENT, accept: "application/pdf,text/html;q=0.9,*/*;q=0.8" } };
  if (relaxedTls && target.protocol === "https:") options.rejectUnauthorized = false;

  return new Promise((resolve, reject) => {
    const timeoutError = Object.assign(new Error(`node http transfer exceeded ${timeoutMs} ms`), { name: "TimeoutError" });
    const request = client.request(target, options, (response) => {
      const statusCode = response.statusCode ?? 0;
      const location = response.headers.location;
      if (location && [301, 302, 303, 307, 308].includes(statusCode)) {
        response.resume();
        clearTimeout(timer);
        fetchWithNodeHttp(new URL(location, target).href, timeoutMs, relaxedTls, deadline, redirectCount + 1).then(resolve, reject);
        return;
      }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("error", reject);
      response.on("end", () => {
        clearTimeout(timer);
        const contentType = response.headers["content-type"];
        let body;
        try {
          body = decodeBody(Buffer.concat(chunks), response.headers["content-encoding"]);
        } catch (error) {
          reject(error);
          return;
        }
        resolve({
          status: statusCode,
          finalUrl: target.href,
          contentType: Array.isArray(contentType) ? (contentType[0] ?? "") : (contentType ?? ""),
          body,
          fetchPath: relaxedTls ? "node_http_relaxed_tls" : "node_http",
        });
      });
    });
    const timer = setTimeout(() => request.destroy(timeoutError), Math.max(deadline - Date.now(), 0));
    request.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    request.end();
  });
}

async function fetchDocument(url, timeoutMs) {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/pdf,text/html;q=0.9,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      finalUrl: response.url || url,
      contentType: response.headers.get("content-type") ?? "",
      body,
      fetchPath: "fetch",
    };
  } catch (error) {
    if (isNodeTlsCertificateError(error) && canUseRelaxedTlsForPlanDocumentUrl(url)) {
      return fetchWithNodeHttp(url, timeoutMs, true);
    }
    // Node's fetch caps the connect and TLS handshake at 10 s regardless of the signal. Retry once
    // over node:http with the full timeout so "timeout" means the stated limit, not fetch's own.
    if (errorCode(error) === "UND_ERR_CONNECT_TIMEOUT") {
      return fetchWithNodeHttp(url, timeoutMs, false);
    }
    throw error;
  }
}

// PDF by content, not by URL or header: pdf.js accepts a header within the first 1024 bytes.
function looksLikePdf(body) {
  return body.subarray(0, 1024).indexOf("%PDF-") !== -1;
}

function urlSaysPdf(url) {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return url.toLowerCase().endsWith(".pdf");
  }
}

async function parsePdfPages(body) {
  const parser = new PDFParse({ data: body, verbosity: 0 });
  try {
    const result = await withTimeout(parser.getText(), PARSE_TIMEOUT_MS, "PDF text extraction");
    return result.pages.map((page) => ({ num: page.num, text: page.text ?? "" }));
  } finally {
    await parser.destroy().catch(() => {});
  }
}

// Letters by script, as shares of all letters in the text.
function scriptMix(text) {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  const share = (pattern) => (letters === 0 ? 0 : Number(((text.match(pattern)?.length ?? 0) / letters).toFixed(3)));
  return {
    letters,
    devanagari_share: share(/\p{Script=Devanagari}/gu),
    cyrillic_share: share(/\p{Script=Cyrillic}/gu),
    latin_share: share(/\p{Script=Latin}/gu),
  };
}

// Script decides first; Latin text is split into English and Serbian Latin by stopword counts.
// Nepal documents that come out Latin-only are flagged because legacy Nepali fonts (Preeti and
// relatives) map Devanagari glyphs onto ASCII, which pdf-parse returns as unreadable Latin text.
function guessLanguage(text, mix, countryCode) {
  if (mix.letters < 50) return "none";
  if (mix.devanagari_share >= 0.5) return "ne";
  if (mix.cyrillic_share >= 0.5) return "sr-Cyrl";
  if (mix.latin_share < 0.5) return "unknown";
  const tokens = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  let english = 0;
  let serbian = 0;
  for (const token of tokens) {
    if (ENGLISH_STOPWORDS.has(token)) english += 1;
    else if (SERBIAN_LATIN_STOPWORDS.has(token)) serbian += 1;
  }
  if (english === 0 && serbian === 0) return countryCode === "NPL" ? "latin-unreadable?" : "unknown";
  if (serbian > english) return "sr-Latn";
  if (countryCode === "NPL" && english / Math.max(tokens.length, 1) < 0.02) return "latin-unreadable?";
  return "en";
}

function classifyText(pages) {
  const textPages = pages.filter((page) => page.text.replace(/\s/g, "").length >= MIN_PAGE_TEXT_CHARS).length;
  const share = pages.length === 0 ? 0 : textPages / pages.length;
  const textClass = share >= TEXT_SHARE_FOR_TEXT ? "text" : share <= TEXT_SHARE_FOR_SCANNED ? "scanned" : "mixed";
  return { textPages, textClass };
}

// The page with the most text in the middle third of the document, as a starting point for the quote test.
function samplePage(pages) {
  if (pages.length === 0) return { sample_page: "", sample_text: "" };
  const start = Math.floor(pages.length / 3);
  const end = Math.max(start + 1, Math.ceil((2 * pages.length) / 3));
  const candidates = pages.slice(start, end);
  const best = candidates.reduce((top, page) => (page.text.length > top.text.length ? page : top), candidates[0]);
  return { sample_page: best.num, sample_text: collapse(best.text).slice(0, SAMPLE_TEXT_LENGTH) };
}

async function saveText(textDir, source, pages) {
  const dir = path.join(textDir, source.country_code);
  await mkdir(dir, { recursive: true });
  const name = `${slugify(source.province ?? "national")}-${sha256(source.link).slice(0, 8)}.txt`;
  const file = path.join(dir, name);
  const header = [`URL: ${source.link}`, `Pages: ${pages.length}`, ""].join("\n");
  const body = pages.map((page) => `=== page ${page.num} ===\n\n${page.text.trim()}\n`).join("\n");
  await writeFile(file, `${header}\n${body}`);
  return file;
}

async function inventoryUrl(url, source, options) {
  const started = Date.now();
  const record = {
    url,
    country_code: source.country_code,
    status: "",
    http_status: "",
    final_url: "",
    content_type: "",
    bytes: 0,
    fetch_path: "",
    url_says_pdf: urlSaysPdf(url) ? 1 : 0,
    content_type_says_pdf: 0,
    is_pdf: 0,
    html_title: "",
    pages: "",
    text_pages: "",
    text_chars: "",
    text_class: "",
    letters: "",
    devanagari_share: "",
    cyrillic_share: "",
    latin_share: "",
    language_guess: "",
    sample_page: "",
    sample_text: "",
    text_file: "",
    error_class: "",
    error_message: "",
    fetch_ms: "",
    parse_ms: "",
  };

  let response;
  try {
    response = await fetchDocument(url, options.timeoutMs);
  } catch (error) {
    record.status = "failed";
    record.error_class = classifyError(error);
    record.error_message = errorMessage(error);
    record.fetch_ms = Date.now() - started;
    return record;
  }
  record.fetch_ms = Date.now() - started;
  record.http_status = response.status;
  record.final_url = response.finalUrl;
  record.content_type = response.contentType;
  record.bytes = response.body.length;
  record.fetch_path = response.fetchPath;
  record.content_type_says_pdf = /pdf/i.test(response.contentType) ? 1 : 0;
  record.is_pdf = looksLikePdf(response.body) ? 1 : 0;

  if (response.status < 200 || response.status >= 300) {
    record.status = "failed";
    record.error_class = `http_${response.status}`;
    record.error_message = `HTTP ${response.status}`;
    if (/html/i.test(response.contentType)) record.html_title = htmlTitle(response.body.toString("utf8"));
    return record;
  }

  if (!record.is_pdf) {
    const html = response.body.toString("utf8");
    const isHtml = /html/i.test(response.contentType) || /<html/i.test(html.slice(0, 2048));
    record.html_title = isHtml ? htmlTitle(html) : "";
    // A .pdf URL that answers with HTML is a soft failure (an error or landing page), not a web plan.
    record.status = record.url_says_pdf ? "pdf_expected_got_other" : "non_pdf";
    const text = isHtml ? stripHtml(html) : "";
    const mix = scriptMix(text);
    Object.assign(record, mix, {
      text_chars: text.length,
      language_guess: guessLanguage(text, mix, source.country_code),
    });
    if (text) record.text_file = await saveText(options.textDir, source, [{ num: 1, text }]);
    return record;
  }

  const parseStarted = Date.now();
  let pages;
  try {
    pages = await parsePdfPages(response.body);
  } catch (error) {
    record.status = "failed";
    record.error_class = error?.name === "TimeoutError" ? "parse_timeout" : "parse_error";
    record.error_message = errorMessage(error);
    record.parse_ms = Date.now() - parseStarted;
    return record;
  }
  record.parse_ms = Date.now() - parseStarted;

  const text = pages.map((page) => page.text).join("\n");
  const mix = scriptMix(text);
  const { textPages, textClass } = classifyText(pages);
  Object.assign(record, mix, samplePage(pages), {
    status: "pdf",
    pages: pages.length,
    text_pages: textPages,
    text_chars: text.length,
    text_class: textClass,
    language_guess: guessLanguage(text, mix, source.country_code),
  });
  record.text_file = await saveText(options.textDir, source, pages);
  return record;
}

async function runPool(items, concurrency, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

async function loadResumeRecords(file) {
  try {
    const raw = await readFile(file, "utf8");
    return new Map(
      raw
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .map((record) => [record.url, record]),
    );
  } catch (error) {
    if (error?.code === "ENOENT") return new Map();
    throw error;
  }
}

// Which bucket a document falls in for the summary and the hand-check spread.
function bucketOf(record) {
  if (record.status === "pdf") return record.text_class;
  if (record.status === "non_pdf") return "non_pdf";
  return "failed";
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

// Evenly spaced picks from a stratum sorted by unit name, so a rerun picks the same documents.
function spread(docs, count) {
  const sorted = [...docs].sort((a, b) => a.unit.localeCompare(b.unit));
  if (count >= sorted.length) return sorted;
  return Array.from({ length: count }, (_, i) => sorted[Math.floor(((i + 0.5) * sorted.length) / count)]);
}

function pickHandCheck(countryCode, docs) {
  if (countryCode === "NPL") return docs;
  const national = docs.filter((doc) => doc.plan_level === "national");
  const local = docs.filter((doc) => doc.plan_level !== "national");
  const strata = ["text", "mixed", "scanned", "non_pdf", "failed"]
    .map((bucket) => ({ bucket, docs: local.filter((doc) => doc.bucket === bucket) }))
    .filter((stratum) => stratum.docs.length > 0);
  let remaining = HAND_CHECK_PER_COUNTRY - national.length;
  const quota = new Map(strata.map((stratum) => [stratum.bucket, 1]));
  remaining -= strata.length;
  // Distribute the rest in proportion to stratum size, largest remainder first, capped at the stratum size.
  const total = local.length;
  const shares = strata.map((stratum) => ({
    bucket: stratum.bucket,
    size: stratum.docs.length,
    exact: (remaining * stratum.docs.length) / total,
  }));
  for (const share of shares) {
    const extra = Math.min(Math.floor(share.exact), share.size - 1);
    quota.set(share.bucket, quota.get(share.bucket) + extra);
    remaining -= extra;
  }
  for (const share of shares.sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)))) {
    if (remaining <= 0) break;
    if (quota.get(share.bucket) < share.size) {
      quota.set(share.bucket, quota.get(share.bucket) + 1);
      remaining -= 1;
    }
  }
  return [...national, ...strata.flatMap((stratum) => spread(stratum.docs, quota.get(stratum.bucket)))];
}

async function crossCheckSupabase(sourcesByCountry) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "Supabase cross-check skipped: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.";
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).schema("analytics");
  const { data, error } = await supabase
    .from("plan_document_sources")
    .select("country_code, plan_level, province, link, is_active")
    .eq("is_active", true);
  if (error) return `Supabase cross-check failed: ${error.message}`;

  const lines = ["Active `analytics.plan_document_sources` rows against this inventory's source list (by URL):", ""];
  for (const [countryCode, sources] of sourcesByCountry) {
    const inventoryLinks = new Set(sources.map((source) => source.link));
    const dbRows = data.filter((row) => row.country_code === countryCode);
    const dbLinks = new Set(dbRows.map((row) => row.link));
    const onlyInDb = [...dbLinks].filter((link) => !inventoryLinks.has(link));
    const onlyHere = [...inventoryLinks].filter((link) => !dbLinks.has(link));
    lines.push(
      `- ${countryCode}: ${dbRows.length} active rows in Supabase, ${dbLinks.size} unique URLs; ${onlyInDb.length} URLs only in Supabase, ${onlyHere.length} URLs only in the workbook or hard-coded list.`,
    );
    for (const link of onlyInDb.slice(0, 20)) lines.push(`  - only in Supabase: ${link}`);
    for (const link of onlyHere.slice(0, 20)) lines.push(`  - only here: ${link}`);
  }
  return lines.join("\n");
}

function summaryMarkdown(stamp, options, sourceRows, records, sourcesByCountry, crossCheck, handCheck) {
  const lines = [
    `# Plan document inventory, ${stamp}`,
    "",
    `Run with a ${options.timeoutMs} ms fetch timeout, ${options.concurrency} requests at once, redirects followed, user agent \`${USER_AGENT}\`.`,
    `Relaxed TLS is used only where the app allows it (\`canUseRelaxedTlsForPlanDocumentUrl\` in \`src/lib/ai/plan-document-fetch.ts\`: gov.zm hosts).`,
    `A URL counts as a PDF when the body carries a \`%PDF-\` header, whatever the URL or content type says.`,
    `A page has a usable text layer when its extracted text has at least ${MIN_PAGE_TEXT_CHARS} non-whitespace characters.`,
    `A PDF is "text" when at least ${Math.round(TEXT_SHARE_FOR_TEXT * 100)} percent of its pages have one, "scanned" when at most ${Math.round(TEXT_SHARE_FOR_SCANNED * 100)} percent do, and "mixed" in between.`,
    `Language is a guess from the script mix and a stopword count; "latin-unreadable?" marks Nepal text that is Latin-only without English stopwords, the signature of a legacy Nepali font encoding.`,
    `Counts below are per unique URL; the row count says how many workbook or national rows point at those URLs.`,
    "",
  ];

  for (const [countryCode, sources] of sourcesByCountry) {
    const urls = [...new Set(sources.map((source) => source.link))];
    const docs = urls.map((url) => records.get(url)).filter(Boolean);
    const buckets = new Map(countBy(docs, bucketOf));
    const fetched = docs.filter((doc) => doc.http_status >= 200 && doc.http_status < 300).length;
    const pdfs = docs.filter((doc) => doc.status === "pdf");
    const nonPdfOther = docs.filter((doc) => doc.status === "pdf_expected_got_other").length;
    const failed = docs.filter((doc) => doc.status === "failed");
    const pagesTotal = pdfs.reduce((sum, doc) => sum + Number(doc.pages || 0), 0);
    const textPagesTotal = pdfs.reduce((sum, doc) => sum + Number(doc.text_pages || 0), 0);

    lines.push(`## ${countryCode}`, "");
    lines.push(`| Measure | Count |`, `| --- | --- |`);
    lines.push(`| Source rows | ${sources.length} |`);
    lines.push(`| Unique URLs | ${urls.length} |`);
    lines.push(`| Fetched (HTTP 2xx) | ${fetched} |`);
    lines.push(`| PDF | ${pdfs.length} |`);
    lines.push(`| PDF, mostly text layer | ${buckets.get("text") ?? 0} |`);
    lines.push(`| PDF, mixed | ${buckets.get("mixed") ?? 0} |`);
    lines.push(`| PDF, scanned (little or no text) | ${buckets.get("scanned") ?? 0} |`);
    lines.push(`| Non-PDF (web page or other) | ${buckets.get("non_pdf") ?? 0} |`);
    lines.push(`| .pdf URL that returned something else | ${nonPdfOther} |`);
    lines.push(`| Failed (HTTP error, timeout, TLS, DNS, parse) | ${failed.length} |`);
    lines.push(`| PDF pages, total | ${pagesTotal} |`);
    lines.push(`| PDF pages with a text layer | ${textPagesTotal} |`);
    lines.push("");
    lines.push(`Language guesses (unique URLs with text): ${countBy(docs.filter((doc) => doc.language_guess), (doc) => doc.language_guess).map(([key, count]) => `${key} ${count}`).join(", ") || "none"}`);
    lines.push("");
    const errorClasses = countBy(
      docs.filter((doc) => doc.status === "failed" || doc.status === "pdf_expected_got_other"),
      (doc) => doc.error_class || doc.status,
    );
    if (errorClasses.length > 0) {
      lines.push(`Failures by class: ${errorClasses.map(([key, count]) => `${key} ${count}`).join(", ")}`, "");
      lines.push(`| Unit | Error | URL |`, `| --- | --- | --- |`);
      for (const doc of [...failed, ...docs.filter((doc) => doc.status === "pdf_expected_got_other")]) {
        const units = sourceRows.filter((row) => row.link === doc.url).map((row) => row.province ?? "national");
        const detail = doc.error_message || doc.html_title || doc.content_type;
        lines.push(`| ${units.join("; ")} | ${doc.error_class || doc.status}: ${detail.replace(/\|/g, "/")} | ${doc.url} |`);
      }
      lines.push("");
    }
  }

  lines.push("## Supabase cross-check", "", crossCheck, "");
  lines.push("## Hand-check picks", "");
  for (const [countryCode, picks] of handCheck) {
    lines.push(`- ${countryCode}: ${picks.length} documents (${countBy(picks, (doc) => doc.bucket).map(([key, count]) => `${key} ${count}`).join(", ")})`);
  }
  lines.push("", "## Known limits", "");
  lines.push(`- A PDF whose text layer is present but garbled (wrong font encoding) counts as text here; the quote test in the hand check is the measurement for that.`);
  lines.push(`- A 200 response that is itself a PDF error page counts as a fetched PDF.`);
  lines.push(`- The fetch timeout covers the whole download; a slow but valid document shows as \`timeout\` and can be retried with \`--timeout-ms\` and \`--resume\` (delete its line from the JSONL first).`);
  lines.push(`- Node's fetch caps the TLS connect at 10 s on its own; a URL that hits that is retried once over node:http with the full timeout (\`fetch_path\` says which path answered).`);
  lines.push(`- A failure is what this network saw at run time. A host that refuses connections today may answer later or from another region, so rerun before treating a timeout as a dead link.`);
  lines.push(`- PDF parsing runs in-process, so \`parse_timeout\` reports a slow parse after the fact rather than interrupting it.`);
  lines.push(`- The language guess uses ${ENGLISH_STOPWORDS.size} English and ${SERBIAN_LATIN_STOPWORDS.size} Serbian Latin stopwords; it does not separate Serbian from Bosnian or Croatian, or Nepali from Hindi.`);
  return `${lines.join("\n")}\n`;
}

await loadLocalEnv();
const stamp = getArgValue("--date", todayStamp());
const options = {
  timeoutMs: Number(getArgValue("--timeout-ms", "30000")),
  concurrency: Number(getArgValue("--concurrency", "4")),
  textDir: path.join(OUTPUT_DIR, `plan-text-${stamp}`),
};
const countryFilter = getArgValue("--country", null)?.toUpperCase() ?? null;
const resume = hasFlag("--resume");

await mkdir(OUTPUT_DIR, { recursive: true });
const jsonlPath = path.join(OUTPUT_DIR, `plan-inventory-${stamp}.jsonl`);
const csvPath = path.join(OUTPUT_DIR, `plan-inventory-${stamp}.csv`);
const mdPath = path.join(OUTPUT_DIR, `plan-inventory-${stamp}.md`);
const handCheckPath = path.join(OUTPUT_DIR, `hand-check-${stamp}.csv`);

// Source rows: workbook rows plus the hard-coded national plans, exactly as the ingest would upsert them.
const workbook = readPlanSourceWorkbook(WORKBOOK_PATH);
const sourceRows = [];
for (const config of getCountryConfigs("all")) {
  if (countryFilter && config.code !== countryFilter) continue;
  const { planDocumentSources } = buildCountryPlanSourcePayloads(config, workbook);
  sourceRows.push(...planDocumentSources);
  if (config.code === "NPL") sourceRows.push(NEPAL_NATIONAL_PLAN);
}
const sourcesByCountry = new Map();
for (const row of sourceRows) {
  sourcesByCountry.set(row.country_code, [...(sourcesByCountry.get(row.country_code) ?? []), row]);
}

// One fetch per unique URL. The first row that names a URL supplies the country and unit for the text file.
const firstRowByUrl = new Map();
for (const row of sourceRows) if (!firstRowByUrl.has(row.link)) firstRowByUrl.set(row.link, row);
const records = resume ? await loadResumeRecords(jsonlPath) : new Map();
if (!resume) await writeFile(jsonlPath, "");
const pending = [...firstRowByUrl.keys()].filter((url) => !records.has(url));
console.log(
  `${sourceRows.length} source rows, ${firstRowByUrl.size} unique URLs, ${pending.length} to fetch` +
    (resume ? ` (${records.size} loaded from ${jsonlPath})` : ""),
);

let done = 0;
await runPool(pending, options.concurrency, async (url) => {
  const source = firstRowByUrl.get(url);
  const record = await inventoryUrl(url, source, options);
  records.set(url, record);
  await appendFile(jsonlPath, `${JSON.stringify(record)}\n`);
  done += 1;
  const detail =
    record.status === "pdf"
      ? `${record.text_class}, ${record.text_pages}/${record.pages} text pages, ${record.language_guess}`
      : record.status === "failed"
        ? `${record.error_class}: ${record.error_message}`
        : `${record.status}, ${record.content_type}`;
  console.log(`[${done}/${pending.length}] ${source.country_code} ${source.province ?? "national"}: ${detail}`);
});

// Inventory CSV: one row per source row, joined to its URL's result.
const rowsPerUrl = new Map(countBy(sourceRows, (row) => row.link));
const inventoryColumns = [
  "country",
  "plan_level",
  "unit",
  "title",
  "priority",
  "notes",
  "url",
  "rows_sharing_url",
  "status",
  "bucket",
  "http_status",
  "final_url",
  "content_type",
  "bytes",
  "fetch_path",
  "url_says_pdf",
  "content_type_says_pdf",
  "is_pdf",
  "html_title",
  "pages",
  "text_pages",
  "text_chars",
  "text_class",
  "letters",
  "devanagari_share",
  "cyrillic_share",
  "latin_share",
  "language_guess",
  "sample_page",
  "sample_text",
  "text_file",
  "error_class",
  "error_message",
  "fetch_ms",
  "parse_ms",
];
const inventoryRows = sourceRows.map((row) => {
  const record = records.get(row.link) ?? {};
  return {
    ...record,
    country: row.country_code,
    plan_level: row.plan_level,
    unit: row.province ?? "national",
    title: row.title,
    priority: row.priority,
    notes: row.notes ?? "",
    url: row.link,
    rows_sharing_url: rowsPerUrl.get(row.link) ?? 1,
    bucket: record.status ? bucketOf(record) : "",
  };
});
await writeFile(csvPath, toCsv(inventoryColumns, inventoryRows));

// Hand-check sheet: Nepal takes every document; Serbia and Zambia take the national plan plus nine
// local plans spread across the text, mixed, scanned, non-PDF, and failed buckets.
const handCheck = new Map();
for (const [countryCode, sources] of sourcesByCountry) {
  const docs = [];
  const seen = new Set();
  for (const row of sources) {
    if (seen.has(row.link)) continue;
    seen.add(row.link);
    const record = records.get(row.link);
    if (!record) continue;
    const units = sources.filter((other) => other.link === row.link).map((other) => other.province ?? "national");
    docs.push({ ...record, unit: units[0], units: units.join("; "), plan_level: row.plan_level, title: row.title, bucket: bucketOf(record) });
  }
  handCheck.set(countryCode, pickHandCheck(countryCode, docs));
}
const handCheckColumns = [
  "country",
  "unit",
  "plan_level",
  "title",
  "url",
  "final_url",
  "inventory_status",
  "http_status",
  "pages",
  "text_pages",
  "text_chars",
  "language_guess",
  "devanagari_share",
  "cyrillic_share",
  "latin_share",
  "text_file",
  "sample_page",
  "sample_text",
  "text_correct",
  "needs_ocr",
  "language",
  "quote_test",
  "notes",
];
const handCheckRows = [...handCheck.entries()].flatMap(([countryCode, picks]) =>
  picks.map((doc) => ({
    ...doc,
    country: countryCode,
    unit: doc.units,
    inventory_status: doc.status === "pdf" ? `pdf/${doc.text_class}` : doc.status === "failed" ? `failed/${doc.error_class}` : doc.status,
    text_correct: "",
    needs_ocr: "",
    language: "",
    quote_test: "",
    notes: "",
  })),
);
await writeFile(handCheckPath, toCsv(handCheckColumns, handCheckRows));

const crossCheck = await crossCheckSupabase(sourcesByCountry);
const markdown = summaryMarkdown(stamp, options, sourceRows, records, sourcesByCountry, crossCheck, handCheck);
await writeFile(mdPath, markdown);

console.log(`\nWrote ${inventoryRows.length} rows to ${csvPath}`);
console.log(`Wrote ${handCheckRows.length} hand-check rows to ${handCheckPath}`);
console.log(`Wrote summary to ${mdPath}`);
console.log(`\n${markdown}`);
