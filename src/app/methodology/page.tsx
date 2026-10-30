import Link from "next/link";

import { ARTICLE_LINK, ArticleFigure, ArticlePage, ArticleSection, NumberedSteps, PROSE, TermGrid } from "@/components/layout/article";
import { PILLARS } from "@/lib/analytics/derive";
import { formatYears, getIndicatorTable, type IndicatorRow } from "@/lib/indicators";

import pilDiagram from "../../../images/PIL Diagram v2.png";

const indicatorSelection = [
  "Relevance to local development outcomes that can inform public investment and planning dialogue.",
  "Availability at a subnational scale that can be harmonized across countries and administrative systems.",
  "Ability to convert raw measures into comparable 0-100 score series with transparent interpretation.",
  "Coverage across the Prosperity, Infrastructure, and Livability dimensions of the PIL framework.",
];

const pillars = [
  {
    title: "Prosperity",
    body:
      "Prosperity captures local economic activity, productive intensity, and development opportunity. In the current country releases, it draws heavily on nighttime luminosity, built-area development, tourism activity, and agriculture-related land signals where available.",
    items: [
      "Nighttime luminosity as a proxy for economic intensity and access to electricity-enabled activity.",
      "Population- and area-normalized measures so dense urban centers and smaller local units can be compared more fairly.",
      "Country-specific economic signals, such as tourism or agricultural land indicators, where they can be processed consistently.",
    ],
  },
  {
    title: "Infrastructure",
    body:
      "Infrastructure measures the availability and reach of systems that support local service delivery and connectivity. It combines digital access and service accessibility where those data are available.",
    items: [
      "Broadband and mobile internet performance.",
      "Accessibility to schools, health facilities, and key local services.",
      "Connectivity and access signals that help users compare service reach across local units.",
    ],
  },
  {
    title: "Livability",
    body:
      "Livability reflects environmental, climate-risk, and human-development conditions that shape daily life. The indicator set differs by country data availability, but it is designed to make environmental stress and quality-of-life signals visible at local scale.",
    items: [
      "Air quality and emissions indicators.",
      "Road and railway exposure to flood, heat, and other climate-related hazards.",
      "Land-cover, deforestation, or green-space signals where available.",
      "Human-development conditions that complement infrastructure and prosperity scores.",
    ],
  },
];

const dataSources = [
  {
    title: "Satellite and environmental data",
    items: [
      "VIIRS nighttime lights for luminosity-based economic activity measures.",
      "ERA5, OpenWeatherMaps, Climate Trace, and related climate or environmental datasets.",
      "Dynamic World and other land-cover products for built-area, vegetation, and land-use signals.",
    ],
  },
  {
    title: "Geospatial and infrastructure data",
    items: [
      "Administrative boundary files aligned to the relevant local-government tiers for each country.",
      "WorldPop and other gridded population sources for population aggregation and normalization.",
      "OpenStreetMap, Openrouteservice, WRI Aqueduct, and related spatial datasets for accessibility, transport, and risk measures.",
    ],
  },
  {
    title: "Official and planning sources",
    items: [
      "National development plans, local strategies, budgets, and other planning documents where source links are available.",
      "Official country data, partner data, and validated administrative references used to interpret local conditions.",
      "Indicator metadata that records source provenance and interpretation notes for user review.",
    ],
  },
];

const preprocessingSteps = [
  {
    title: "Boundary reconciliation",
    body:
      "Administrative names, identifiers, and geometries are harmonized so indicator tables, map boundaries, and planning-document records refer to the same local units.",
  },
  {
    title: "Spatial aggregation",
    body:
      "Raster, vector, network, and point datasets are aggregated to the relevant local-government level. Raster values are summarized within boundaries; point and network features are spatially joined or measured by coverage, access, or exposure.",
  },
  {
    title: "Normalization",
    body:
      "Indicators are normalized by population, area, or another appropriate denominator when raw totals would otherwise favor larger local units.",
  },
  {
    title: "Temporal alignment",
    body:
      "Input data are assigned to annual releases where possible. When countries have multi-year releases, the same local-unit keys are preserved so users can compare trends over time.",
  },
];

const scoringSteps = [
  "Raw indicator values are transformed into comparable score values on a 0-100 scale, where higher values represent stronger relative performance for that indicator unless explicitly documented otherwise.",
  "Component scores are grouped under Prosperity, Infrastructure, and Livability according to the PIL framework.",
  "Pillar scores use transparent equal-weight aggregation across available component scores unless a country-specific methodology states otherwise.",
  "Where a component has nothing recorded for a unit, the prepared score tables count a fixed value for it, so the pillar score still averages all of its components. The planning brief marks those components as not recorded and never compares them.",
  "Published score tables are treated as the authoritative score source for maps, scatterplots, driver charts, and country landing-page summaries.",
];

