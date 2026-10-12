import { CircleHelp, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AdminLabels } from "@/lib/countries";

type AnalyticsFiltersProps = {
  years: number[];
  provinces: string[];
  municipalities: Array<{
    id: string;
    label: string;
  }>;
  selected: {
    year: number;
    province: string;
    municipalityId: string;
    metricId: string;
    xMetricId: string;
    yMetricId: string;
    aiScoreId: string;
  };
  selectedTab: string;
  adminLabels: AdminLabels;
  mode?: "top" | "sidebar";
};

function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function SelectField({
  label,
  name,
  options,
  defaultValue,
  help,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue: string;
  help?: string;
}) {
  return (
    <label className="flex min-w-0 w-full flex-col gap-2">
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>{label}</span>
        {help ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`${label} help`}
                  className="rounded-full text-muted-foreground"
                />
              }
            >
              <CircleHelp data-icon="inline-start" />
            </TooltipTrigger>
            <TooltipContent side="top" align="start">
              {help}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AnalyticsFilters({
  years,
  provinces,
  municipalities,
  selected,
  selectedTab,
  adminLabels,
  mode = "top",
}: AnalyticsFiltersProps) {
  const isSidebar = mode === "sidebar";
  const selectedMunicipalityLabel =
    municipalities.find((municipality) => municipality.id === selected.municipalityId)
      ?.label ?? selected.municipalityId;
  const lowerSingular = adminLabels.lower.singular;
  const higherSingular = adminLabels.higher.singular;
  const higherPlural = adminLabels.higher.plural;

  return (
    <TooltipProvider>
      <Card
        size="sm"
        className={`border-[var(--border-soft)] bg-[var(--surface-strong)] shadow-[0_18px_50px_rgba(2,20,32,0.08)] ${isSidebar ? "" : "mt-8"}`}
      >
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Shared context for all analytics workflows.</CardDescription>
          <CardAction>
            <Badge variant="outline" className="max-w-40 rounded-lg px-2.5">
              <span className="truncate">Selected: {selectedMunicipalityLabel}</span>
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <form
            key={`${selected.year}:${selected.province}:${selected.municipalityId}`}
            className={`grid gap-4 ${isSidebar ? "" : "xl:grid-cols-[repeat(3,minmax(0,1fr))_auto]"}`}
          >
            <input type="hidden" name="tab" value={selectedTab} />
            <input type="hidden" name="metric" value={selected.metricId} />
            <input type="hidden" name="x" value={selected.xMetricId} />
            <input type="hidden" name="y" value={selected.yMetricId} />
            <input type="hidden" name="ai_score" value={selected.aiScoreId} />
            <SelectField
              label="Year"
              name="year"
              help={`Data release year used for the ${lowerFirst(lowerSingular)} scores and indicators.`}
              defaultValue={String(selected.year)}
              options={years.map((year) => ({
                value: String(year),
                label: String(year),
              }))}
            />
            <SelectField
              label={higherSingular}
              name="province"
              help={`Limits peer comparisons and maps to one ${lowerFirst(higherSingular)}, or keeps the national view.`}
              defaultValue={selected.province}
              options={provinces.map((province) => ({
                value: province,
                label: province === "all" ? `All ${lowerFirst(higherPlural)}` : province,
              }))}
            />
            <SelectField
              label={lowerSingular}
              name="municipality"
              help={`The highlighted ${lowerFirst(lowerSingular)} used in charts, maps, summaries, and AI planning context.`}
              defaultValue={selected.municipalityId}
              options={municipalities.map((municipality) => ({
                value: municipality.id,
                label: municipality.label,
              }))}
            />
            <Button type="submit" className={isSidebar ? "w-full" : "self-end"}>
              <SlidersHorizontal data-icon="inline-start" />
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
