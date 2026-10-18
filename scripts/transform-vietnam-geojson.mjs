import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ANALYTICS_PATH = path.join(ROOT_DIR, "src", "generated", "vietnam", "analytics-data.json");
const RAW_GEOJSON_PATH = path.join(ROOT_DIR, "public", "data", "vietnam", "municipalities.raw-source.geojson");
const OUTPUT_GEOJSON_PATH = path.join(ROOT_DIR, "public", "data", "vietnam", "municipalities.geojson");

const analyticsRaw = await fs.readFile(ANALYTICS_PATH, "utf8");
const analytics = JSON.parse(analyticsRaw);
const allowedKeys = new Set(analytics.mapFeatureKeys);

const geojsonRaw = await fs.readFile(RAW_GEOJSON_PATH, "utf8");
const geojson = JSON.parse(geojsonRaw);

let matched = 0;
let skipped = 0;

const features = [];
for (const feature of geojson.features) {
  const province = feature.properties.NAM_1;
  const municipality = feature.properties.NAM_2;
  const compositeKey = `${province}::${province}::${municipality}`;

  if (!allowedKeys.has(compositeKey)) {
    skipped += 1;
    continue;
  }

  matched += 1;
  features.push({
    type: "Feature",
    properties: {
      Municipality: municipality,
      District: province,
      Province: province,
      compositeKey,
    },
    geometry: feature.geometry,
  });
}

const output = {
  type: "FeatureCollection",
  features,
};

await fs.writeFile(OUTPUT_GEOJSON_PATH, `${JSON.stringify(output)}\n`, "utf8");

console.log(
  `Matched ${matched} of ${geojson.features.length} boundary features (${skipped} skipped, no analytics match).`,
);