const limitations = [
  {
    title: "Data coverage",
    items: [
      "Not every indicator is available for every country, year, or local unit.",
      "Open geospatial sources can be incomplete or unevenly updated across territories.",
      "Planning-document coverage depends on whether source links are available and machine-readable.",
    ],
  },
  {
    title: "Spatial interpretation",
    items: [
      "Local-government averages can hide neighborhood-level variation.",
      "Boundary changes, naming differences, and language differences can affect matching quality.",
      "Maps and scores should be read as screening evidence, not as a substitute for project appraisal.",
    ],
  },
  {
    title: "Scoring interpretation",
    items: [
      "Equal weighting is transparent, but it may not reflect every sector priority or local policy preference.",
      "A high score does not automatically mean a local unit has no investment needs; it indicates relative standing within the release.",
      "Score results should be validated against local knowledge, sector diagnostics, and official planning processes.",
    ],
  },
];

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "framework", label: "PIL framework" },
  { id: "selection", label: "Indicator selection" },
  { id: "pillars", label: "The three pillars" },
  { id: "indicators", label: "Indicators" },
  { id: "sources", label: "Data acquisition" },
  { id: "preprocessing", label: "Preprocessing" },
  { id: "scores", label: "Score calculation" },
  { id: "years", label: "What changes between years" },
  { id: "limitations", label: "Limitations" },
  { id: "references", label: "References" },
  { id: "changes", label: "Changes to this page" },
];

