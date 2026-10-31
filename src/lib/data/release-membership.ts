export type ReleaseMunicipality = {
  year: number;
  compositeKey: string;
};

export type ReleaseMunicipalityMembership<T extends ReleaseMunicipality = ReleaseMunicipality> = {
  keys: ReadonlySet<string> | null;
  byCompositeKey: ReadonlyMap<string, T>;
};

export type ReleaseMembershipIdentity = {
  selectedReleaseKey: string;
  bundledReleaseKey: string;
};

function getReleaseFamily(releaseKey: string) {
  const match = releaseKey.match(/^(.*)-\d{4}-(v[^-]+)$/);
  return match ? `${match[1]}-${match[2]}` : null;
}

function matchesBundledReleaseIdentity({
  selectedReleaseKey,
  bundledReleaseKey,
}: ReleaseMembershipIdentity) {
  if (selectedReleaseKey === bundledReleaseKey) {
    return true;
  }

  const selectedFamily = getReleaseFamily(selectedReleaseKey);
  const bundledFamily = getReleaseFamily(bundledReleaseKey);

  return selectedFamily !== null && selectedFamily === bundledFamily;
}

export function buildReleaseMunicipalityMembership<T extends ReleaseMunicipality>(
  municipalities: readonly T[],
  year: number,
  identity: ReleaseMembershipIdentity,
): ReleaseMunicipalityMembership<T> {
  const rowsForYear = municipalities.filter((municipality) => municipality.year === year);

  if (rowsForYear.length === 0) {
    return {
      keys: null,
      byCompositeKey: new Map(),
    };
  }

  return {
    keys: matchesBundledReleaseIdentity(identity)
      ? new Set(rowsForYear.map((municipality) => municipality.compositeKey))
      : null,
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
