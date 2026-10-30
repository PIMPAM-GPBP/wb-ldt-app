import "server-only";

import { stat } from "node:fs/promises";
import path from "node:path";

import { loadCountryDataset } from "@/lib/country-landing-data";
import type { Country } from "@/lib/countries";
import { countries } from "@/lib/countries";
import { buildCsv } from "@/lib/csv";
import { formatYears, getIndicatorTable } from "@/lib/indicators";

/** Every unit's pillar and component scores for every year in the edition, one row per unit and year. */
export async function buildScoresCsv(country: Country) {
  const dataset = await loadCountryDataset(country);
  const definitions = [...dataset.scoreDefinitions].sort((a, b) => a.sortOrder - b.sortOrder);
  const components = definitions.flatMap((definition) => definition.componentIds.map((id, index) => ({ id, label: definition.componentLabels[index] ?? id })));
  // Zambia's and Serbia's district field repeats the province, so it gets a column only where it adds a level.
  const hasDistricts = dataset.municipalities.some((unit) => unit.district !== unit.province);
  const headers = [
    country.adminLabels.higher.singular,
    ...(hasDistricts ? ["District"] : []),
    country.adminLabels.lower.singular,
    "Year",
    ...definitions.map((definition) => definition.label),
    ...components.map((component) => component.label),
  ];
  const rows = [...dataset.municipalities]
    .sort((a, b) => a.province.localeCompare(b.province) || a.municipality.localeCompare(b.municipality) || a.year - b.year)
    .map((unit) => [
      unit.province,
      ...(hasDistricts ? [unit.district] : []),
      unit.municipality,
      unit.year,
      ...definitions.map((definition) => unit.scores[definition.id] ?? null),
      ...components.map((component) => unit.scoreComponents[component.id] ?? null),
    ]);
  return {
    csv: `${buildCsv(headers, rows)}\n`,
    fileName: `${country.slug}-ldt-scores-${dataset.release.key}.csv`,
    rows: rows.length,
    edition: dataset.release.key,
    years: [...dataset.years].sort((a, b) => a - b),
    generatedAt: dataset.generatedAt,
  };
}

/** The indicator list behind the Methodology table. */
export async function buildIndicatorsCsv() {
  const rows = await getIndicatorTable();
  const csv = buildCsv(
    ["Indicator id", "Indicator", "Unit", "Pillar", "Component", "What it measures", "Higher is better", "Recorded", "Sources", "Source links"],
    rows.map((row) => [
      row.id,
      row.name,
      row.unit,
      row.pillar,
      row.component,
      row.description,
      row.higherIsBetter === null ? "" : row.higherIsBetter ? "yes" : "no",
      formatYears(row.years),
      row.sources.map((source) => source.label).join("; "),
      row.sources.map((source) => source.url ?? "").filter(Boolean).join(" "),
    ]),
  );
  return { csv: `${csv}\n`, fileName: "ldt-indicators.csv", rows: rows.length };
}

export type Download = { href: string; fileName: string; format: string; bytes: number; rows?: number };

/** Every file the data page offers, with its real size, for the editions this build serves. */
export async function getDownloads() {
  const live = countries.filter((country) => country.analyticsStatus === "live").sort((a, b) => a.name.localeCompare(b.name));
  const perCountry = await Promise.all(
    live.map(async (country) => {
      const scores = await buildScoresCsv(country);
      const boundaries = await stat(path.join(process.cwd(), country.mapDataPath));
      return {
        country,
        edition: scores.edition,
        years: scores.years,
        generatedAt: scores.generatedAt,
        scores: { href: `/api/countries/${country.slug}/scores`, fileName: scores.fileName, format: "CSV", bytes: Buffer.byteLength(scores.csv), rows: scores.rows } satisfies Download,
        boundaries: {
          href: `/${country.mapDataPath.replace(/^public\//, "")}`,
          fileName: path.basename(country.mapDataPath),
          format: "GeoJSON",
          bytes: boundaries.size,
        } satisfies Download,
      };
    }),
  );
  const indicators = await buildIndicatorsCsv();
  return {
    countries: perCountry,
    indicators: { href: "/api/indicators", fileName: indicators.fileName, format: "CSV", bytes: Buffer.byteLength(indicators.csv), rows: indicators.rows } satisfies Download,
  };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  // Switch to MB a little early, so a file never reads as "1014 KB".
  if (bytes < 1000 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
