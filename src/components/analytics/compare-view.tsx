"use client";

import { useMemo } from "react";

import { PillarBeeswarm } from "@/components/analytics/pillar-beeswarm";
import { Scatter2DCard } from "@/components/analytics/scatter-2d";
import { Scatter3DLoader } from "@/components/analytics/scatter-3d-loader";
import { useSearchParamUpdater } from "@/components/analytics/use-search-param-updater";
import { Section } from "@/components/ui/section";
import { getPillarStandings } from "@/lib/analytics/derive";
import type { Country } from "@/lib/countries";
import type { AnalyticsPageData } from "@/types/analytics";

export type CompareViewProps = {
  data: AnalyticsPageData;
  country: Country;
};

export function CompareView({ data, country }: CompareViewProps) {
  const { update, isPending } = useSearchParamUpdater();
  const standings = useMemo(() => getPillarStandings(data), [data]);
  const lowerSingular = country.adminLabels.lower.singular.toLowerCase();
  const province = data.municipality.province;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12">
      <Section
        title="Scores by pillar"
        description={`One dot per ${lowerSingular}. Click a dot to select it.`}
        aria-busy={isPending}
      >
        <PillarBeeswarm
          standings={standings}
          municipalityName={data.municipality.municipality}
          province={province}
          adminLabels={country.adminLabels}
          onSelect={(municipalityId) => update({ municipality: municipalityId })}
        />
      </Section>

      <Section
        title="Two scores compared"
        description={`Dots in ${province} stand out.`}
      >
        <Scatter2DCard
          xMetric={data.scatter2d.xMetric}
          yMetric={data.scatter2d.yMetric}
          scoreMetrics={data.filters.scoreMetrics}
          selectedProvince={province}
          adminLabels={country.adminLabels}
          points={data.scatter2d.points}
        />
      </Section>

      <Section title="All three pillars" description="All three scores at once. Drag to rotate.">
        <Scatter3DLoader selectedProvince={province} adminLabels={country.adminLabels} points={data.scatter3d.points} />
      </Section>
    </div>
  );
}
