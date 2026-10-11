import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const nextOutputDir = path.resolve(projectRoot, process.argv[2] ?? ".next");
const analyticsFiles = [
  "src/generated/analytics-data.json",
  "src/generated/zambia/analytics-data.json",
  "src/generated/serbia/analytics-data.json",
];
const routes = [
  "sng-metrics",
  "plan-availability",
];

const failures = [];

for (const relativeFile of analyticsFiles) {
  const absoluteFile = path.resolve(projectRoot, relativeFile);
  if (!existsSync(absoluteFile) || !statSync(absoluteFile).isFile()) {
    failures.push(`Missing source data file: ${relativeFile}`);
  }
}

for (const route of routes) {
  const manifestPath = path.join(
    nextOutputDir,
    "server",
    "app",
    "api",
    "countries",
    "[country]",
    route,
    "route.js.nft.json",
  );

  if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) {
    failures.push(`Missing Next NFT manifest: ${path.relative(projectRoot, manifestPath)}`);
    continue;
  }

  let tracedFiles;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (!Array.isArray(manifest.files) || !manifest.files.every((file) => typeof file === "string")) {
      failures.push(`Invalid Next NFT manifest files list: ${path.relative(projectRoot, manifestPath)}`);
      continue;
    }
    tracedFiles = new Set(
      manifest.files.map((file) => path.resolve(path.dirname(manifestPath), file)),
    );
  } catch (error) {
    failures.push(
      `Cannot read Next NFT manifest ${path.relative(projectRoot, manifestPath)}: ${error.message}`,
    );
    continue;
  }

  const missingFiles = analyticsFiles.filter(
    (file) => !tracedFiles.has(path.resolve(projectRoot, file)),
  );
  if (missingFiles.length > 0) {
    failures.push(`${route}: missing traced data files: ${missingFiles.join(", ")}`);
    continue;
  }

  console.log(`PASS ${route}: all ${analyticsFiles.length} country analytics files are traced`);
}

if (failures.length > 0) {
  console.error("FAIL country API output tracing:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`PASS both country API routes trace all ${analyticsFiles.length} country analytics files`);
}
