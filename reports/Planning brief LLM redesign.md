# Compute the facts, retire the buttons

Research date: 29 October 2026.
Sources: five research notes in `research_notes/Planning brief LLM redesign/` covering the current codebase, Darkhorse Analytics and public index tools, data-to-text products and research, plan-document grounding, and multi-step LLM workflow and evaluation practice.
Code paths are relative to the repository root and link from this file's location.

The LDT planning brief should become a precomputed, reviewed document built on a deterministic fact sheet, with the model allowed to write sentences only about facts the code has already computed and plan passages the code has already located and verified.
Every mature product that ships generated narrative does this, from Tableau Pulse's "facts are ground truth" design to Power BI's footnotes that point at a visual, and the research on table-to-text errors says the only mitigations with measured gains are post-hoc checks of each claim against the source cells ([Tableau Help](https://help.tableau.com/current/online/en-us/pulse_insights_platform_insight_types.htm); [TabFaith, ACL 2026](https://aclanthology.org/2026.surgellm-1.21/)).
None of the public index tools that explain place-level scores (Darkhorse's Climate Vulnerability Index, County Health Rankings, the SDG Index, OECD Regional Well-being) ships LLM prose at all; they show ranked drivers, banded ranks, explicit "information unavailable" states, and a curated strategy catalogue where they reach action ([CVI tutorial](https://climatevulnerabilityindex.org/tutorials/step3); [WWFH ratings](https://www.countyhealthrankings.org/sites/default/files/media/document/What%20Works%20for%20Health%20Evidence%20and%20Disparity%20Ratings%2C%20Jan24.pdf)).
The coordinator's seven directions hold up well against this evidence; the fact sheet (direction 2) and per-release precompute (direction 1) are the foundation, plan ingestion (3) is right but is bottlenecked by OCR and translation rather than by prompting, and structured recommendations (4) need an intervention catalogue that does not exist yet.
The current pipeline's worst defects are cheap to fix: it hard-codes `cachedStages` to empty so the public never sees a cached brief, it sends the first ten paragraphs of each plan (cover matter and tables of contents) as "plan context", it runs a model OpenAI lists as deprecated with no temperature or output limit, and it rebuilds a 6.5-second page load inside every stage request ([queries.ts](../src/lib/data/queries.ts); [prompts.ts](../src/lib/ai/prompts.ts); [openai.ts](../src/lib/ai/openai.ts)).
The recommended brief has five fixed sections (position and drivers, plan commitments with page quotes, coverage gaps, options tied to commitments or gaps, and open questions for the municipality), drops the SWOT and the per-stage buttons, moves web search out of the public brief, and ships behind a draft-or-reviewed label with a per-section problem report.
Generation for a whole release costs single-digit dollars on the OpenAI Batch API, so the binding constraints are review time, plan-document quality, and the catalogue, not compute ([OpenAI batch guide](https://developers.openai.com/api/docs/guides/batch)).

## The current pipeline reads cover pages and shows the public nothing

The brief today is seven server stages behind seven POST routes, four of which call `gpt-4.1-mini` through a raw `fetch` with no parameter other than the model name, and all of which rebuild the full analytics page context before doing anything ([pipeline.ts](../src/lib/ai/pipeline.ts); [openai.ts](../src/lib/ai/openai.ts)).
That context load is the same one that makes `tab=ai` take about 6.5 seconds, because it pages five years of score component values for every unit 1,000 rows at a time, which for Nepal is roughly 15 sequential Supabase round trips per year ([queries.ts](../src/lib/data/queries.ts)).
A seven-stage brief therefore spends on the order of **45 seconds in data loading alone** before any model call, and the only cache that could skip it is never read: `cachedStages` is hard-coded to `{}` in the page loader, the client never sends `mode: "load_cached"`, and in production any other mode returns 403 unless `AI_GENERATION_ENABLED` or an admin token is set ([queries.ts](../src/lib/data/queries.ts); [_utils.ts](../src/app/api/ai/_utils.ts)).
So a public visitor who clicks "Generate" sees a 403, and a visitor who does not click sees nothing, even when a completed brief sits in `ai_stage_cache`.

What the model sees of a plan is thin.
Plans arrive as URLs from a hand-maintained workbook (112 Zambian districts, 151 Serbian municipalities, and 10 Nepal rows that cover the seven provinces), get fetched with no timeout, parsed with pdf-parse (no OCR, no language detection), split on blank lines into up to 80 passages, and then **only passages 1 to 10 of each document reach the prompt** ([plan-sources.mjs](../scripts/lib/plan-sources.mjs); [documents.ts](../src/lib/ai/documents.ts); [prompts.ts](../src/lib/ai/prompts.ts)).
Those are forewords and tables of contents, so relevance to the selected score theme is accidental, and for the national corpus the ten passages come from the start of the first concatenated document.
Alignment, SWOT, and recommendations all see the same ten passages; they differ only in instructions, which is why the later stages read as rewrites of the earlier ones.
Citations are document-level labels (`Local/SNG plan`, `National plan`) that the browser matches to notes by regex, never a page or passage, and the national corpus's synthetic `supabase://` path fails the URL check so its note renders as "stored copy" with no link ([ai-citations.ts](../src/components/analytics/ai-citations.ts)).
For Nepal, "local plan alignment" is province-level by construction because seven province plans serve every one of its municipalities.

The model call itself is unguarded.
No `temperature`, `max_output_tokens`, `text.format`, or timeout is set; output validation is "non-empty text"; the browser then parses headings and `^\d+\.` blocks with regular expressions ([openai.ts](../src/lib/ai/openai.ts); [ai-result-renderers.tsx](../src/components/analytics/ai-result-renderers.tsx)).
The `waterfalls` (contribution deltas per component) that the app already computes are carried in the context and never used by any prompt.
Plan passages and web page text are pasted into the user prompt without delimiters, which leaves the governance policy's prompt-injection red-team case unaddressed ([prompts.ts](../src/lib/ai/prompts.ts); [governance policy](../docs/roadmap/LDT-AI-Governance-and-Evidence-Policy.md)).
`ai_stage_runs` has `token_usage` and `estimated_cost_usd` columns that nothing writes, so every cost figure in this report is an estimate from the prompt builders: about **$0.012 to $0.021 per full brief** at gpt-4.1-mini list prices, roughly $40 to $70 for all 3,000-odd unit-and-theme briefs, plus about $0.012 per brief in Exa fees if web context runs ([OpenAI model page](https://developers.openai.com/api/docs/models/gpt-4.1-mini); [Exa pricing](https://exa.ai/docs/reference/pricing)).
The same OpenAI page marks gpt-4.1-mini as deprecated, so a model swap, and with it a full rerun, is coming regardless of this redesign.

Tests cover the cache contract, citation resolution, export, and TLS fallback rules; nothing tests prompts, output structure, numbers, or neutrality, and the UI carries no disclaimer or review status although the repository's own governance policy requires both ([tests](../tests); [governance policy](../docs/roadmap/LDT-AI-Governance-and-Evidence-Policy.md)).
The one asset the current design has built without meaning to is the run store: every generation is persisted with prompt hash, input hash, and output, which is a regression corpus waiting for a read script.

## Public index tools explain places with ranked drivers, not prose

Son asked specifically about Darkhorse Analytics.
Darkhorse (now Darkhorse Visualization, Edmonton) has at least seven live index or profile tools, and **none of its projects, case studies, or blog posts mention AI or generated narrative** ([Darkhorse Solutions](https://darkhorsevisualization.com/solutions); [Darkhorse blog](https://darkhorsevisualization.com/blog)).
Their stated approach is a drillable hierarchy from headline rank down to indicator, plus printable or linkable reports.
The one Darkhorse artifact with a documented per-place report is the U.S. Climate Vulnerability Index built for EDF: select a tract, click "View Report", and the page shows score and rank, "Top Drivers of Overall Climate Vulnerability", a "Composition" block per category with definition, rating, and national percentile, an "Indicator Spotlight" with rank among peers at the same scale, and a toggle to change the geographic comparison frame ([CVI tutorial](https://climatevulnerabilityindex.org/tutorials/step3)).
EDF's Grace Tee Lewis explained the design intent: similar overall scores can mask very different vulnerability profiles, so the breakdown exists to reveal them ([Taproot Edmonton, Oct 2023](https://edmonton.taproot.news/news/2023/10/19/darkhorse-analytics-visualizes-us-climate-vulnerability)).
That section order, score and rank, then drivers, then composition, then a spotlight on one indicator, is a deterministic skeleton that maps onto LDT's three pillars built from 18 components with no translation needed.

The other public tools agree on the skeleton and add the honesty devices.
County Health Rankings places each county in Health Groups that "do not necessarily represent statistically significant differences", which is the right model for a rank among 806 Nepal municipalities, where rank 412 versus rank 420 means nothing ([KHI 2025 resource guide](https://www.khi.org/wp-content/uploads/2025/03/2025-County-Health-Rankings-Roadmaps-Resource-Guide.pdf)).
The SDG Index carries "Information unavailable" and "Trend information unavailable" as first-class dashboard states and warns that scores from one edition cannot be compared with another ([SDG Index Togo profile](https://dashboards.sdgindex.org/profiles/togo/); [SDG methodology](https://dashboards.sdgindex.org/chapters/methodology)).
The CVI documents its imputation rules with thresholds (no indicator more than 25 percent imputed, county values copied to every tract where finer data are missing), which is the same thing that happens when an LDT district-level indicator is applied to its municipalities ([CVI methodology](https://climatevulnerabilityindex.org/methodology/)).
OECD Regional Well-being lists "regions with similar well-being profiles" for every region, a nearest-neighbour peer set that needs no predefined peer group ([OECD Regional Well-being, Brussels](https://oecdregionalwellbeing.org/BE1.html)).
This is the external evidence for the coordinator's direction 5, and it is cheap: nearest neighbours over 116 to 806 units on 18 components plus context values is a server-side computation, not a model task.

Where the tools reach "what to do about it", only County Health Rankings' What Works for Health does so, and it does it by lookup, not generation.
WWFH files nearly 400 strategies under the same factors as the measures, each with an evidence rating on a six-step scale from Scientifically Supported to Evidence of Ineffectiveness and a separate disparity rating, so "weak measure X" resolves to "strategies filed under X" ([WWFH ratings, Jan 2024](https://www.countyhealthrankings.org/sites/default/files/media/document/What%20Works%20for%20Health%20Evidence%20and%20Disparity%20Ratings%2C%20Jan24.pdf)).
CVI's tutorial explicitly "does not give guidance on specific actions"; CORE Score delegates to a static final report; Opportunity Atlas warns against the obvious action ([CVI tutorial](https://climatevulnerabilityindex.org/tutorials/step3); [corescore.us](https://corescore.us/); [Opportunity Insights](https://opportunityinsights.org/wp-content/uploads/2018/10/atlas_summary.pdf)).
Nothing in this set generates free-text recommendations, and that absence is the strongest argument in the notes against the current SWOT and recommendations stages.

The regulators frame the risk precisely.
The UK Office for Statistics Regulation lists hallucination, training bias, opacity, and erosion of trust as the risks of AI in official statistics and names "production of non-technical summaries" as a use it monitors ([OSR blog](https://osr.statisticsauthority.gov.uk/blog/our-current-position-on-regulating-responding-to-and-using-ai/)).
The OECD's July 2026 blog on data quality asks what happens to trust when AI sits between institutions and the public and warns that "detaching figures from their source" erodes it ([OECD blog](https://www.oecd.org/en/blogs/2026/07/protecting-data-quality-in-the-ai-era-of-official-statistics.html)).
LocalBench measured 13 LLMs on U.S. county-level local knowledge and found the best model scored **56.8 percent on narrative-style questions**, with descriptions of non-iconic places often generic or stereotyped ([LocalBench](https://arxiv.org/html/2511.10459v2)).
Most of Nepal's municipalities are places no model has read about; that number is the specific risk behind the web-context stage and behind any sentence the model writes from memory rather than from the fact sheet.

## Every narrative product computes facts first and lets the model only verbalise

Tableau Pulse's Insights Platform uses "standardized, deterministic statistical models" that detect facts about a metric that are "guaranteed to be accurate", ranks them by impact, and only then lets AI write a summary from the selected facts ([Tableau Help](https://help.tableau.com/current/online/en-us/pulse_insights_platform_insight_types.htm)).
Its deterministic insight types read like a specification for LDT's first section: Period Over Period Change, Current Trend, Top Drivers, Top Detractors, Unexpected Values relative to a baseline range, Top and Bottom Contributors.
Power BI's Copilot narrative takes only what is on the report canvas, and each claim carries a footnote that highlights the visual it refers to; Power BI's older Smart Narrative hides a value when the filters produce no result rather than inventing text ([Microsoft Learn, narrative](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-create-narrative); [Microsoft Learn, smart narrative](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-smart-narrative)).
Looker lets Gemini choose fields and filters but "Looker composes and runs the query from the LookML model" ([Google Cloud](https://docs.cloud.google.com/looker/docs/conversational-analytics-overview)).
Arria sells deterministic NLG as the accuracy baseline that LLM generation layers on top of ([Arria 2025 white paper](https://www.arria.com/wp-content/uploads/2026/03/WP102-Converging-Technologies-2025.pdf)).
Datawrapper, a journalism-grade chart tool, ships no generated insights at all ([ki-syndikat review](https://www.ki-syndikat.de/tools/datawrapper/)).
No product lets the model do arithmetic on raw rows and present the result as narrative.

The research says why.
Numeric hallucination is the dominant table-to-text error class; TabFaith's 2,400-example benchmark catalogues "hallucinating numerical values", misattributed rows, and "fabricating comparative rankings", and shows that BLEU correlates with human faithfulness judgments at only r = 0.24 while a cell-anchored NLI metric reaches r = 0.94 ([TabFaith, ACL 2026](https://aclanthology.org/2026.surgellm-1.21/)).
The mitigations with measured effect are all post-hoc, claim-level checks against the source cells: TabFaith's CAVE, a training-free post-processor that links claims to cells and regenerates unsupported spans, improves faithfulness by **+0.14 on average and +0.17 on numerical errors**; ChaTS-Pi scores a summary "one sentence at a time" and removes unsupported sentences ([TabFaith](https://aclanthology.org/2026.surgellm-1.21/); [ChaTS-Pi](https://arxiv.org/abs/2405.19094)).
Proof-Carrying Numbers, from a World Bank author, goes further: numeric spans are emitted as claim-bound tokens, the renderer verifies each under a policy of exact match, rounding, or tolerance, and "only claim-checked numbers are marked as verified", so the default is fail-closed ([PCN, arXiv 2509.06902](https://arxiv.org/abs/2509.06902)).
A 2025 TMLR paper reports that factual inconsistency in data-to-text grows with model size and fine-tuning data, so a bigger model is not the fix ([ISI Kolkata, TMLR 2025](https://digitalcommons.isical.ac.in/journal-articles/5364)).
The NAACL 2025 insight pipeline is the cleanest supporting result: a manual review of 58 summaries "found no LLM hallucinations in summarizing or transcribing SQL results", with the errors coming from the SQL-generation step instead ([arXiv 2503.11664](https://arxiv.org/html/2503.11664v1)).
Keep the arithmetic in reviewed TypeScript and the model's failure modes shrink to wording.

Provider features help but do not substitute.
OpenAI structured outputs guarantee that a response matches a JSON Schema in strict mode and work in the Batch API, but the page never claims content correctness ([OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)).
A schema in which each sentence carries `fact_ids: string[]` gives claim-level citation on the existing OpenAI stack; a Zod validator on the server makes it provider-neutral.
Anthropic's Citations API returns guaranteed-valid pointers into supplied documents but cannot be combined with structured outputs and does not cover scanned PDFs, so it is not a reason to switch providers for this feature ([Anthropic Citations](https://platform.claude.com/docs/en/build-with-claude/citations)).

The style evidence is as concrete as the architecture evidence.
UK Government Statistical Service guidance says to describe change by direction, absolute size, and relative size, compare against at least two reference points, call movement within natural variation "broadly stable" or "indicative", separate "what we can conclude" from "what we cannot", and avoid stand-alone caution phrases that readers learn to ignore ([GSS, communicating uncertainty](https://analysisfunction.civilservice.gov.uk/policy-store/communicating-quality-uncertainty-and-change/)).
OSR found that "figures should be treated with caution" became so overused that readers skip it, that "no evidence of a difference" gets read as "evidence of no difference", and that the best practice on ranks is the Welsh Index of Multiple Deprivation's list of what ranks can and cannot be used for, including the ban on inferring absolute change over time ([OSR, presenting uncertainty](https://osr.statisticsauthority.gov.uk/publication/approaches-to-presenting-uncertainty-in-the-statistical-system/pages/3)).
A sentence that satisfies all of this is computable from LDT's existing series: "Prosperity scored 58 in 2025, 4 points above the national average (54) and 2 below the province average (60); it rose 6 points since 2021, the largest rise among the three pillars."
Direction, size, two comparators, and relative size, with every number a fact id.
Causal words ("because", "driven by") should be forbidden unless the fact sheet carries a compositional driver fact, which is what Tableau's Top Drivers is.

## Plan alignment tools classify passages, cite pages, and keep judgement human

Every mature plan-to-goal tool separates three things the LDT currently fuses into one call: a classifier from passages to goals, a coverage view, and a human step for priorities.
UNDP's Integrated SDG Insights uses a bag-of-words shallow network chosen "for an increased interpretability and transparency", reaches **90 percent macro precision but only 75 percent recall**, states its assumption openly ("the amount of text linked to an SDG correlates with how important that SDG is"), normalises to a 0-to-1 salience with high, medium, and low tiers, and overlays priority tier against SDG trend status so users "see which SDGs might be low priority but off-track and vice-versa" ([UNDP Methodological Note v1.4](https://data.undp.org/sites/g/files/zskgke476/files/2023-11/Methodology.pdf)).
That overlay, plan salience on one axis and LDT score status on the other, is the shape a municipal alignment view should take; it answers "where is the plan silent while the score is weak", which is the question a planner needs.
The European Commission's JRC SDG Mapper is keyword-based; in 2025 LLMs were used only to suggest keywords, growing the list from 3,400 to 4,903 entries, followed by expert review and a test over 50,000 documents to confirm counts did not inflate ([JRC KnowSDGs](https://know-sdgs.jrc.ec.europa.eu/methodology-policy-mapping)).
SEI's SDG Synergies scores target interactions through a participatory process and warns "there is no short-cut and the result is only as robust as the information in the matrix" ([SEI](https://www.sei.org/tools/sdg-synergies/)).
UNDP's 2018 AI-assisted Rapid Integrated Assessment used paragraph embeddings against SDG target concepts and cut assessment time from weeks to days, but published no precision figures ([Galsurkar et al., AAAI 2018](https://ojs.aaai.org/index.php/AAAI/article/view/11424)).

Government document-analysis tools set the realistic accuracy ceiling.
i.AI's Consult runs theme generation and theme mapping with a human checkpoint after each; the Scottish Government evaluation reports multi-label **F1 of 0.76** against expert reviewers, median review time of 23 seconds per response, and the honest finding that "Consult struggled to identify missing themes" ([Consult evaluation](https://digitalgovernmenthub.org/wp-content/uploads/2026/02/Scot_Gov_NSCP_Evaluation_Report.pdf)).
The same report cautions that two human reviewers disagreed on exact mappings 40 percent of the time.
So a model mapping plan commitments to LDT components will agree with an expert about three-quarters of the time, experts will disagree with each other almost as often, and the thing it will miss is absence.
The brief therefore needs an explicit "plan is silent on X" output, presented as a reviewable draft with a confidence tier, not a claim of correctness.
Singapore's Pair keeps politically sensitive content human-written, and a 2025 study found that the language used to query a model shifts its political stance, which matters directly when the same plan might be analysed in Nepali or Serbian ([MDDI reply](https://www.mddi.gov.sg/newsroom/28022023/); [arXiv 2505.04393](https://arxiv.org/abs/2505.04393v1)).

The grounding technique that holds up is quote-then-verify.
The 2026 "Traceable by Design" EU consultation pipeline requires every extracted topic to carry a verbatim quote "with no paraphrasing, no shortening, no normalisation, and no correction", enforces that with a Pydantic schema, and verifies each quote by exact and fuzzy string match, reaching a **99.1 percent match rate** with the remainder flagged as potential hallucinations ([Bertaglia et al., arXiv 2605.30995](https://arxiv.org/abs/2605.30995)).
Its authors conclude that "OCR and chunking are the real bottlenecks" and that "no prompt refinement recovers a position paper whose columns were read across rather than down"; they recommend sampling documents by hand before a full run, retaining intermediate outputs at every stage, and versioning the prompt with the code.
This pattern is provider-neutral, costs nothing beyond a string comparison, and should run on every quote the brief displays.
OpenAI's file search, by contrast, returns file-level citations under the Responses API with no way to recover the chunk, so it is the wrong tool for page citations ([OpenAI community thread](https://community.openai.com/t/file-search-annotations-reference-a-file-rather-than-a-chunk/1367438)).

Nepal and Serbia make OCR the hard part.
On 600 scanned Nepali government notices, GPT-4o's exact-match accuracy was 0.55 for dates, 0.25 for subject, and 0.66 for signatory, and the authors note LLMs have "difficulty in localizing the extracted tokens back to their exact positions in the original document" ([CHiPSAL 2025](https://aclanthology.org/2025.chipsal-1.13)).
A 2026 Devanagari OCR stress test found clean synthetic text looked fine across systems while real scans caused sharp degradation, with chrF++ on real scans of 86.3 for Gemini, 82.2 for Claude, and 58.5 for GPT-5.5 (single preprint, treat as indicative) ([arXiv 2606.29213](https://arxiv.org/pdf/2606.29213)).
Serbia's own legislation digitisation reported "initial challenges with OCR accuracy for Serbian Cyrillic, poor scan quality, and complex legal formatting" ([OECD.AI Serbia entry](https://oecd.ai/en/dashboards/policy-initiatives/digiteks-application-of-ai-for-understanding-the-serbian-language-and-digitalization-in-the-field-of-legislation)).
UNDP's translate-then-classify approach kept 91 percent of priority tiers unchanged across 14 bilingual reports, which supports machine translation for coarse coverage tiers but is no evidence that page-level quotes survive translation ([UNDP Methodological Note](https://data.undp.org/sites/g/files/zskgke476/files/2023-11/Methodology.pdf)).
The practical rule: keep the quote in the source language so it can be string-matched, translate only for display, and cite at page level for scanned documents since sentence spans are trustworthy only where OCR quality has been checked.
Today nothing in LDT records whether a plan parsed to text, came back empty, or hit the Exa fallback; `extractionMetadata` in `ai_document_contexts` would answer it, and no read script exists.

On recommendations, the clearinghouses refuse to generate them.
3ie's evidence gap maps "do not provide recommendations for policy and programming" ([3ie](https://3ieimpact.org/evidence-hub/evidence-gap-maps)).
J-PAL's generalizability framework insists the first steps, diagnosing the local problem, "need to be answered using local descriptive data as well as qualitative interviews and local institutional knowledge", with evidence from elsewhere only entering later ([J-PAL](https://povertyactionlab.org/node/4560)).
The World Bank's own ImpactAI constrains answers to a curated base of 15,000 trials, traces every effect to its source, and "flags where evidence is thin" rather than filling the gap ([World Bank DIME](https://www.worldbank.org/en/about/unit/unit-dec/impactevaluation/ai)).
PDIA's warning about "isomorphic mimicry", reforms that change how institutions look but not what they do, is the long-form version of the same point ([Andrews, Pritchett, Woolcock](https://www.hks.harvard.edu/centers/cid/publications/faculty-working-papers/escaping-capability-traps-through-problem-driven-iterative-adaptation-pdia)).
And on the SWOT itself, Hill and Westbrook's review of 50 companies found that among those using SWOT "no-one subsequently used the outputs within the later stages of the strategy process" ([Hill and Westbrook, 1997](https://ora.ox.ac.uk/objects/uuid:e44a6a9e-9537-4fb6-848c-2d20998a7ce6)).
No study anywhere evaluates an LLM-generated SWOT, in government or elsewhere.
The quadrants most likely to read as prescription from a World Bank tool, weaknesses and threats, are also the ones a model fills by rewording the score table.

## Precomputed, reviewed, labelled output is the public-sector pattern

The products that run multi-step generation converge on one shape: a single run, an optional plan the user can edit up front, a live progress trace, and one final report with citations the user can then question.
Gemini Deep Research produces "a multi-step research plan for you to either revise or approve" and then a report; OpenAI's version lets users review the plan, watch progress, and change which sources it may use mid-run; Elicit calibrates on a 10-paper pilot before "Run the full extraction" ([Google blog](https://blog.google/products/gemini/google-gemini-deep-research/); [OpenAI help, via snippet](https://help.openai.com/en/articles/10500283-deep-research-faq); [Elicit support](https://support.elicit.com/en/articles/4267649)).
None gates later stages behind separate buttons.
Where products expose an intermediate decision, it is one cheap choice that changes the whole run (edit the plan, set a threshold), not "press next".
Cursor's forum threads about an agent that ignores its own to-do list are the cautionary tale: if LDT shows stage status, that status must come from the orchestrator, never from model self-report ([Cursor forum](https://forum.cursor.com/t/cursor-keeps-ignoring-its-own-to-do-list-and-never-marks-tasks-as-completed-is-this-normal/138667)).
The Vercel AI SDK's `useObject` streams partial structured JSON so a brief can render section by section, and Vercel Workflows runs multi-step logic as durable code that records every step input and output, which is where a live analyst regenerate belongs if one is kept ([AI SDK docs](https://ai-sdk.dev/docs/ai-sdk-ui/object-generation); [Vercel Workflows](https://vercel.com/docs/workflows)).

For a public, read-mostly audience, though, live generation earns its cost only for user-specific inputs.
OpenAI's Batch API gives a **50 percent discount**, completes within 24 hours and "often more quickly", accepts up to 50,000 requests per file, supports `/v1/responses` and structured outputs, and runs on a separate rate-limit pool ([OpenAI batch guide](https://developers.openai.com/api/docs/guides/batch)).
At current list prices (gpt-5-mini $0.25 input and $2.00 output per million tokens; gpt-5.4 $2.50 and $15.00), a release of about 1,100 municipalities at 1,500 input and 400 output tokens each, with a second verification pass of equal size, costs roughly **$2.60 synchronous or $1.30 in batch on gpt-5-mini**, and about $21 or $11 on gpt-5.4; these are arithmetic from the pricing page, not measurements ([OpenAI pricing](https://developers.openai.com/api/docs/pricing)).
Power BI stores the prompt with the report so the summary regenerates on load; Tableau Pulse generates on a schedule and delivers digests ([Microsoft Learn](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-create-narrative); [InterWorks](https://interworks.com/blog/2024/02/28/take-your-pulse-how-does-tableau-pulse-work/)).
The pattern for LDT is "stored output, refresh on data change": generate at release time, store the narrative with its fact sheet, per-sentence fact ids, model id, prompt version, and batch id, serve it statically from Next.js, and regenerate only when the content hash of the inputs changes.
Precompute is also what makes review before publication and whole-corpus regression evals possible at all; neither works when content appears for the first time in front of a public user.

Review and labelling have published templates.
The GOV.UK AI Playbook asks teams to "design, document and assess the stages when meaningful human review processes are incorporated", to "clearly signpost when AI has been used to create content", and to put feedback mechanisms in place so people can report factual errors ([GOV.UK AI Playbook](https://www.gov.uk/government/publications/ai-playbook-for-the-uk-government/artificial-intelligence-playbook-for-the-uk-government-html)).
The live Algorithmic Transparency Record for DSIT's Redbox shows the disclosure fields (owner, scope, human decisions and review, appeals, phase, model name and version, risks and mitigations) and describes a per-response footer that LLMs "may make mistakes", a five-star rating, and a monthly review of ratings ([GOV.UK ATRS: Redbox](https://www.gov.uk/algorithmic-transparency-records/dsit-redbox)).
The GOV.UK Chat experiment found some users "underestimated or dismissed the inaccuracy risks" because of the GOV.UK brand's credibility ([Inside GOV.UK](https://insidegovuk.blog.gov.uk/2024/01/18/the-findings-of-our-first-generative-ai-experiment-gov-uk-chat/)).
A World Bank badge will do the same for a SWOT, so the label and review status belong on the brief itself, not on a methodology page.
Google's Places API ships generated summaries with a mandatory "Summarized with Gemini" string and a link to flag a problem, which is the minimal shipped precedent for a label plus a correction path ([Google Places SDK reference](https://developers.google.com/maps/documentation/places/ios-sdk/reference/objc/Classes/GMSPlaceGenerativeSummary)).

On evaluation, the practitioner consensus fits a small team.
Hamel Husain's evals FAQ says to review at least 100 traces by hand before anything else, start with binary labels because Likert scales push annotators to the middle, "favor assertions or other deterministic checks over LLM-as-judge evaluators", keep a curated set of 100-plus examples in CI, build a separate judge per failure type and validate each against human labels, treat a multi-step pipeline as a black box first, and annotate only the first failure in a trace because later ones cascade ([hamel.dev evals FAQ](https://hamel.dev/blog/posts/evals-faq/)).
Shankar et al. showed that grading criteria drift as graders see more outputs, so the rubric needs a version next to the prompt ([arXiv 2404.12272](https://arxiv.org/abs/2404.12272)).
Eugene Yan's summarisation guidance expects 5 to 10 percent factual inconsistency even with retrieval and good prompting, and sets thresholds by stakes ([eugeneyan.com](https://eugeneyan.com/writing/evals/)).
Both batch APIs list "running evaluations" as a recommended use, which halves the cost of rerunning a golden set after every prompt change.

## The coordinator's directions survive the evidence, with two reorderings

The table judges each of the coordinator's seven directions, plus the extra fixes `current_ldt_pipeline.md` found in the code, against the external evidence above.

| Direction (coordinator's proposal) | External evidence for | Caveat the evidence adds | Verdict |
|---|---|---|---|
| 1. Precompute data-only parts per release | Batch pricing at 50 percent; Tableau and Power BI store generated output; review and evals need stored drafts | Build the context per unit without `getAnalyticsPageData` or pay 6.5 s times 3,200; a prompt edit or the pending model swap invalidates every row | Adopt, as the delivery model for the whole brief, not only the narrative |
| 2. Deterministic fact sheet, prose from fact ids, numeric verification | Every product; NAACL "no hallucinations summarising SQL results"; CAVE and PCN gains; GSS sentence rules | The verifier must handle rounded numbers and "above the national average" claims with no literal number; add rank bands and tri-state availability | Adopt first; it is the foundation for every other direction |
| 3. Ingest plans once into structured commitments with page citations | UNDP, JRC, Traceable by Design all parse once into a versioned store; 99.1 percent quote match | OCR and translation are the bottleneck, not prompting; Nepal's matrix is identical across a province; per-page output of pdf-parse is unverified | Adopt in two steps: page-indexed text plus relevance selection and quote verification first, commitment extraction second |
| 4. Structured recommendation objects with evidence chains | WWFH catalogue, J-PAL ordering, 3ie and ImpactAI posture; the v1.6 roadmap already specifies an evidence graph | Needs an intervention catalogue that does not exist; without it the model invents, as now; Consult's F1 of 0.76 is the agreement ceiling | Adopt the shape; ship "options tied to plan commitments or gaps" until a catalogue is curated |
| 5. Similar municipalities | OECD "regions with similar profiles"; CVI geographic context toggle | A fact-sheet feature, not a model feature; "what their plans prioritise" waits on direction 3; weight context features or neighbours by score are not peers by geography | Adopt inside the fact sheet |
| 6. Remove gates, stream sections, state missing inputs plainly | Deep Research "one run, one report"; Power BI omits a sentence when no insight exists; Consult's "missing themes" finding | With precompute the public needs no streaming; keep a streamed orchestrator for admin regenerate only; status must come from the orchestrator | Adopt, simplified: public reads stored sections, admins get one streamed run |
| 7. Evaluation harness, golden set, draft or reviewed status | Playbook, ATRS, Consult's pre-scale evaluation, Husain's deterministic-first order | Nondeterminism at default temperature makes text matches flaky; checks must be structural and numeric; reviewer edits are the cheapest failure corpus | Adopt; start with 100 hand-reviewed runs from the existing run store |
| Extras from the code study: context once per brief, fill `cachedStages`, cache national plan per country, relevance-select passages, set temperature and output limits and JSON format, record usage, reorder prompts for prefix caching, delimit pasted text | All are stack hygiene with no counter-evidence | Several become moot once the stages disappear; do the ones that survive (usage, JSON, delimiters, national cache, relevance selection) in week one | Adopt immediately |

Two reorderings follow.
The coordinator listed precompute first; the evidence says the fact sheet comes first, because precomputing today's prose would store the same unverifiable text more cheaply.
And direction 3 should be split, because the hard part is not the schema but getting trustworthy page-indexed text out of scanned Nepali and Cyrillic PDFs, which no prompt can fix after the fact.

The external evidence also adds things the seven directions did not name.
Rank bands instead of raw ranks (CHR).
A tri-state per indicator, reported with year and source, imputed or inherited from a higher tier, or unavailable and excluded (SDG Index, CVI, SVI's -999 rule), with the count of each stated before the pillar is narrated ([SVI 2022 documentation](https://www.atsdr.cdc.gov/place-health/media/pdfs/2024/10/SVI2022Documentation.pdf)).
GSS sentence patterns and a "broadly stable" threshold derived from the series' own year-to-year noise.
An explicit "the plan is silent on" output.
Quotes kept in the source language and verified by string match.
A per-section "report a problem" control whose reports become eval cases.
An edition warning inside the brief, since SDG Index and OECD hide it in methodology and World Bank staff will compare years.

## Recommended design: five fixed sections on a fact sheet

The brief becomes one document per municipality and release, with the three pillars either as three tabs or three parallel columns, generated in batch, stored in Supabase, and served statically.
A header block states the status in plain words ("AI-assisted draft, not yet reviewed" or "Reviewed by the Nepal country team on 12 November 2026"), the data edition, the model id, the prompt and rubric version, and a link to a methodology page written like an ATRS record.
A footer carries the edition warning and the rank guardrail text.

Section one, position and drivers, is the Darkhorse CVI skeleton rendered from the fact sheet.
It states the pillar score, its rank band nationally and within the province or district (upper third, mid group, lower third, never a raw rank), the change since the first release year with the GSS sentence pattern and the "broadly stable" threshold, the two or three components that contribute most to the gap against the province and national averages (from the `waterfalls` the app already computes), the data coverage line ("four of five indicators reported for 2025; one inherited from the district"), and the three to five most similar municipalities by indicator profile with one line on where they differ.
The model's job here is connective prose over a templated core.
Every number renders as a span bound to a fact id; the verifier marks matched numbers as checked and unmatched ones visibly, PCN-style, and a sentence whose fact ids do not resolve is dropped, not shown.

Section two, what the plan commits to, lists the commitments extracted from the municipality's plan (province plan for Nepal, stated as such) that map to the pillar's components, each with a verbatim quote in the source language, the page number, a display translation where needed, and a confidence tier.
Commitments live in a plan store populated once per document, not read per request.
If the plan has no text layer, failed OCR quality checks, or has not been ingested, the section says so in one sentence and stops.

Section three, coverage gaps, is the UNDP overlay turned into a table: the pillar's components as rows, plan salience (high, medium, low, silent) against score status (strength, watchpoint, unavailable).
The cells that matter are "weak and silent", and the section names them in prose with the component's fact id and the absence of any matching commitment.
This replaces the alignment narrative and the SWOT.

Section four, options, selects from a closed vocabulary.
Each option is either an existing plan commitment whose scope could extend to a weak component, or a catalogue entry (once Son's team curates one, with WWFH-style evidence ratings and a "who benefits" field) tied to a gap.
Each option cites the fact ids and commitment ids it rests on, carries a confidence tier and a "how to know it worked" line, and never states cost, approval, or a project the plan does not mention.
Until a catalogue exists, this section contains only the first kind, and its heading says "options to investigate", not "recommendations".

Section five, open questions for the municipality, lists what the model cannot know: the local diagnosis J-PAL puts first.
It is templated from the gaps ("Why is road density low while the plan budgets for roads on page 41?") and is the honest place for everything that would otherwise be a speculative "threat".

Around the document sit three features.
A per-section "report a problem" control with a free-text reason, logged against fact ids, model, and prompt version.
A print and Markdown export that carries the same header and footer.
And, later and analyst-only, "ask this brief", grounded on the reviewed brief plus its evidence set with a refusal when the answer is not there.

## Drop the SWOT, the buttons, and public web search

The SWOT goes.
It restates the score table and the alignment matrix in a format whose outputs, per the only empirical review, nobody uses downstream, and its weaknesses and threats quadrants are the parts a World Bank tool should not let a model write.
If familiarity demands a SWOT-shaped view, derive strengths and weaknesses from facts and leave the other two quadrants empty rather than filled.

The seven routes, the seven buttons, `runPlanningContext`, `buildStageActions`, the `stageRouteMap`, the blocked-state notes, and the ordering trap where web context only counts if run first all go.
The public page reads stored sections; one admin route (or Vercel Workflow) runs a full regenerate with status reported by the orchestrator.

The free-text recommendation template and its `^\d+\.` regex parser go, replaced by structured output validated with Zod.
The heading and bullet regex parsers and the label-substring matching that pairs narrative bullets with indicators go with it.
"First ten passages" goes, replaced by relevance selection over page-indexed text.
gpt-4.1-mini goes because OpenAI has deprecated it; the replacement is a decision for Son.
The synthetic `supabase://` path for the national corpus goes, since it breaks the citation link.

Web search leaves the public brief.
One fixed query of LDT vocabulary ("Prosperity Score", the unit label) against Exa with no domain, date, or language filter mostly returns the plan PDF itself or generic pages, it is the stage most likely to inject unverifiable claims under the Bank's brand, and LocalBench's 56.8 percent says the model will fill gaps with stereotypes.
If web context survives at all, it is an analyst-only action with a visible "as of" date whose results appear as cited quotations, never as summarised recollection.

What stays: the run store and its cache contract, `ai_document_contexts` as the base of the plan store, the export, the citation note resolver (reworked to resolve fact ids and page ids rather than labels), the evidence gap badge (carried into each section), and the governance policy's block conditions, which the new design finally honours.

## A six-phase plan, each phase leaving something you can check

**Phase 0, hygiene and the first hundred traces, about a week.**
Set `temperature`, `max_output_tokens`, and `text.format` in `generateOpenAiText`; write the Responses API `usage` field into the `token_usage` and `estimated_cost_usd` columns that already exist; wrap pasted document and web text in delimiters with an instruction to treat it as data; cache `national_plan_context` per country and theme rather than per municipality; fill `cachedStages` from `loadLatestAiStageCacheByScope` so the production gate becomes coherent.
Add a read script over `ai_stage_runs` and `ai_document_contexts` that dumps the last hundred completed runs and every document's `extractionMetadata`.
Verifiable artifact: a spreadsheet of 100 hand-labelled runs (binary labels per failure mode: wrong number, invented plan claim, unresolved citation, generic recommendation) and a per-country table of which plan URLs fetched, parsed to non-empty text, or fell back to Exa.
This is the evidence base for everything after it, and it is the cheapest thing in the plan.

**Phase 1, the fact sheet and verified section one, two to three weeks.**
Write a pure TypeScript fact builder with stable ids (`npl.2025.<unit>.prosperity.component.<id>.value`, and so on) covering per-component values by year, province and national comparators, waterfall contributions, rank bands, change since first year with a noise-derived "broadly stable" threshold, the tri-state availability per indicator, and nearest neighbours over scaled components and context values.
Build it from the generated JSON and a narrow Supabase query, never from `getAnalyticsPageData`.
Write a deterministic template renderer for the core sentences and a structured-output prompt whose schema is sentences with `fact_ids`, then a verifier that extracts every number and comparison phrase and matches it to the fact sheet under a rounding policy.
Verifiable artifact: fact sheets for every unit in all three countries checked into a fixture, a golden set of 30 to 50 units spanning score extremes, missing-data cases, and units with and without plans, and `node --test` checks that every number in every generated sentence resolves to a fact.

**Phase 2, precompute and serve, one to two weeks.**
Add a `brief_sections` table (or extend `ai_stage_cache`) keyed by country, release, unit, theme, section, with `review_status` (`draft`, `reviewed`, `withheld`), reviewer role, review date, model, prompt version, rubric version, batch id, and the input content hash.
Write a batch script that builds requests for a release, submits one OpenAI Batch per section type, reads results back by `custom_id`, runs the verifier, and upserts.
Serve the stored sections from the analytics page with the header and footer; delete the per-stage routes.
Verifiable artifact: one country's briefs generated in batch for under a dollar, visible on the public page with no `/api/ai` call, and a diff report between two batch runs of the same release.

**Phase 3, the plan store, three to five weeks depending on OCR.**
Verify whether pdf-parse returns per-page text; if not, switch extraction to a per-page path.
Ingest each document once into page-indexed text with a language flag, an OCR quality flag (Traceable by Design's garbled-page and boilerplate rules), and a status of `text`, `scanned_needs_ocr`, or `failed`.
Add relevance selection by theme over pages.
Then add commitment extraction with verbatim quote, page, and mapped components, verified by exact and fuzzy match, and the coverage matrix.
Verifiable artifact: ingest tables, a per-country report of document status counts and quote match rate (target above 99 percent, following Bertaglia et al.), and section two and three rendered for the golden set with every quote clickable to a page.

**Phase 4, options and open questions, two weeks plus catalogue time.**
Ship the options section with the closed vocabulary of plan commitments and the forbidden-claim checks (cost, approval, NPV, "the plan says" without a page).
Template the open-questions section from the gap matrix.
If Son approves a catalogue, define its schema (intervention, component, evidence rating, outcome studied, source, who benefits, how to know it worked) and let the country teams fill it; the model then ranks from it.
Verifiable artifact: zero options in the golden set that cite no commitment or catalogue id, confirmed by a test.

**Phase 5, review console and eval harness, two to three weeks.**
A reviewer view that shows each section with its fact ids and quotes, lets a named reviewer edit and mark `reviewed`, and stores the edit as a diff.
A promptfoo config or short script in CI that runs the deterministic checks on the golden set whenever a prompt, schema, or model changes, and one or two LLM judges per release for the subjective failures (unsupported claim, generic option), each validated against the expert labels.
Per-section "report a problem" on the public page, written to the same table as the labels.
Verifiable artifact: CI fails on a prompt change that breaks a numeric check; an edit-rate-per-section number after the first review round.

**Phase 6, optional live features.**
An admin-only streamed regenerate for one unit on Vercel Workflows or a single long route, with status from the orchestrator.
"Ask this brief" grounded on the reviewed evidence set, labelled as unreviewed live output.
Compare two units from stored sections with at most a short generated synthesis.
No what-if scenarios for the public; the evidence set contains no causal estimates and the Playbook's overtrust finding applies.

## Decisions Son needs to make

**Who may trigger generation.**
The recommendation is precomputed and reviewed only for the public, with live generation for admins.
Keeping public live generation means accepting unreviewed output under the Bank's badge and a cost that scales with visitors rather than with releases.

**Whether any SWOT survives.**
The evidence says drop it.
If a stakeholder insists, the fallback is two derived quadrants and two empty ones.

**What happens to web context.**
Drop from the public brief, keep as an analyst action with cited quotations, or precompute with an "as of" date.
The first is the recommendation; the third is the only acceptable public form.

**Whether to fund an intervention catalogue, and who curates it.**
This is domain work for the country teams, not code, and without it the options section stays limited to plan commitments.
The decision shapes how much the brief can ever say about "what to do".

**How to handle Nepali and Serbian plans.**
Options are an OCR vendor plus machine translation for extraction with quotes kept in the source language, or an explicit "not analysed" state for scanned documents until a budget exists.
No benchmark covers these specific documents, so a hand-sampled pilot of ten plans per country should precede the choice.

**Which model replaces gpt-4.1-mini, and whether to stay OpenAI-only.**
Structured outputs plus the Batch API on OpenAI cover every mechanism in this design; quote verification by string match replaces the need for a provider-native citation API.
gpt-5-mini in batch is the cheap default; the golden set decides whether a larger model earns its cost.

**Who the named reviewer is per country, and what "reviewed" means.**
The ATRS pattern wants a role and a date on the page; whether names appear is a Bank communications question.

**Schema authority.**
Phases 2 and 3 add tables.
The alternative of stretching `ai_stage_cache` and `ai_document_contexts` works for Phase 2 but not for commitments with pages.

**Which Nepal unit count is right.**
The generated data and the roadmap say 751 units, the brief text says 806, and Supabase may hold 806; the fact builder needs one answer.

## Decisions settled on 29 October 2026

Son settled the decisions above on 29 October 2026, one at a time.
Rows that differ from this report's recommendation say so.

| # | Decision | Settled |
| --- | --- | --- |
| 1 | Who triggers generation | Precomputed per release for the public; admins regenerate one unit; a grounded Q&A follows later. |
| 2 | Live assistant | A data assistant answers questions about the data, the methodology, and a brief's reasoning, only through tools that read the app's own data, with every number linked to its fact. It refuses advice and what-if questions and points to the brief's open questions. Analysts first, the public once it passes the golden set. Every answer is labelled as unreviewed live output with a problem-report link. |
| 3 | Review | Every brief is reviewed before it is public, which is stricter than the sampled review this report would allow. The page shows the reviewer's role and date. The review queue runs golden set first, then units with a local plan, then the rest. |
| 4 | Before review | The public sees only code-generated parts (templated position and drivers, the plan document list and its status) with the AI sections marked "in review". Signed-in analysts see full drafts labelled unreviewed. |
| 5 | SWOT | Dropped. Coverage gaps and open questions replace it. A strengths-and-weaknesses view from the fact sheet is the fallback if a stakeholder asks. |
| 6 | Web context | Leaves the brief and becomes an analyst assistant tool limited to an allowlist of sources, with results shown as dated quotations. |
| 7 | Ranks | Bands first, using the map legend's five classes. The brief uses bands only, the map profile shows the band and then the rank, and the ranking table keeps ranks with shared ties. |
| 8 | Nepal unit count | 751. The 55 extra units in Supabase are boundary slivers (below). Guard in the app now, fix at the source, and add a data check script. |
| 9 | Intervention catalogue | None in the first release; the options section is titled "Options to investigate" and lists extensions of plan commitments only. A catalogue seeded from 3ie, J-PAL, and IEG evidence and curated by people is built alongside, with its schema defined now. |
| 10 | Nepali and Serbian plans | Measure first: Phase 0 inventories every plan (fetch, text layer, language) and hand-checks ten per country. Text-layer only until then, with OCR and translation chosen per country afterwards. Quotes stay in the source language, and translations are labelled as machine translation. |
| 11 | Model, libraries, tables | OpenAI only, with `gpt-5.6-luna` as the default instead of this report's `gpt-5-mini`, and the Batch API for releases. Add `ai`, `@ai-sdk/openai`, and `zod`. New tables go in as numbered migrations, applied to a Supabase branch first and to production only on Son's approval; no existing table changes beyond writing the usage columns it already has. |
| 12 | Owners | Son's team owns country review, the score pipeline fix, and catalogue curation until named roles exist. |
| 13 | Section one | Settled on 30 October 2026, after Phase 1. Section one, position and drivers, is code-only for good: no model draft and no review queue. On the golden set the model's draft mostly rephrased the code-only text, so it added review time without adding content. |
| 14 | Admin | Settled on 30 October 2026, during Phase 3b. Son is the only admin, and everyone else is a public reader. The review console runs only on Son's local dev server; the deployed site has no sign-in, no analyst list, and no drafts. This replaces decision 4's analyst drafts, and the page shows the review date without a reviewer role (decision 3). Phase 6's analyst-only assistant needs its own access decision when it is built. |

`gpt-5.6-luna` was checked against [OpenAI's model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna.md) on 29 October 2026.
It supports the Responses API, the Batch API, structured outputs, and function calling, at $0.20 input, $0.02 cached input, and $1.20 output per million tokens.
The page lists no batch price; third-party listings show the usual half price.
At the per-unit token estimates in the research notes, a release's narrative sections cost about the same as on `gpt-5-mini`.

### The 55 Nepal units without boundaries

The live Supabase data has 806 Nepal units for 2025, and the boundary file has 751.
Each of the other 55 shares its name with a mapped unit but sits in a neighbouring district, such as Kirtipur under Nuwakot or Bhaktapur under Kathmandu.
Each carries its own scores, and 54 of them differ from the mapped unit's.
Several are extreme: "Parsa, Rautahat" scores 79.8 on prosperity against 48 for Parsa in Bara, and two such units rank 4th and 5th nationally.
The pattern fits slivers from overlaying two boundary sets that don't line up, where per-area indicators inflate on tiny areas.
The generated fallback data in the repository already has the correct 751.
`scripts/check-unit-boundaries.mjs` lists them; 8 of the 55 have a row in Supabase's `municipality_boundaries` table even though the app's boundary file has no feature for them.

### Phase order after the decisions

The six phases above stand, with these changes.

- **Before Phase 0, two follow-ups to the analytics workspace.** Rank bands in the map profile and the beeswarm labels. The sliver guard: ranks, counts, medians, and the beeswarm count only units with a boundary, and a note under the ranking table names the excluded units. A data check script lists any unit without a boundary.
- **Phase 0** adds the plan inventory and the ten-per-country hand check, and changes the `OPENAI_MODEL` default to `gpt-5.6-luna`.
- **Phase 1** adds `ai`, `@ai-sdk/openai`, and `zod` for structured output.
- **Phase 2** serves the code-only parts to the public: section one and the plan document list. After decision 13 no model-written section exists until Phase 3, so the section store, batch generation, analyst sign-in, and the review console move to Phase 3, where the first one appears. Analyst access needs sign-in, which the app doesn't have; today there is only the `AI_GENERATION_ENABLED` flag and an `AI_ADMIN_TOKEN`.
- **Phase 3** ingests text-layer plans only; OCR and translation follow per country after the inventory. It also builds the section store, batch generation, sign-in for analysts, and the review console, since sections two and three are the first the model writes.
- **Phase 4** ships options from plan commitments only, defines the catalogue schema, and starts catalogue seeding as its own workstream.
- **Phase 5** keeps the evaluation harness and the problem reports.
- **Phase 6** builds the data assistant for analysts, with the allowlisted web search as one of its tools, opens it to the public once it passes the golden set, and adds the admin regenerate for one unit.

## Open risks

OCR and translation are the risk with no mitigation in the evidence beyond "sample by hand first".
The Nepali figures above come from notices, the Serbian ones from dictionaries and laws; municipal plans could be better or worse, and a column read across rather than down produces confident nonsense that no verifier catches because the quote does match the garbled text.

Plan coverage is thinner than it looks.
Nepal's seven province plans mean every municipality in a province gets the same sections two and three; Serbia has 28 non-PDF URLs; nobody has yet measured which of the 273 URLs fetch and parse.
Phase 0's read script answers this before any schema is built.

Commitment mapping has an agreement ceiling around F1 0.76, experts disagree among themselves 40 percent of the time, and missed commitments are the likely error, so a "silent" cell in the coverage matrix will sometimes be wrong in the direction that matters most.
Confidence tiers and the review step are the only answers.

The options section is only as good as the catalogue, and a thin catalogue produces a thin section; the temptation will be to let the model fill it, which recreates the current problem.

Brand overtrust is real and was measured at GOV.UK; the label mitigates it, nothing eliminates it.

A prompt or model change invalidates every stored section, which is cheap in dollars and expensive in review hours; storing reviewer edits as diffs and rerunning the golden set first limits the damage but does not remove it.

Every cost and latency number here is derived, because the pipeline has never recorded token usage; Phase 0 fixes that, and the first batch run will correct the estimates.
Vercel's cap on `maxDuration` for the account tier and OpenAI's real batch turnaround were not verified.

Query-language effects on model stance, documented for political questions, could make a Serbian-prompted extraction emphasise different commitments than an English one; keeping extraction prompts in English with source-language quotes limits this but is untested on plan documents.

Finally, the research itself has gaps.
Several primary pages (OpenAI help centre, County Health Rankings county pages, the OECD blog) returned 403 and were read through snippets or secondary summaries; no field study of an LLM-written place brief in a shipped public-sector tool exists; and no stored LDT brief was read, so the current pipeline's actual error rate is unknown until Phase 0 runs.

## Conclusion

The most useful thing the external evidence does is reframe the brief from an LLM feature into a data product with a thin language layer.
Darkhorse, County Health Rankings, UNDP, and the BI vendors all arrived at the same division of labour independently: code decides what is true and what is ranked, humans decide what is recommended, and the model writes the sentences in between.
Under that framing most of the brief's current cost, latency, and risk comes from asking the model to do the first two jobs, and most of the redesign is moving those jobs into TypeScript and Supabase where they can be tested.

The second shift is in where the hard problems sit.
They are not in prompting.
They are in getting page-indexed text out of scanned Nepali and Cyrillic PDFs, in curating an intervention catalogue that country teams will stand behind, and in finding reviewers with the hours to mark 3,000 sections as reviewed.
Those are budget and staffing decisions, which is why the plan front-loads a week of reading the run store and the document metadata: it turns every one of them from a guess into a count before anyone commits to a schema.
