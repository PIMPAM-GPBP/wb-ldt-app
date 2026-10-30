import type { CountryHomeGroup } from "@/lib/country-home";
import {
  buildPlanAvailabilityGroups,
  buildPlanSourceMap,
  type LocalPlanSource,
} from "@/lib/country-landing-data";
import type { Country } from "@/lib/countries";
import type { ReleaseMetadata } from "@/lib/release-metadata";

export type CountryTrustStatus = "ready" | "partial" | "blocked";

export type CountryTrustItem = {
  label: string;
  value: string;
  status: CountryTrustStatus;
  detail: string;
};

export type CountryTrustModel = {
  countryName: string;
  releaseKey: string;
  methodologyVersion: string;
  items: CountryTrustItem[];
  caveats: string[];
};

function percentLabel(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return "0%";
  }

  return `${Math.round((numerator / denominator) * 100)}%`;
}

function boundaryStatus(metadata: ReleaseMetadata): CountryTrustStatus {
  if (metadata.analyticsOnlyCount === 0 && metadata.boundaryOnlyCount === 0) {
    return "ready";
  }

  return metadata.mapMunicipalityCount > 0 ? "partial" : "blocked";
}

function planStatus(sourceCount: number, unitCount: number): CountryTrustStatus {
  if (unitCount === 0 || sourceCount === 0) {
    return "blocked";
  }

  return sourceCount === unitCount ? "ready" : "partial";
}

export function buildCountryTrustModel({
  country,
  releaseMetadata,
  groups,
  planSources,
}: {
  country: Country;
  releaseMetadata: ReleaseMetadata;
  groups: CountryHomeGroup[];
  planSources: LocalPlanSource[];
}): CountryTrustModel {
  const planSourceMap = buildPlanSourceMap(planSources);
  const planGroups = buildPlanAvailabilityGroups(country, groups, planSourceMap);
  const unitCount =
    country.planningDocuments.planSourceAdminLevel === "higher"
      ? planGroups.length
      : planGroups.reduce((sum, group) => sum + group.lowerUnitCount, 0);
  const sourceCount =
    country.planningDocuments.planSourceAdminLevel === "higher"
      ? planGroups.filter((group) => group.hasPlanSource).length
      : planGroups.reduce((sum, group) => sum + group.sourceCount, 0);
  const readiness = planStatus(sourceCount, unitCount);
  const boundaryQuality = boundaryStatus(releaseMetadata);

  return {
    countryName: country.name,
    releaseKey: releaseMetadata.releaseKey,
    methodologyVersion: releaseMetadata.methodologyVersion,
    items: [
      {
        label: "Data coverage",
        value: `${releaseMetadata.analyticsMunicipalityCount.toLocaleString("en-US")} ${country.adminLabels.lower.plural.toLowerCase()}`,
        status: "ready",
        detail: `${releaseMetadata.latestDataYear} release ${releaseMetadata.releaseKey}`,
      },
      {
        label: "Boundary quality",
        value:
          boundaryQuality === "ready"
            ? "Matched"
            : `${releaseMetadata.analyticsOnlyCount + releaseMetadata.boundaryOnlyCount} gaps`,
        status: boundaryQuality,
        detail: `${releaseMetadata.mapMunicipalityCount.toLocaleString("en-US")} mapped ${country.adminLabels.lower.plural.toLowerCase()}`,
      },
      {
        label: "Local plans",
        value: `${percentLabel(sourceCount, unitCount)} sourced`,
        status: readiness,
        detail: `${sourceCount} of ${unitCount} ${country.planningDocuments.planSourceAdminLevel === "higher" ? country.adminLabels.higher.plural.toLowerCase() : country.adminLabels.lower.plural.toLowerCase()} have plan sources`,
      },
    ],
    caveats: releaseMetadata.caveats,
  };
}
