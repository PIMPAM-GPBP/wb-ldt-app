import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

const csvPath = process.argv[2];

if (!csvPath) {
  throw new Error("Usage: node scripts/validate-comparison-csv.mjs <downloaded.csv>");
}

const records = parse(await readFile(csvPath, "utf8"), {
  bom: true,
  relax_column_count: true,
});
const [headers, ...rows] = records;

assert.ok(headers, "CSV must contain a header row");

const duplicateHeaders = headers.filter(
  (header, index) => headers.indexOf(header) !== index,
);

assert.deepEqual(
  [...new Set(duplicateHeaders)],
  [],
  `CSV headers must be unique: ${[...new Set(duplicateHeaders)].join(", ")}`,
);

for (const [index, row] of rows.entries()) {
  assert.equal(
    row.length,
    headers.length,
    `CSV row ${index + 2} has ${row.length} columns; expected ${headers.length}`,
  );
}

console.log(
  JSON.stringify(
    {
      file: csvPath,
      rows: rows.length,
      columns: headers.length,
      uniqueHeaders: true,
      consistentColumns: true,
    },
    null,
    2,
  ),
);
