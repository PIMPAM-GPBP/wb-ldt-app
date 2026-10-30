import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { AnalyticsDataset } from "@/types/analytics";

export async function loadLocalAnalyticsDataset(relativePath: string): Promise<AnalyticsDataset> {
  const raw = await readFile(path.join(process.cwd(), relativePath), "utf8");
  return JSON.parse(raw) as AnalyticsDataset;
}
