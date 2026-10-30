# Public data tool page patterns

What strong public data tools put on their pages outside the map, read from the live sites on 2026-10-30.
Every claim names the page it came from.
Where I draw a conclusion the page does not state, the sentence says "inference".
The plan doc this answers is `docs/roadmap/LDT-UI-Overhaul-Plan.md`; it already measured the Climate Vulnerability Index, CORE Score, and Global Capitalism Index map views, so this report covers the other pages and the other tools.

Four sites on the brief could not be read and are not cited: County Health Rankings and the Child Opportunity Index both serve a Cloudflare bot check, FEMA's National Risk Index closed the connection on three fetches and the browser pane refused the host, and the Economist is blocked by the fetch tool.
The FT has no comparable sub-national index page that I know of, so I did not try it.
The fetch log with every URL is in `research_notes/Public data tool page patterns/fetch-log.md`.

## Summary

The tools split into two families, and the split matters more than any single pattern.

Sites Darkhorse built end to end put the data on the first screen.
The Global Capitalism Index home opens with a one-line description and the top 20 ranked list with score bars (https://capitalismindex.com/).
CORE Score opens with the national score, a year selector, a geography selector, and a map (https://corescore.us/).
The Opportunity Atlas and the Social Capital Atlas open on the map with a dismissable intro panel (https://opportunityatlas.org/, https://socialcapital.org/).
Stronger Nation opens with the headline national figure under "2024 Report for United States" (https://strongernation.luminafoundation.org/).

Sites where the client runs a CMS landing site in front of a Darkhorse map put text and a launch button first.
The Climate Vulnerability Index landing has a headline, an intro naming 184 data sets and 70,000 tracts, and a launch button, with the map on a separate subdomain (https://climatevulnerabilityindex.org, https://map.climatevulnerabilityindex.org/).
AIDSVu, the Environmental Performance Index, and the Social Progress Imperative do the same (https://aidsvu.org/, https://epi.yale.edu/, https://www.socialprogress.org/).

Across both families:

- The first sentence counts what is measured: 184 data sets and 70,000 tracts (CVI), 11 indicators across four categories (CORE), 8 subindices, 170 countries, 2009 to 2025 (GCI), 21 billion friendships (Social Capital Atlas), 177 countries on 47 indicators (EPI).
- No site describes its software.
  The nearest is AIDSVu calling itself an "interactive online mapping tool" in one phrase (https://aidsvu.org/about/).
- Methodology is one long page with numbered or ordered sections, plus a PDF or spreadsheet for the detail (CVI, GCI, EPI, ND-GAIN, SPI, Stronger Nation).
- Citation text lives on the download page, the methodology page, or the chart itself, not on the About page (EPI home, SVI download page, ND-GAIN download page, Stronger Nation methodology, OWID grapher pages, GCI README).
- Data changes are communicated as dated correction notes or a "changes from the previous edition" section, and are usually attached to the data download or methodology page, not a software changelog (SVI, EPI, HDR).
- No site publishes a roadmap.
  The closest things are a FAQ answer on update frequency (CVI) and a "Next expected update" date on each chart (OWID).
- Headers on Darkhorse-built sites carry 3 to 5 links, and footers carry the producing institution's logos, a "Get the data" link, a report PDF, a contact email, and a Darkhorse credit.

## Home page

### What the tools do

The Global Capitalism Index home shows a title, a one-line description of the index (8 subindices, 170 countries, 2009 to 2025), then the top 20 countries ranked with scores and a score bar on each row, ending in "see full rankings" (https://capitalismindex.com/).
Below the list come a definition paragraph with a "Learn more" link, the top 10 again, a section introducing the eight subindices with links to the methodology and white paper, and a production credit with two logos.
The footer holds "Get the data" (GitHub), "Annual Report" (PDF), a contact email, a copyright line, and the Darkhorse logo.
There is no map on the home page.

CORE Score has no landing page at all.
The home is the tool: the header is two institution logos, then the title "CORE Score" and "Measuring Wellbeing", an intro naming 11 indicators across four categories, a "Wellbeing for the nation" headline with the score, a year selector (2023), a geography selector (USA), and an "Explore change over time" control (https://corescore.us/).
Under that is a map and time-series toggle with the prompt "Click on the map to change focus", a chart of every county by year with the 5th to 95th percentile band, a "Download Geographic Data" button, the score breakdown into four categories and their measures, a time series by demographic, and a "Download Demographic Data" button.

The Opportunity Atlas loads straight into the map (https://opportunityatlas.org/).
An overlay asks "Which neighborhoods in America offer children the best chance to rise out of poverty?", explains the 20 million people followed, and offers "BEGIN EXPLORING".
A side menu lists Metro Rankings, Income Trends, Trend Analysis, and Regional Comparisons, then "ATLAS MODULES" (County & Metro Mobility Trends, Neighborhood Mobility Outcomes), then METHODS and FAQs.
Below the map are the research paper link, "Atlas in action", a link to the Social Capital Atlas, "Ask OI", community profiles for the top 50 metros, the Census Bureau disclosure text with review project numbers, and "Designed and developed by" Darkhorse.

The Social Capital Atlas opens with one paragraph (21 billion Facebook friendships, three measures per neighborhood, high school, and college), three one-line measure definitions, an "EXPLORE THE DATA" button, and the paper citation "Chetty, Jackson, Kuchler, Stroebel, et al. Nature 2022" (https://socialcapital.org/).
The map follows, with the selected county's value shown as a sentence ("40.3% of friends are high-income"), its percentile ("County Median: 50th"), the low and high ends of the range, and download data, download image, and share controls.

Stronger Nation opens with the title "Credentials of Value" over "2024 Report for United States", a one-sentence goal (75 percent of the labor force with a credential of value by 2040), the headline national figure, and a "LEARN MORE ABOUT THE METHODOLOGY" button (https://strongernation.luminafoundation.org/).
An in-page nav lists Introduction, Summary, State Credentials of Value (a map shaded from under 35 percent to 50 percent or more), Education Types, Demographics, and Detailed Race/Ethnicity.
Charts carry year, demographic, and sorting controls and an image download.

The EPI Data Library opens with the headline "Learn about wages, jobs, and inequality", one descriptive sentence, a "Download Data Sets" block, a "Browse Topics" list, then four featured indicators as cards with a chart preview and an "EXPLORE" button, then an expandable list of all topics (https://data.epi.org/).

The Climate Vulnerability Index landing is a WordPress site with the partner logos in the header, a headline, an intro, and a launch button, then one teaser section each for Tutorials & Use Cases, News, Partners, Resources, and Methodology, then a repeated launch button and contact email (https://climatevulnerabilityindex.org).
The EPI home is a photo hero with the tagline "Data driven reports for a sustainable future", three links (Results, Downloads, Methodology), a "Welcome" paragraph naming 177 countries, 47 indicators, and 12 categories, a "Suggested Citation" block, a scatter of EPI against GDP per capita, and the framework wheel (https://epi.yale.edu/).
The Social Progress Imperative home opens with three product cards and a sales headline, then 16 sections including partner logos and seven testimonials (https://www.socialprogress.org/).
Our World in Data opens with its tagline, counts of its own content (14,035 charts, 126 topic pages, 26 explorers, 506 articles), featured articles, dated "Updates and announcements" such as a WHO mortality data update, and the topic list (https://ourworldindata.org/).

Inference: the Darkhorse-built homes share one rule, which is that the first screen shows a value from the data (a ranked list, a score with its selectors, a map, a headline percentage) and the first sentence counts what was measured.
The text-first landings belong to clients who host the map elsewhere.

### For the LDT

The built home (three small-multiple maps colored by pillar, a headline that names 1,028 local governments in three countries) sits in the Darkhorse family.
What the Darkhorse homes add that the LDT's does not yet: a number per country on the first screen (CORE Score shows the national score beside its selectors; Stronger Nation shows the national figure), a ranked or ordered element (GCI's top 20), and a data download reachable from the first screen (data.epi.org, CORE Score).
None of the Darkhorse homes carries a feature grid, a stat tile about the app, or a diagram, which supports the plan's removal of those.
The GCI home repeats "see full rankings" twice; its home is a shortened rankings page, which suggests the LDT home could preview the top and bottom units per country rather than only the maps.

## Country or place landing pages

### What the tools do

The GCI country profile opens with a breadcrumb (Profiles > Switzerland), a "Pin Switzerland to sidebar" control, the 2025 score (96.9), and "World rank #1" (https://capitalismindex.com/profile/switzerland).
Then the eight subindices, each as a name, acronym, one-line description, and a sort control (A-Z, score, rank), then "Index score over time" and "Index rank over time" charts, then a ranked list of peers.
The page has "little narrative text" beyond the subindex descriptions and the footer.

The UNDP country page shows "Data updates as of May 6th, 2025", the country name, population with its year, and three actions: Country Data (csv), Metadata, Print (https://hdr.undp.org/data-center/specific-country-data#/countries/NPL).
Then one paragraph that states the HDI value (0.622), the category (Medium), the rank (145 of 193), and the change since 1990 in words, followed by the value, the classification, the region, the rank on a Low to Very high band scale, a 1990 to 2023 trend chart, and a comparison chart where the reader adds up to three countries.
The ranked list it comes from has columns Rank, Country, HDI Value, and "Change from 2022", with sort by A-Z or rank and a region filter (https://hdr.undp.org/data-center/country-insights).

The EPI country page opens with the country name, its region, and four context stats (GDP, GDP per capita, population, land area), then a nested table with columns Indicator, Rank, EPI Score, 10-Year Change, Regional Rank, Regional Average, from the overall index down to each indicator (https://epi.yale.edu/2026/results/country/NPL).
Below the table is generic methodology text for every indicator; there is no commentary specific to Nepal.

The World Bank country page opens with a "Jump to" list, then tables by theme (Social, Economic, Environment, Institutions) where each row is the indicator, its most recent value with the year in parentheses, and a trend column; downloads are CSV, XML, and Excel (https://data.worldbank.org/country/nepal).

CORE Score has no separate place page; the geography selector and the map change the one page, and a "Download Geographic Data" button sits beside the map (https://corescore.us/).
The CVI map app treats a state as a filter and says state values are the median of all tracts in that state (https://map.climatevulnerabilityindex.org/).

### For the LDT

The plan's country page (pillar strip with national medians, a distribution plot, a full-width map, three plain links) matches the GCI profile and the UNDP page in order: score first, components second, trend third, peers or map last.
Three things the evidence adds.
First, a dated line at the top ("Data updates as of", UNDP) and the three actions CSV, Metadata, Print, which the UNDP page puts above the score.
Second, a change column: UNDP shows "Change from 2022" on every row and EPI shows "10-Year Change"; the LDT country page has years, so the pillar strip should carry a change since the previous data year where the years compare.
Third, a rank with its band: UNDP shows the rank on a Low to Very high scale and GCI shows "World rank #1"; for the LDT this is the country's position among three, which is weak, so the stronger analogue is each province's or unit's rank inside the country.
No studied page has anything like the "Release trust and AI readiness" card or the five-card command center; the plan's "About this data" band at the bottom is closer to the EPI page, which puts methodology text under the table.

## About page

### What the tools do

The CVI About page is a narrative: it opens with Hurricane Harvey in 2017, then four headed sections on why the index exists, naming the two institutions that built it, with the partner logos, a fact sheet PDF, and a contact email (https://climatevulnerabilityindex.org/about/).
It names no funders and has no citation.
Team, stakeholders, contributors, acknowledgements, and funders (two NIEHS grant numbers) are on a separate Partners page, each organization with a logo, a linked name, and a paragraph, and each person as a name with an affiliation (https://climatevulnerabilityindex.org/partners/).

AIDSVu's About page lists AIDSVu Maps, Data Methods, Contact Us, three advisory committees with their members, Citation (a 2020 journal paper with copy-to-clipboard, PDF, EndNote, BibTeX, and RIS), and Export Meta Data (https://aidsvu.org/about/).
The copy describes what the data shows by geography and demographic; software is one phrase.

Our World in Data's About page has four sections (Who we are, What we do and how to follow our work, Our mission, How to contact us) and links team and funding as separate pages (https://ourworldindata.org/about).

The Global Capitalism Index has no About page.
Its "What is capitalism?" page is a four-section explainer of the framework with the measure counts per section, with no team, funders, or citation (https://capitalismindex.com/what-is-capitalism).
Production credit sits in the footer of every page.

CORE Score has no About page either; the footer links "About the Commission" and "Read the Final Report" on the commissioning body's site (https://corescore.us/).

The Opportunity Atlas puts "About the Opportunity Atlas, Overview and key take-aways" as a link below the map, with the user guide and methods as PDFs hosted on opportunityinsights.org (https://opportunityatlas.org/).

### For the LDT

The About page today is a dated QuickStart note with figures.
No studied site has that.
The sites split the material three ways: why the index exists and who built it (CVI About, OWID About), who exactly and who paid (CVI Partners, AIDSVu advisory lists), and how to use the tool (CVI "Tutorials & Use Cases", the Opportunity Atlas user guide PDF).
The plan keeps the note's wording as written; the evidence argues for cutting it into a short About (three to five sections, the institutions, the contact, a link to the citation) and moving the walkthrough with its screenshots into a "User guide" under Resources or a PDF.
The note's SWOT and AI-recommendation screenshots, which the app has dropped, would go with it.

## Methodology page

### What the tools do

CVI's methodology is one page with four H2s in pipeline order: Indicator Selection, Data Sources, Data Processing, Data Integration (https://climatevulnerabilityindex.org/methodology/).
Figure 1 shows 7 categories and 37 components; the 184 indicators are not listed on the page but in an Excel file; the technical reference is the peer-reviewed paper with its DOI; there is no PDF, no version number, and no date.
Limitations are scattered through the text (tract resolution, nine datasets missing Alaska and Hawaii, territories excluded, imputation capped at 25 percent).

The GCI methodology is one page: Designing the Index, how the approach differs, Collecting and Normalizing the Data, Fitting the Pieces Together, 11 FAQs, and a Data Sources table with Domain, Dataset, and Source columns and a selector per subindex, totaling 213 datasets (https://capitalismindex.com/methodology).
It links a white paper PDF and an annual report PDF.
It says the index "will be updated annually" and that editions are labeled by the year after the data year.
Limitations appear in the body (estimated values with confidence intervals, judgment calls in weighting), not under a heading.

The EPI methodology is one page with 11 numbered sections: Introduction, Data Selection (inclusion criteria, data sources), Country Coverage, Indicator Construction (standardization, transformation, scoring), Framework, Weighting and Aggregation, Materiality, Missing Data, Backcasting, Changes From the 2024 EPI, Works Cited (https://epi.yale.edu/2026/methodology).
The changes section lists 19 indicators removed and 8 added and warns that scores are not comparable across versions.
Indicators are not listed on the page; the Technical Appendix PDF and the "Explanations, targets, weights" spreadsheet carry them (https://epi.yale.edu/2026/downloads).

ND-GAIN's methodology page has two sections, Vulnerability (exposure, sensitivity, adaptive capacity) and Readiness (economic, governance, social), gives counts (36 and 9 indicators), and pushes the per-indicator sources to a separate Indicators page and a technical report PDF dated 2024 (https://gain.nd.edu/our-work/country-index/methodology/).

The SPI methodology page holds the full indicator tables with a definition and a linked source per indicator, four design principles, and a Methodology Summary PDF; it has no limitations section and no citation (https://www.socialprogress.org/methodology).

Stronger Nation's methodology is one page with Measures, Glossary, FAQ (Data Sources, Data Considerations, Certificates), and Acknowledgements, with data-year notes (no 2020 data, counting revised from 2024), a limitations list inside "Data Considerations", two citation formats, and three spreadsheet downloads (https://strongernation.luminafoundation.org/methodology).

CORE Score's methodology is a five-page PDF titled "CORE Score Variables": a data sources paragraph, a note that there are six data files, then for each of the four categories, each measure with its source and how it was coded, including source changes and a "use caution when comparing" note where a source changed between years (https://www.amacad.org/sites/default/files/publication/downloads/CORE%20Score%2C%20Methodology.pdf).

SVI's index page has a Methodology section (16 census variables, four themes, a theme diagram, a CSV of the overall table) and a "Changes over time" section with a timeline graphic and a CSV of the changes (https://www.atsdr.cdc.gov/place-health/php/svi/index.html).

### For the LDT

The LDT's methodology order (indicator selection, data sources, preprocessing, scoring, limitations) is the same order as CVI and EPI, so the structure is right.
What the strong pages add: a per-indicator table with source and year (SPI, GCI), a "Changes from the previous version" section (EPI), a comparability warning where a source changed (CORE PDF, EPI, SVI), and the indicator list as a downloadable file (CVI Excel, EPI xlsx).
Only Stronger Nation has a section that is in effect a limitations list; the others fold caveats into the body.
The plan keeps the framework PNG on Methodology; CVI, EPI, and SVI all show a framework figure there, so that holds.
The plan notes that Methodology says missing components are skipped while the pipeline counts a fixed value; the CORE PDF and the SVI correction notes show the convention, which is to state the actual treatment and date the change.

## Resources page

### What the tools do

CVI's Resources page is split by audience: an intro on federal funding programs with a PDF list, "For Local Governments" (prose and a contact email), and "For Researchers" with three items: the master dataset as an Excel workbook, Figure 1 as a PNG, and the GitHub repository for data and code (https://climatevulnerabilityindex.org/resources/).

EPI's Downloads page is grouped Documentation, Press Releases, Data and Results, and each item shows its format and size, for example the Technical Appendix as a PDF of 935.9 KB and the results as an .xlsx of 449.7 KB, with the release date in the file name (https://epi.yale.edu/2026/downloads).
The license (CC BY-NC-SA 4.0) is on the page; there is no changelog.

UNDP's Documentation and downloads page lists each statistical table as a named .xlsx, a complete time-series CSV, a metadata workbook, a calculation workbook, and the technical notes PDF for every edition back to 2016 (https://hdr.undp.org/data-center/documentation-and-downloads).

ND-GAIN offers one zip, named with the year, and lists what is inside it (index, sector, component, readiness, indicator data in raw, interpolated, and scaled forms, context data), with a citation line (https://gain.nd.edu/our-work/country-index/download-data/).

GCI puts "Download the data" in the header nav and sends it to GitHub, where the README lists one CSV per subindex plus a master panel with row counts, the reference documents, a coverage table, notes on use, citation formats, and the CC BY-NC 4.0 license (https://github.com/DemocracyandCapitalismLab/GlobalCapitalismIndex).

AIDSVu's Data Methods page is split by geography (State/County, City) with a "Learn More" link each, plus Tools and Resources and Cite AIDSVu (https://aidsvu.org/data-methods/).

Our World in Data puts the downloads under each chart: "Download full data", "Download displayed data", a data URL and metadata URL, and code examples for Excel, Python, R, and Stata (https://ourworldindata.org/grapher/human-development-index).

### For the LDT

The LDT Resources page lists briefing notes, decks, notebooks, and country folders.
The studied pages group either by audience (CVI) or by type (EPI, UNDP), and every data item carries its format, and on EPI its size and date.
For the LDT that means: a Data and results group (CSV per country and a combined file, a metadata or data dictionary file, the indicator list), a Documentation group (methodology PDF, briefing notes, decks), and a Notebooks and code group, each item with format, size, and date, and the license and citation line on the same page.
None of the studied resource pages describes the files in paragraphs; they are lists.

## Release notes, changelog, data versions

### What the tools do

SVI's download page has "Data changes over time", a comparison table of source variables across the seven database years (2000 to 2022), and a "Data correction" subsection with dated notes, for example a 2022 denominator correction on 12/11/24 that did not affect rankings, and a 2020 housing burden correction in December 2022 (https://www.atsdr.cdc.gov/place-health/php/svi/svi-data-documentation-download.html).
It warns against comparing database years because percentiles are relative within a year and tract boundaries change.
The suggested citation has placeholders for the database year and the geography.

EPI's methodology section "Changes From the 2024 EPI" lists the indicators removed and added and states that historical scores are not comparable; the downloads carry the date in the file name (https://epi.yale.edu/2026/methodology, https://epi.yale.edu/2026/downloads).

UNDP has no changelog but a list of dated update notices on the downloads page, newest first ("12 October 2026: MPI 2026 data update"), and "Data updates as of May 6th, 2025" at the top of every country page (https://hdr.undp.org/data-center/documentation-and-downloads, https://hdr.undp.org/data-center/specific-country-data#/countries/NPL).

Our World in Data shows "Last updated: 2025-05-07" and "Next expected update: 2026-11-30" under each chart, lists dated data updates on the home page, and links "Past versions" on each topic page (https://ourworldindata.org/grapher/human-development-index, https://ourworldindata.org/, https://ourworldindata.org/human-development-index).

AIDSVu announces data releases as dated news posts, for example "AIDSVu releases 2024 HIV data and interactive maps" (https://aidsvu.org/).

CVI's FAQ answers "How often will the U.S. Climate Vulnerability Index be updated?" with no planned update and discloses a known bug in one score whose direction is inverted (https://climatevulnerabilityindex.org/faq/).
CVI's News page is press coverage grouped by type with no dates and no data updates (https://climatevulnerabilityindex.org/news/).

GCI says "updated annually" and names editions by year; the GitHub Releases section is empty and the README has no changelog (https://capitalismindex.com/methodology, https://github.com/DemocracyandCapitalismLab/GlobalCapitalismIndex).

### For the LDT

Every studied site that communicates change does it in terms of the data: which year, which sources, what was corrected and when, and whether years compare.
None has a software release list with release types.
The plan's Release notes page is "a dated list with the release type as text" and a versioning key, which is the software convention.
The evidence argues for turning it into "Data updates": one dated entry per data change with the affected country and score, a comparability note, and the date, plus the "data as of" line on country pages and a "next expected update" line where one is known.
The known-bug disclosure in the CVI FAQ is the pattern for the Methodology mismatch the plan recorded (fixed value counted for missing components).

## Roadmap

### What the tools do

No studied site has a roadmap page.
I checked the navigation and footers of CVI, CORE Score, GCI, Opportunity Atlas, Social Capital Atlas, AIDSVu, Stronger Nation, data.epi.org, SVI, SPI, EPI, ND-GAIN, UNDP, Our World in Data, and the World Bank data pages cited above.
The forward-looking statements that exist are one line each: "will be updated annually" (https://capitalismindex.com/methodology), "updated annually" (https://gain.nd.edu/our-work/country-index/download-data/), "Next expected update" per chart (https://ourworldindata.org/grapher/human-development-index), a FAQ answer saying there are no immediate plans to update (https://climatevulnerabilityindex.org/faq/), and CVI's "For Local Governments" section describing planned support for a city cohort (https://climatevulnerabilityindex.org/resources/).

### For the LDT

The plan built a Roadmap page with a sprint timeline and version list, and notes that most sprint dates now read as past.
The evidence argues against a public roadmap page at all.
The audience-facing substitute is one or two sentences on the data updates page or in a FAQ: when the next data year is expected, which countries are planned.
The sprint timeline belongs in the repository docs, where the plan doc already lives.

## Header navigation and footer

### What the tools do

Header link counts and labels on the Darkhorse-built sites:

- GCI: five links, "What is capitalism?", "2025 rankings", "Compare countries", "Executive summary", "Download the data" (https://capitalismindex.com/).
- Stronger Nation: three links, "Credentials of Value", "Educational Attainment", "Methodology" (https://strongernation.luminafoundation.org/).
- CORE Score: no nav menu, two institution logos in the header (https://corescore.us/).
- Opportunity Atlas: an in-app menu with the four views, the two modules, METHODS, and FAQs (https://opportunityatlas.org/).
- CVI map app: a hamburger, the title, and the three partner links (https://map.climatevulnerabilityindex.org/).
- data.epi.org: "About Epi" and "Subscribe" (https://data.epi.org/).

The client-run landing sites carry more: CVI eight (About, Partners, Tutorials & Use Cases, Resources, News, FAQ, Methodology, Launch The CVI) (https://climatevulnerabilityindex.org), AIDSVu six (https://aidsvu.org/), EPI six (Home, EPI 2026, Contact, FAQs, Archives, Resources) (https://epi.yale.edu/), SPI ten plus login (https://www.socialprogress.org/).

Footers on the Darkhorse-built sites hold the same set: the producing institutions with logos, "Get the data", a report PDF, a contact email, a copyright line, and a Darkhorse credit (https://capitalismindex.com/, https://corescore.us/, https://strongernation.luminafoundation.org/, https://data.epi.org/).
CORE Score's footer adds "About the Commission", "Read the Final Report", "View Methodology PDF", and a web policy link (https://corescore.us/).
EPI's footer adds the funder ("with support from" the McCall MacBain Foundation), the CC BY-NC-SA license, and a trademark line (https://epi.yale.edu/).
CVI's footer is the three partner logos, privacy and terms, and copyright (https://climatevulnerabilityindex.org).
The Opportunity Atlas footer holds the Census Bureau disclosure text with its review numbers, the Mapbox and OpenStreetMap attributions, and the Darkhorse credit (https://opportunityatlas.org/).

Labels name content and often the edition year: "2025 rankings", "EPI 2026", "2024 Report for United States".

### For the LDT

The plan's header (logo, country switcher, Methodology, Resources, About) is within the 3 to 5 range of the Darkhorse-built sites.
GCI and EPI both put the data download in the header ("Download the data", "Downloads"); if Resources is where the LDT's data lives, the label "Data" would match them better than "Resources".
The plan moves Roadmap and Release notes to the footer; the evidence says drop the roadmap and rename release notes to data updates, then the footer holds: the World Bank mark and the GPB Suite and PIM-PAM marks as the producers, Get the data, the methodology PDF, Data updates, a contact address, the license, and the citation line.
No studied footer carries a nav repeat longer than the header, a newsletter form (except AIDSVu and SPI), or feature text.

## Copy style and what is left out

Every first sentence counts the data: 184 data sets and 70,000 tracts (https://climatevulnerabilityindex.org), 11 indicators across four categories (https://corescore.us/), 8 subindices, 170 countries, 2009 to 2025 (https://capitalismindex.com/), 21 billion friendships (https://socialcapital.org/), 177 countries on 47 indicators (https://epi.yale.edu/), 20 million Americans followed to their mid-30s (https://opportunityatlas.org/).
The GCI profile page is described in the fetch as having "little narrative text"; the EPI country page has none specific to the country.
Values appear in sentences where a person would say them: "40.3% of friends are high-income" (https://socialcapital.org/), "Nepal's HDI value for 2023 is 0.622" with the rank and category in the same sentence (https://hdr.undp.org/data-center/specific-country-data#/countries/NPL).

Left out everywhere: descriptions of the software, feature grids, stat tiles about the site itself (OWID's counts of its charts are the one exception, and they count content, not features), roadmaps, trust or readiness sections, and nav labels that name the product rather than the content.
The CVI map app has no about, version, or date text inside it (https://map.climatevulnerabilityindex.org/).

One caution on the plan doc: it records that the GCI ranked list shows a delta "since 2024" on every row.
The text of the rankings page as fetched today shows rank, name, score, and a profile link, and the fetch reports no year-over-year change indicator (https://capitalismindex.com/rankings).
The delta may be drawn in the score bar rather than written, so this is unconfirmed rather than contradicted; the UNDP ranked list does show a written "Change from 2022" column (https://hdr.undp.org/data-center/country-insights).

## Sites studied

| Site | Built by | Pages read |
| --- | --- | --- |
| Darkhorse Visualization | Darkhorse | https://darkhorsevisualization.com/, https://darkhorsevisualization.com/solutions |
| U.S. Climate Vulnerability Index | Darkhorse (map), EDF (site) | https://climatevulnerabilityindex.org, https://climatevulnerabilityindex.org/about/, https://climatevulnerabilityindex.org/methodology/, https://climatevulnerabilityindex.org/resources/, https://climatevulnerabilityindex.org/faq/, https://climatevulnerabilityindex.org/partners/, https://climatevulnerabilityindex.org/news/, https://map.climatevulnerabilityindex.org/ |
| CORE Score | Darkhorse | https://corescore.us/, https://www.amacad.org/sites/default/files/publication/downloads/CORE%20Score%2C%20Methodology.pdf |
| Global Capitalism Index | Darkhorse | https://capitalismindex.com/, https://capitalismindex.com/methodology, https://capitalismindex.com/rankings, https://capitalismindex.com/profile/switzerland, https://capitalismindex.com/what-is-capitalism, https://github.com/DemocracyandCapitalismLab/GlobalCapitalismIndex |
| Opportunity Atlas | Darkhorse | https://opportunityatlas.org/ |
| Social Capital Atlas | Darkhorse | https://socialcapital.org/ |
| AIDSVu | Darkhorse (map), Emory (site) | https://aidsvu.org/, https://aidsvu.org/data-methods/, https://aidsvu.org/about/ |
| Stronger Nation | Darkhorse | https://strongernation.luminafoundation.org/, https://strongernation.luminafoundation.org/methodology |
| EPI Data Library | Darkhorse | https://data.epi.org/ |
| Market Explorer, Yale | Darkhorse | https://markets.healthcareaffordabilitylab.org/introduction |
| CDC/ATSDR Social Vulnerability Index | CDC | https://www.atsdr.cdc.gov/place-health/php/svi/index.html, https://www.atsdr.cdc.gov/place-health/php/svi/svi-data-documentation-download.html |
| Social Progress Imperative | SPI | https://www.socialprogress.org/, https://www.socialprogress.org/social-progress-index, https://www.socialprogress.org/methodology, https://www.socialprogress.org/us |
| Environmental Performance Index | Yale | https://epi.yale.edu/, https://epi.yale.edu/2026/methodology, https://epi.yale.edu/2026/downloads, https://epi.yale.edu/2026/results/indicator/EPI, https://epi.yale.edu/2026/results/country/NPL |
| ND-GAIN Country Index | Notre Dame | https://gain.nd.edu/our-work/country-index/, https://gain.nd.edu/our-work/country-index/methodology/, https://gain.nd.edu/our-work/country-index/rankings/, https://gain.nd.edu/our-work/country-index/download-data/ |
| UNDP Human Development Reports data center | UNDP | https://hdr.undp.org/data-center, https://hdr.undp.org/data-center/documentation-and-downloads, https://hdr.undp.org/data-center/country-insights, https://hdr.undp.org/data-center/specific-country-data#/countries/NPL |
| Our World in Data | OWID | https://ourworldindata.org/, https://ourworldindata.org/about, https://ourworldindata.org/human-development-index, https://ourworldindata.org/grapher/human-development-index, https://ourworldindata.org/latest |
| World Bank data | World Bank | https://datacatalog.worldbank.org/, https://data.worldbank.org/country/nepal |

Not read: https://www.countyhealthrankings.org/ and https://www.diversitydatakids.org/child-opportunity-index (bot check), https://hazards.fema.gov/nri/ (connection closed), https://www.economist.com/democracy-index (blocked), https://healthatlas.ca/ (verification page), https://climatevulnerabilityindex.org/cvi-data/ (over the fetch size limit), https://opportunityatlas.org/faq (loading placeholder only).
The ND-GAIN rankings page was fetched but its table did not come through in the text, so I make no claim about its rows.
The SPI index page has no standalone country pages; country results are a desktop-only scorecard.
