import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = path.join(ROOT_DIR, "src", "generated", "vietnam", "analytics-data.json");

function yearFilePath(year) {
  return path.join(ROOT_DIR, "src", "generated", "vietnam", `analytics-data-${year}.json`);
}

const raw = await fs.readFile(SOURCE_PATH, "utf8");
const dataset = JSON.parse(raw);
const { municipalities, ...metadata } = dataset;

const municipalitiesByYear = new Map();
for (const municipality of municipalities) {
  const existing = municipalitiesByYear.get(municipality.year) ?? [];
  existing.push(municipality);
  municipalitiesByYear.set(municipality.year, existing);
}

for (const year of metadata.years) {
  const rows = municipalitiesByYear.get(year) ?? [];
  await fs.writeFile(
    yearFilePath(year),
    `${JSON.stringify({ municipalities: rows })}\n`,
    "utf8",
  );
  console.log(`Wrote ${rows.length} municipality rows to analytics-data-${year}.json`);
}

await fs.writeFile(SOURCE_PATH, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
console.log(
  `Rewrote analytics-data.json as metadata-only (dropped the ${municipalities.length}-row municipalities array).`,
);
