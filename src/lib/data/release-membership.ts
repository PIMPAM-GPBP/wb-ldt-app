export type ReleaseMunicipality = {
  year: number;
  compositeKey: string;
};

export type ReleaseMunicipalityMembership<T extends ReleaseMunicipality = ReleaseMunicipality> = {
  keys: ReadonlySet<string> | null;
  byCompositeKey: ReadonlyMap<string, T>;
};

export function buildReleaseMunicipalityMembership<T extends ReleaseMunicipality>(
  municipalities: readonly T[],
  year: number,
): ReleaseMunicipalityMembership<T> {
  const rowsForYear = municipalities.filter((municipality) => municipality.year === year);

  if (rowsForYear.length === 0) {
    return {
      keys: null,
      byCompositeKey: new Map(),
    };
  }

  return {
    keys: new Set(rowsForYear.map((municipality) => municipality.compositeKey)),
    byCompositeKey: new Map(
      rowsForYear.map((municipality) => [municipality.compositeKey, municipality]),
    ),
  };
}

export function filterMunicipalitiesByReleaseMembership<
  T extends { composite_key: string },
>(rows: readonly T[], membership: ReleaseMunicipalityMembership) {
  if (!membership.keys) {
    return [...rows];
  }

  return rows.filter((row) => membership.keys?.has(row.composite_key));
}
