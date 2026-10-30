# Glossary

Terms for the planning brief, settled with Son on 29 and 30 October 2026.
Each entry names the code that defines it.

## Planning brief

**Planning brief**: one document per unit and data edition, in five fixed sections, written over a fact sheet.
The redesign is in `reports/Planning brief LLM redesign.md`.

**Unit**: the local government area the LDT scores: a municipality in Nepal and Serbia, a district in Zambia.
The country's higher unit is a province in Nepal and Zambia and a district in Serbia (`src/lib/countries.ts`).

**Pillar**: one of the three scores, Prosperity, Livability, and Infrastructure.
Each pillar score is the plain mean of its component scores.

**Component**: one scored measure inside a pillar, such as Tourism in Prosperity.
Each maps to one raw indicator (`scoreComponentIndicatorMappings` in `src/lib/data/labels.ts`).

## Fact sheet

**Fact sheet**: every number a brief may state about one unit, computed in code (`src/lib/brief/facts.ts`).
Its version is `FACT_SHEET_VERSION`; bump it when an id, a value, or a rule changes.

**Fact id**: a fact's stable name.
Within a sheet it is local, such as `prosperity.component.tourism.value`; globally it carries the sheet's prefix, such as `npl.2025.bagmati-bhaktapur-bhaktapur.prosperity.component.tourism.value`.

**Status**: whether a component rests on a measurement (`src/lib/brief/availability.ts`).
*Measured* means it does.
*Not recorded* means the raw value is a 0 that stands for missing data, or the year's asset lengths were never computed.
*Not applicable* means a road or railway risk for a unit without roads or railway.
*Missing* means there is no value at all.
The score pipeline still gives not recorded and not applicable components a fixed score, so the pillar score counts them, but the brief never compares them, names them as drivers, or uses them for trends or neighbours.

**Band**: the map legend's class a score falls in, named by fifths from "Bottom fifth" to "Top fifth" (`bandFor` in `src/lib/analytics/ranking.ts`).
The brief states bands, never ranks.
A band within the higher unit appears only where it holds at least 20 units.

**Broadly stable**: a change since the base year no larger than the pillar's usual year-to-year movement, the median movement across the country between years with the same data coverage.

**Base year**: the earliest year whose component statuses match the latest year's.
Where none matches, the change is *not comparable* and the brief says why.

**Driver**: a measured component that moves the pillar's gap to an average by at least 0.5 points, at most two pulling down and two lifting.

**Neighbour**: one of the three units most similar on the pillar's measured components, population, and land area.

## Plans

**Plan store**: one record per plan URL, with the units it covers, its language and script, and a status (text, needs OCR, not a PDF, failed), plus the text of each page under its PDF page number (`scripts/build-plan-store.mjs`; local files until Phase 3b).

**Commitment**: something a plan says the government will do, build, fund, or achieve, quoted word for word from one page and mapped to the score components it directly changes (`src/lib/plans/extract.ts`).
*Specific* commitments name a place, a quantity, a budget, or a date; *general* ones state intent.

**Quote match**: finding a commitment's quote in the plan's own text (`src/lib/plans/quotes.ts`).
*Exact* means its letters and digits appear in order on one page, or across a page break; *fuzzy* means a near-identical window on the cited page or next to it.
An unmatched or too-short quote is dropped.

**Salience**: how much a local plan says about a component: *high* (three or more commitments, at least one specific), *medium*, *low*, or *silent* (none).

**Coverage gap**: a measured component more than 10 points below the national average; section three names each one with what the plan says about it, and the ones the plan is silent on matter most.

## Checking

**Verifier**: the check every sentence passes before it is shown (`src/lib/brief/verify.ts`).
Each number must equal a cited fact at the precision the text shows, each direction or band word must agree with a cited fact, and ranks and spelled-out numbers fail.
A failing sentence is dropped.

**Golden set**: the 45 units, 15 per country, that every prompt, schema, or model change is checked on first (`tests/fixtures/brief/golden-set.json`, built by `scripts/build-brief-golden-set.mjs`).