function IndicatorTable({ rows }: { rows: IndicatorRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border-strong)] text-ink-muted">
            <th scope="col" className="w-[26%] py-2 pr-4 font-medium">Indicator</th>
            <th scope="col" className="py-2 pr-4 font-medium">What it measures</th>
            <th scope="col" className="w-[9%] py-2 pr-4 font-medium">Better</th>
            <th scope="col" className="w-[11%] py-2 pr-4 font-medium">Recorded</th>
            <th scope="col" className="w-[20%] py-2 font-medium">Sources</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[var(--border-soft)] align-top text-ink">
              <th scope="row" className="py-3 pr-4 font-medium">
                {row.name}
                {row.unit ? <span className="block text-xs font-normal text-ink-muted">{row.unit}</span> : null}
                <span className="block text-xs font-normal text-ink-muted">{row.component ? `Feeds the ${row.component} component` : "Context only, not in a score"}</span>
              </th>
              <td className="py-3 pr-4 leading-6">
                {row.description}
                {row.descriptionCorrected ? <span className="block text-xs text-ink-muted">Corrected here; the source metadata swaps this description with another hazard&apos;s.</span> : null}
              </td>
              <td className="py-3 pr-4">{row.higherIsBetter === null ? "Not stated" : row.higherIsBetter ? "Higher" : "Lower"}</td>
              <td className="py-3 pr-4 tabular-nums">{formatYears(row.years)}</td>
              <td className="py-3 leading-6">
                {row.sources.map((source, index) => (
                  <span key={source.label}>
                    {index > 0 ? "; " : null}
                    {source.url ? (
                      <a href={source.url} target="_blank" rel="noreferrer" className={ARTICLE_LINK}>
                        {source.label}
                      </a>
                    ) : (
                      source.label
                    )}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const pillarColor = (title: string) => PILLARS.find((pillar) => pillar.label === title)?.cssVar;

export default async function MethodologyPage() {
  const indicators = await getIndicatorTable();
  const lateIndicators = indicators.filter((row) => row.years.length === 1);
  const firstYear = Math.min(...indicators.flatMap((row) => row.years));
  return (
    <ArticlePage
      kicker="Methodology"
      title="Indicator logic, data processing, and score calculation"
      lede={
        <p>
          The Local Development Tracker turns geospatial, environmental, infrastructure,
          and planning data into comparable local-government indicators. This page explains
          how indicators are selected, processed, normalized, and aggregated into the
          Prosperity, Infrastructure, and Livability scores used throughout the app.
        </p>
      }
      toc={TOC}
    >
      <ArticleSection id="overview" title="Overview">
        <div className={PROSE}>
          <p>
            The methodology is designed for country replication. Each country keeps its own
            administrative labels and planning context, while the analytical logic stays
            consistent: collect local indicators, harmonize them to the relevant subnational
            units, convert them into comparable scores, and expose the results for maps,
            scatterplots, driver analysis, and planning review.
          </p>
          <p>
            The framework is intentionally transparent. Users should be able to see the
            indicator source, understand how raw data becomes a score, and interpret the
            result as screening evidence for further validation.
          </p>
        </div>
      </ArticleSection>

      <ArticleSection
        id="framework"
        title="PIL framework diagram"
        intro={
          <p>
            The PIL framework organizes local development evidence around Prosperity,
            Infrastructure, and Livability. The diagram shows how indicator evidence can
            be connected to planning interpretation and investment prioritization.
          </p>
        }
      >
        <ArticleFigure
          src={pilDiagram}
          alt="PIL framework diagram linking local development indicators to planning and investment logic"
          className="max-w-4xl"
          priority
        />
      </ArticleSection>

      <ArticleSection
        id="selection"
        title="Indicator selection logic"
        intro={
          <p>
            Indicators are selected to balance policy relevance with practical data coverage.
            The aim is not to include every possible local development measure, but to build
            a coherent evidence base that can be maintained and compared across local units.
          </p>
        }
      >
        <ul className="max-w-[68ch] list-disc space-y-2 pl-5 text-[17px] leading-[1.75] text-ink marker:text-ink-muted">
          {indicatorSelection.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </ArticleSection>

      <ArticleSection id="pillars" title="The three pillars">
        <TermGrid columns={3} items={pillars.map((pillar) => ({ title: pillar.title, body: pillar.body, list: pillar.items, marker: pillarColor(pillar.title) }))} />
      </ArticleSection>

      <ArticleSection
        id="indicators"
        title="Indicators"
        intro={
          <p>
            Every score component rests on one indicator. The table gives each one&apos;s measure, the direction that scores higher, the years with recorded
            values in any country, and its sources. The same indicators apply in every country.{" "}
            <a href="/api/indicators" download className={ARTICLE_LINK}>
              Download the indicator list as CSV
            </a>
            .
          </p>
        }
      >
        <div className="space-y-10">
          {PILLARS.map((pillar) => (
            <div key={pillar.id}>
              <h3 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-ink">
                <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: pillar.cssVar }} />
                {pillar.label}
              </h3>
              <IndicatorTable rows={indicators.filter((row) => row.pillar === pillar.id)} />
            </div>
          ))}
        </div>
      </ArticleSection>

      <ArticleSection
        id="sources"
        title="Data acquisition"
        intro={
          <p>
            The LDT combines scalable global datasets with country-specific sources where
            available. Each source is selected for its relevance to local development, spatial
            coverage, and ability to be processed into local-government units.
          </p>
        }
      >
        <TermGrid columns={3} items={dataSources.map((group) => ({ title: group.title, list: group.items }))} />
      </ArticleSection>

      <ArticleSection
        id="preprocessing"
        title="Preprocessing and integration"
        intro={
          <p>
            Raw data are prepared before they are exposed in the app. The preprocessing
            pipeline converts heterogeneous input formats into consistent local-unit records
            that can be compared, mapped, and summarized.
          </p>
        }
      >
        <NumberedSteps steps={preprocessingSteps} />
      </ArticleSection>

      <ArticleSection
        id="scores"
        title="Score calculation and aggregation"
        intro={
          <p>
            Score calculation follows a simple interpretation rule: local units are compared
            against other local units in the same release, and higher scores indicate stronger
            relative performance for the selected indicator or pillar unless the metadata says
            otherwise.
          </p>
        }
      >
        <NumberedSteps steps={scoringSteps.map((step) => ({ body: step }))} />
      </ArticleSection>

      <ArticleSection
        id="years"
        title="What changes between years"
        intro={
          <>
            <p>
              Most indicators are recorded for every year from {firstYear}. {lateIndicators.length} are recorded only for{" "}
              {lateIndicators[0]?.years[0]}: {new Intl.ListFormat("en", { type: "conjunction" }).format(lateIndicators.map((row) => row.name))}. For earlier
              years their components count the fixed value described above.
            </p>
            <p>
              A unit&apos;s score therefore compares across years only where its components were recorded the same way in both. The LDT shows a change only on
              that basis, and{" "}
              <Link href="/data-updates#comparability" className={ARTICLE_LINK}>
                Data updates
              </Link>{" "}
              lists how many units compare for each country and score. Compare raw indicator values, not scores, for trends that cross a change in coverage.
            </p>
          </>
        }
      />

      <ArticleSection id="limitations" title="Limitations and interpretation">
        <TermGrid columns={3} items={limitations.map((limitation) => ({ title: limitation.title, list: limitation.items }))} />
      </ArticleSection>

      <ArticleSection id="references" title="References and further information">
        <div className={PROSE}>
          <p>
            Indicator descriptions, source references, and interpretation notes are surfaced
            through the indicator metadata views in the analytics workspace. Users should read
            charts and scores as decision-support evidence for discussion, validation, and
            prioritization rather than as final project-selection decisions.
          </p>
        </div>
      </ArticleSection>
      <ArticleSection id="changes" title="Changes to this page">
        <dl className="max-w-[68ch] space-y-4 text-base leading-7 text-ink">
          <div>
            <dt className="text-sm font-medium tabular-nums text-ink-muted">30 October 2026</dt>
            <dd>
              This page said missing component values were skipped in aggregation. The score tables count a fixed value for them instead, and the score
              calculation now says so. The indicator table, the section on what changes between years, and corrected descriptions for three hazard
              indicators were added.
            </dd>
          </div>
        </dl>
      </ArticleSection>
    </ArticlePage>
  );
}
