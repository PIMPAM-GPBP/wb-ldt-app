import type { Metadata } from "next";
import Link from "next/link";

import { ARTICLE_LINK, ArticleFigure, ArticlePage, ArticleSection, PROSE } from "@/components/layout/article";

import briefImage from "../../../../images/user-guide/brief.png";
import compareImage from "../../../../images/user-guide/compare.png";
import countryImage from "../../../../images/user-guide/country.png";
import homeImage from "../../../../images/user-guide/home.png";
import mapImage from "../../../../images/user-guide/map.png";

export const metadata: Metadata = {
  title: "User guide | Local Development Tracker",
  description: "How to find a place in the LDT, read its scores, compare it with others, read its planning brief, and download the data.",
};

const TOC = [
  { id: "start", label: "Start with a country" },
  { id: "country", label: "Country pages" },
  { id: "map", label: "The map" },
  { id: "compare", label: "Compare" },
  { id: "brief", label: "Planning briefs" },
  { id: "downloads", label: "Downloads" },
  { id: "reading", label: "Reading the scores" },
];

export default function UserGuidePage() {
  return (
    <ArticlePage
      kicker="Guide"
      title="Using the Local Development Tracker"
      lede={<p>How to find a place, read its scores, compare it with others, and take the data away. The screenshots show Kalomo district in Zambia.</p>}
      toc={TOC}
    >
      <ArticleSection id="start" title="Start with a country">
        <div className={PROSE}>
          <p>
            The home page shows each country as a map of its local governments, colored by one score at a time. Choose Prosperity, Infrastructure, or
            Livability above the maps to recolor them. Darker means a higher score within that country: the colors split each country&apos;s units into
            fifths, so they do not compare scores between countries.
          </p>
          <p>Select a country&apos;s map or name to open its page, or go straight to its map, comparison, or planning briefs with the links below it.</p>
        </div>
        <ArticleFigure src={homeImage} alt="The home page with small maps of Nepal, Serbia, and Zambia colored by Prosperity" className="mt-8 max-w-4xl" />
      </ArticleSection>

      <ArticleSection id="country" title="Country pages">
        <div className={PROSE}>
          <p>
            A country page opens with the date of its data and two actions: download every score as a CSV file, or print the page. Each score then shows
            the country&apos;s median, every unit as a tick on a 0 to 100 line, and the median change since the previous year where the years compare.
          </p>
          <p>
            The map below colors every unit by the score you choose; select a unit to open it in the map view. Lists of the five highest and lowest units
            link to each of them and to the full ranking. &ldquo;About this data&rdquo; at the bottom gives the edition, its coverage, caveats, and sources.
          </p>
        </div>
        <ArticleFigure src={countryImage} alt="Zambia's country page with the date of its data, the three scores, and the start of the map" className="mt-8 max-w-4xl" />
      </ArticleSection>

      <ArticleSection id="map" title="The map">
        <div className={PROSE}>
          <p>
            The map view has a panel on each side. On the left is the list of indicators, grouped by score; choose one to color the map, or type to filter
            the list. The legend below it splits units into five classes; select a class to show only its units.
          </p>
          <p>
            On the right is the selected unit: its three scores with their fifth, rank, and gap to the national average, where it sits among all units,
            and the components that lift or lower the chosen score the most. Find a unit with the search box, or select it on the map.
          </p>
          <p>
            Below the map, a ranking table lists every unit for the chosen indicator. The year and province filters at the top of the page apply to every
            view.
          </p>
        </div>
        <ArticleFigure
          src={mapImage}
          alt="The map view of Zambia colored by Prosperity, with the indicator list on the left and Kalomo's scores on the right"
          className="mt-8 max-w-4xl"
        />
      </ArticleSection>

      <ArticleSection id="compare" title="Compare">
        <div className={PROSE}>
          <p>
            Compare shows every unit at once. &ldquo;Scores by pillar&rdquo; places one dot per unit on each score, labels the selected unit, and makes
            the units in its province stand out; select a dot to switch to that unit. &ldquo;Two scores compared&rdquo; plots any two scores against each
            other, with the axes chosen above the chart. &ldquo;All three pillars&rdquo; shows the three scores in 3D; drag to rotate it.
          </p>
        </div>
        <ArticleFigure src={compareImage} alt="The compare view with one dot per district on each of the three scores" className="mt-8 max-w-4xl" />
      </ArticleSection>

      <ArticleSection id="brief" title="Planning briefs">
        <div className={PROSE}>
          <p>
            Every unit has a planning brief, written by code from the data. It opens with the three scores side by side, then gives each score a section.
            Each component sits as a dot on a 0 to 100 line against the national average (solid line) and the province average (dashed), with the gap in
            points. Beside it are the score over time, dashed where the years do not compare, and the three most similar units. Components with nothing
            recorded show as dashed rows.
          </p>
          <p>
            Once a reviewer has checked the local plan&apos;s commitments on a score, its section also shows how many commitments the plan makes on each
            component, flags below-average components the plan never mentions, and quotes the plan with a link to the page. &ldquo;Read as text&rdquo; opens
            the sentences behind the charts, and Print and Download Markdown keep them.
          </p>
        </div>
        <ArticleFigure src={briefImage} alt="Kalomo's planning brief with the three scores and the Prosperity components against the national average" className="mt-8 max-w-4xl" />
      </ArticleSection>

      <ArticleSection id="downloads" title="Downloads">
        <ul className="max-w-[68ch] list-disc space-y-2 pl-5 text-[17px] leading-[1.75] text-ink marker:text-ink-muted">
          <li>Every score and component for every year: Download CSV on each country page.</li>
          <li>The ranking for the indicator on the map: Download CSV above the ranking table.</li>
          <li>Two scores compared: Download CSV beside the chart.</li>
          <li>
            Every indicator with what it measures and its sources: on the{" "}
            <Link href="/methodology#indicators" className={ARTICLE_LINK}>
              methodology
            </Link>{" "}
            page.
          </li>
          <li>A planning brief: Download Markdown, or Print.</li>
        </ul>
      </ArticleSection>

      <ArticleSection id="reading" title="Reading the scores">
        <ul className="max-w-[68ch] list-disc space-y-2 pl-5 text-[17px] leading-[1.75] text-ink marker:text-ink-muted">
          <li>Scores run from 0 to 100 and compare units within the same country and year. A higher score is better for all three.</li>
          <li>
            Fifths are the same five classes as the map legend. Briefs use them instead of ranks, because nearby ranks often differ by a fraction of a
            point.
          </li>
          <li>A component with nothing recorded still counts a fixed value in its score. Briefs mark it and never compare it.</li>
          <li>
            A change between years appears only where a unit&apos;s components were recorded the same way in both years.{" "}
            <Link href="/data-updates#comparability" className={ARTICLE_LINK}>
              Data updates
            </Link>{" "}
            lists how many units that covers.
          </li>
          <li>Scores are screening evidence from satellite and open data, not a project appraisal.</li>
        </ul>
      </ArticleSection>
    </ArticlePage>
  );
}
