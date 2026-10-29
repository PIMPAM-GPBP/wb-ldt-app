import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { AnalyticsDataset, MunicipalityRecord } from "@/types/analytics";

type SplitAnalyticsMetadata = Omit<AnalyticsDataset, "municipalities"> & {
  municipalities?: MunicipalityRecord[];
};

async function readJson<T>(filePath: string) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

// Datasets too large for one file (Vietnam) are split by scripts/split-vietnam-analytics-data.mjs
// into a metadata-only `<name>.json` plus one `<name>-<year>.json` per year. Single-file datasets
// keep `municipalities` inline and are returned as-is.
export async function loadLocalAnalyticsDataset(relativePath: string): Promise<AnalyticsDataset> {
  const filePath = path.join(process.cwd(), relativePath);
  const dataset = await readJson<SplitAnalyticsMetadata>(filePath);

  if (dataset.municipalities) {
    return dataset as AnalyticsDataset;
  }

  const yearFiles = await Promise.all(
    dataset.years.map((year) =>
      readJson<{ municipalities: MunicipalityRecord[] }>(
        filePath.replace(/\.json$/, `-${year}.json`),
      ),
    ),
  );

  return {
    ...dataset,
    municipalities: yearFiles.flatMap((yearFile) => yearFile.municipalities),
  };
}
