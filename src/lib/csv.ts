export type CsvCell = string | number | boolean | null | undefined;

export type ComparisonCsvPoint = {
  id: string;
  label: string;
  district: string;
  province: string;
  x: number | null;
  y: number | null;
  selected: boolean;
};

export function escapeCsvValue(value: CsvCell) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  if (!/[",\n\r]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replaceAll('"', '""')}"`;
}

export function buildCsv(headers: string[], rows: CsvCell[][]) {
  return [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\n");
}

export function buildComparisonCsv({
  lowerLabel,
  middleLabel,
  higherLabel,
  xLabel,
  yLabel,
  points,
}: {
  lowerLabel: string;
  middleLabel: string | null;
  higherLabel: string;
  xLabel: string;
  yLabel: string;
  points: ComparisonCsvPoint[];
}) {
  const axisLabels =
    xLabel === yLabel ? [`X: ${xLabel}`, `Y: ${yLabel}`] : [xLabel, yLabel];
  const headers = [
    "id",
    lowerLabel,
    ...(middleLabel ? [middleLabel] : []),
    higherLabel,
    ...axisLabels,
    "selected",
  ];

  return buildCsv(
    headers,
    points.map((point) => [
      point.id,
      point.label,
      ...(middleLabel ? [point.district] : []),
      point.province,
      point.x,
      point.y,
      point.selected,
    ]),
  );
}

export function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
