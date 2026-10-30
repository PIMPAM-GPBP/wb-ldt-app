# Multi-step LLM output UX, precompute vs live, review, evals, and trust labels

Research notes for replacing the LDT planning brief's "five stages behind five buttons" design.
Current as of 29 October 2026. Material older than 2025 is marked "(older)".
Stack note: LDT runs Next.js 16 on Vercel with Supabase and the OpenAI API. Vendor-specific patterns are flagged.

Source quality note: several primary pages (OpenAI help center, OpenAI batch FAQ) returned HTTP 403 to the fetcher, so their wording comes from search-engine snippets of those pages and is marked "via snippet". Everything else was read from the primary page.

## Key question 1: UX for multi-step generation

### Takeaway
The leading products converge on one shape: a single "run" with an optional up-front plan the user can edit, a live progress trace while it runs, and one final report with citations the user can then question or refine.
None of them gate later stages behind separate buttons; intermediate control, where it exists, is "approve or edit the plan" (Gemini, OpenAI, Cursor) or "calibrate on a pilot sample, then run the full set" (Elicit).

### Cited Findings
- Gemini Deep Research (Dec 2024 launch post, older) produces "a multi-step research plan for you to either revise or approve"; after approval it browses, refines repeatedly over "a few minutes", and returns "a report of key findings" with source links, exportable to Google Docs, with follow-up questions and refinement allowed afterwards. — [Google blog](https://blog.google/products/gemini/google-gemini-deep-research/)
- Current Gemini guides describe the plan as a card with "Edit plan" and "Start research" buttons; the editing step is where scope, date range, geography and inclusion criteria get corrected before any browsing. — [Solan Sync guide](https://solansync.beehiiv.com/p/how-to-master-gemini-2-5-pro-deep-research-from-planning-to-a-fully-cited-report); [ai-toolbox guide](https://www.ai-toolbox.co/gemini-management-and-productivity/how-to-use-gemini-deep-research-2026) (secondary)
- OpenAI Deep Research: before research begins ChatGPT "may ask clarifying questions", users "can review and edit its proposed research plan", and during the run users can "view progress in real time, interrupt the research to adjust focus" and change which sources it may use. — [OpenAI help center, via snippet](https://help.openai.com/en/articles/10500283-deep-research-faq)
- OpenAI's team added the clarifying-questions step deliberately because most users do not give complete requirements in a first prompt. — [Sequoia interview with Isa Fulford](https://inferencebysequoia.substack.com/p/how-openai-built-its-groundbreaking) (2025)
- Early coverage (2025) describes a sidebar listing search terms and sites visited while the run proceeds. — [DeepLearning.AI The Batch](https://charonhub.deeplearning.ai/openais-deep-research-agent-generates-detailed-reports-by-analyzing-web-sources/)
- Perplexity Deep Research runs iterative search-read-plan loops, shows status updates while running, typical runtime "2-4 minutes" (vendor claim), and shows citations at sentence level in the output. — [LLMPulse](https://llmpulse.ai/blog/how-perplexity-works/); [The Decoder](https://the-decoder.com/perplexity-uses-deepseek-r1-to-offer-deep-research-10-times-cheaper-than-openai/) (secondary)
- Elicit Systematic Review is a staged workflow (define question, gather, screen, evaluate screening, extract, report) where the AI proposes screening criteria and extraction columns, the user edits them, and runs are calibrated on a sample first: Elicit "randomly select[s] 10 papers as a 'pilot' set for faster column iteration" before "Run the full extraction". — [Elicit blog](https://elicit.com/blog/systematic-review); [Elicit support: extraction](https://support.elicit.com/en/articles/4267649)
- Elicit screening uses a "Score threshold" slider that the user adjusts to include or exclude more papers, plus a dual-review mode that surfaces "conflicts in screening judgements for reviewers to resolve". — [Elicit support: screening](https://support.elicit.com/en/articles/4267521)
- Elicit "always provides supporting quotes from the paper and an explanation" so users can verify each AI answer; users can "manually override any disagreements". — [Elicit blog](https://elicit.com/blog/systematic-review)
- NotebookLM answers are generated only from uploaded sources and carry inline citations to the specific passage; these cite passages, not bibliographic metadata, and grounding "narrows" but does not remove retrieval or interpretation errors. — [Bowdoin IT](https://bowdoin.teamdynamix.com/TDClient/1814/Portal/KB/ArticleDet?ID=171368); [CASRAI guide](https://www.casrai.org/guides/notebooklm-for-research-workflows); [Peekaboo Labs](https://peekaboolabs.ai/blog/source-grounding-meaning-explained-how-notebooklm-answers-and-where-it-falls-short-2026-185476) (all secondary; no Google doc fetched)
- Cursor 1.2: "The agent now creates a structured to-do list when tackling complex tasks. These plans are visible in chat"; Plan Mode lets the user review and edit the plan, then "build the plan in the foreground or background". — [Cursor changelog 1.2](https://cursor.com/changelog/1-2)
- Cursor forum users report the agent ignores its own to-do list and marks tasks done only at the end, and that edited plan items do not always update in the UI. — [Cursor forum](https://forum.cursor.com/t/cursor-keeps-ignoring-its-own-to-do-list-and-never-marks-tasks-as-completed-is-this-normal/138667); [Cursor forum](https://forum.cursor.com/t/in-plan-mode-models-cannot-seem-to-update-todo-list-properly/142200)
- Vercel AI SDK `useObject` "allows you to create interfaces that represent a structured JSON object that is being streamed"; "The results are partial and are displayed as they are received", so UI code must handle `undefined` fields; hooks include `isLoading`, `stop()`, `error`, `onFinish({ object, error })`. Vendor-specific but matches the LDT stack. — [AI SDK docs](https://ai-sdk.dev/docs/ai-sdk-ui/object-generation)
- Vercel Workflows (docs updated 2026-09-04) runs "multi-step logic as durable code that can retry failed steps, wait for external events, and resume across crashes and deployments"; "Every step, input, output, sleep, and error inside a workflow is recorded automatically"; streams can carry data out of a run; a human-in-the-loop approval guide exists. Vendor-specific (Vercel). — [Vercel Workflows docs](https://vercel.com/docs/workflows)

### Inferences
- The common pattern is "one run, one plan, one report": a single trigger, optional plan confirmation, visible progress, then a document. The LDT's five buttons expose pipeline internals that these products hide.
- Dependencies between stages are handled by orchestration, not by the user. Where products expose an intermediate decision, it is a cheap, high-leverage one (edit the plan; set a threshold on a pilot sample), not "press next".
- For a public, read-mostly audience, the Gemini and NotebookLM shape fits: no plan editing, a finished grounded brief with per-claim citations, and follow-up questions. Plan editing and threshold calibration (OpenAI, Elicit) fit the analyst or reviewer persona.
- Stage 3 (optional web search) maps directly to OpenAI's "update which sources the research can access" and Gemini's source selection: a toggle set before the run, not a separate stage.
- Streaming partial structured output (AI SDK `useObject`) lets the brief render section by section as the pipeline advances, which replaces the per-stage buttons with a single progressive document. Vercel Workflows is the natural place to run the five stages durably if generation stays live.
- Cursor's forum complaints are a warning: a visible to-do list that the model does not faithfully update erodes trust. If LDT shows stage progress, the status must come from the orchestrator, not from model self-report.

### Gaps
- Hex Magic, Notion AI, Consensus and Claude artifacts were not researched within the tool budget; no primary sources collected.
- OpenAI help center and Perplexity official docs could not be fetched (403); Perplexity details rest on secondary sources.
- No published usability study comparing "plan-then-run" against "run-then-refine" was found.

## Key question 2: Precompute versus on-demand

### Takeaway
Both OpenAI and Anthropic price batch generation at 50 percent of synchronous rates with a 24-hour window, and Anthropic reports most batches finish within an hour; with about 1,100 municipalities and yearly data updates, precomputing per release is cheap, reviewable and cacheable, while live generation only earns its cost for user-specific inputs (what-if, follow-up questions).

### Cited Findings
- OpenAI Batch API: "50% cost discount compared to synchronous APIs"; completion window fixed at 24h, "completes within 24 hours (and often more quickly)"; unfinished requests move to `expired` and are written to the error file with `batch_expired`; up to 50,000 requests and 200 MB per input file; supports `/v1/responses` and `/v1/chat/completions`; output files deleted after 30 days; batch rate limits are a separate pool. Recommended use cases include "Running evaluations". Vendor-specific (OpenAI, the LDT provider). — [OpenAI batch guide](https://developers.openai.com/api/docs/guides/batch)
- Anthropic Message Batches: "All usage is charged at 50 percent of the standard API prices"; "most batches completing within 1 hour"; batches expire at 24 hours and expired requests are not billed; limit 100,000 requests or 256 MB; results retained 29 days; prompt caching works inside batches and the docs recommend the 1-hour cache duration for shared context. Vendor-specific (Anthropic). — [Anthropic batch docs](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
- Vercel Workflows supports durable multi-step runs with retries, persistence, observability and usage-based pricing on "Events, Data Written, and Data Retained". — [Vercel Workflows docs](https://vercel.com/docs/workflows)
- Vercel publishes a knowledge-base guide on an AI evaluation dashboard architecture mapping eval orchestration, traces and run storage onto Postgres and Observability. — [linked from Vercel Workflows docs](https://vercel.com/kb/guide/ai-evaluation-dashboard-architecture-on-vercel)
- GOV.UK AI Playbook: "generative AI models cannot be trusted to produce factual content" and outputs should be presented as "statistically informed guesses rather than facts". — [GOV.UK AI Playbook](https://www.gov.uk/government/publications/ai-playbook-for-the-uk-government/artificial-intelligence-playbook-for-the-uk-government-html)
- Elicit's design runs the costly step (full extraction) only after a 10-paper pilot confirms the column definitions. — [Elicit support: extraction](https://support.elicit.com/en/articles/4267649)

### Inferences
- Rough sizing: 1,100 municipalities times 4 deterministic stages (evidence narrative, plan alignment, SWOT, recommendations) is 4,400 batch requests per release, well under one OpenAI batch's 50,000-request cap. Per-release precompute is one batch job per stage, chained so stage N+1 reads stage N output from the run store.
- Precompute suits stages whose inputs are fixed per release: scores, plan PDFs, indicator metadata. Live generation suits inputs the user supplies: a question about the brief, a comparison pair, a scenario tweak. Stage 3 (web search) is the awkward middle: its freshness value is real, but it is also the stage most likely to inject unverifiable claims into a public tool, which argues for either precomputing it with a visible "as of" date or keeping it as an analyst-only live action.
- Precompute enables review before publication (question 3) and regression evals on the whole corpus (question 4), neither of which is possible if content appears live for the first time in front of a public user.
- Keep live-generation plumbing for the user-specific features, and run it on Vercel Workflows so a five-stage live run survives function timeouts and can report true step status.
- Generated outputs should carry the batch id, model id and prompt version so a yearly re-run can be diffed against the previous release.

### Gaps
- No published case study was found of a public-sector data tool precomputing LLM narratives per entity per release; the recommendation rests on the batch pricing facts plus the review and eval requirements.
- No source gave the practical turnaround distribution for OpenAI batches (Anthropic states "within 1 hour"; OpenAI only states "often more quickly" than 24h).

## Key question 3: Human review and publishing

### Takeaway
UK government guidance asks for a documented review stage, a label on AI-produced content, a public transparency record, and a feedback channel; the one evaluated GOV.UK pipeline (i.AI Consult) built a human checkpoint after each of its two stages and measured agreement with human reviewers before trusting outputs.

### Cited Findings
- GOV.UK AI Playbook (Feb 2025) principle 4, "You have meaningful human control at the right stages", asks teams to ensure "that humans validate any high-risk decisions influenced by AI", and where "human review is not possible in real time" to apply control at other stages. — [GOV.UK AI Playbook](https://www.gov.uk/government/publications/ai-playbook-for-the-uk-government/artificial-intelligence-playbook-for-the-uk-government-html)
- Same document: "Design, document and assess the stages when meaningful human review processes are incorporated"; for high-risk use "establish a human-in-the-loop process to oversee and validate outputs and decisions"; "Clearly signpost when AI has been used to create content"; auditability means "documenting every stage of the AI innovation life cycle" with "traceability throughout the AI project's life cycle". — [GOV.UK AI Playbook](https://www.gov.uk/government/publications/ai-playbook-for-the-uk-government/artificial-intelligence-playbook-for-the-uk-government-html)
- Same document, principle 7: "You should be open with the public about where and how algorithms and AI systems are being used"; central government bodies must publish Algorithmic Transparency Recording Standard (ATRS) records; a chatbot example label reads "this response has been written by an automated AI chatbot". — [GOV.UK AI Playbook](https://www.gov.uk/government/publications/ai-playbook-for-the-uk-government/artificial-intelligence-playbook-for-the-uk-government-html)
- A live ATRS record (DSIT Redbox) shows the disclosure fields: owner and senior responsible owner, scope and benefit, "Human decisions and review", "Appeals and review", tool phase and maintenance, model name and version (GPT-4o, GPT-4o-mini, Claude-3 Sonnet, Claude-3 Haiku, Gemini), data specification, risks and mitigations. Each Redbox response carries a footer that "LLMs may make mistakes and they should always verify for errors"; users rate responses on a five-star scale and developers "review ratings monthly". — [GOV.UK ATRS: DSIT Redbox](https://www.gov.uk/algorithmic-transparency-records/dsit-redbox)
- i.AI Consult (consultation analysis) "broadly follows two steps: theme generation and theme mapping. This two stage process allows us to include a 'human in the loop' at each stage." The Scottish Government evaluation reported a multi-label F1 of 0.76 against human reviewers, "negligible impact on overall theme rankings", and median review time of 23 seconds per response. — [Digital Government Hub summary of the Scot Gov evaluation](https://digitalgovernmenthub.org/library/consult-evaluation-scottish-governments-non-surgical-cosmetic-procedures-consultation/); [UKAuthority](https://www.ukauthority.com/articles/iai-claims-early-success-for-consult-ai-tool/) (the PDF itself could not be text-extracted)
- GOV.UK Chat first experiment (Jan 2024, older): answers "did not reach the highest level of accuracy demanded for a site like GOV.UK"; some users "underestimated or dismissed the inaccuracy risks" because of the GOV.UK brand's credibility. — [Inside GOV.UK blog](https://insidegovuk.blog.gov.uk/2024/01/18/the-findings-of-our-first-generative-ai-experiment-gov-uk-chat/)
- OECD "Governing with Artificial Intelligence" (2025) reviewed 200 public-sector use cases, found generative AI "less common" than rules-based or classic ML approaches, and calls for "transparency requirements, and oversight bodies"; the related OECD generative-AI work urges controlled experimentation with "transparency and human oversight". — [AOC summary of OECD report](https://www.aoc.cat/en/blog/2025/linforme-governing-with-artificial-intelligence-de-locde-analitza-200-casos-reals-dus-de-la-ia-al-sector-public/); [Devdiscourse](https://www.devdiscourse.com/article/technology/3952706-from-ai-hype-to-public-trust-oecd-outlines-roadmap-for-responsible-government-adoption) (secondary; OECD DOI 10.1787/795de142-en not fetched)
- World Bank: a Devex report quotes a Bank AI strategist that staff use an AI tool producing "early drafts of frequently used documents"; no public staff disclosure policy was found. — [Devex](https://www.devex.com/news/how-the-world-bank-is-using-ai-107991)
- Elicit on Team and Enterprise plans supports collaborative editing of reviews and view-only share links, and exports to CSV. — [Elicit blog](https://elicit.com/blog/systematic-review)

### Inferences
- A defensible publishing model for LDT: generated per release in batch, held in a `draft` state, reviewed by a named country expert, then `reviewed` and visible to the public; the public page shows the status, reviewer role (not necessarily name), review date, data vintage, model and prompt version. This mirrors ATRS fields and the Playbook's "document the stages" requirement without requiring the Bank to file an ATRS record.
- Store the reviewer's edits as a diff against the generated draft. This gives change history, a measurable edit rate per stage (a free quality signal), and a source of fail cases for evals.
- The GOV.UK Chat finding about brand-driven overtrust applies directly: a World Bank badge will make readers trust the SWOT and recommendations more than the model warrants, so the label and the reviewed status must be visible on the brief itself, not only in a methodology page.
- Consult's design (human checkpoint after each stage, agreement measured before scale) is the closest public-sector analogue to a five-stage brief pipeline. It supports the approach of reviewing stage outputs in a reviewer console while the public sees only the final document.

### Gaps
- No World Bank or UN primary guidance on disclosing generative AI in published analytical products was located within budget.
- The Scot Gov Consult evaluation PDF was binary-only to the fetcher; figures above are from two secondary summaries that agree with each other.
- No source describes reviewer attribution conventions (named vs role) for AI-assisted public documents.

## Key question 4: Evaluation of multi-step report pipelines

### Takeaway
Practitioners agree on the order: hand-review real outputs first, write binary pass/fail checks per failure mode, validate any LLM judge against human labels, keep a small curated regression set in CI with deterministic checks, and judge the pipeline end to end before diagnosing steps; a small team needs a notebook, a spreadsheet of labels, and one CLI eval runner, not a platform.

### Cited Findings
- Hamel Husain's evals FAQ: review at least 30 traces manually before letting an agent suggest failures, and "We recommend reviewing at least 100 traces"; "Start with binary labels to understand what 'bad' looks like"; Likert scales push annotators to the middle. — [hamel.dev evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- Same source on LLM-as-judge: label 100 to 200 examples per failure mode, split train/dev/test, track both true positive rate and true negative rate, build a separate judge per failure type rather than one overall-quality judge. — [hamel.dev evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- Same source on multi-step pipelines: first "Treat the agent as a black box and decide whether it met the user's goal", then step-level diagnostics; "Process failures are often easier to debug" so fix them first; for RAG "debug retrieval first using IR metrics"; annotate only the first failure in a trace since later ones cascade. — [hamel.dev evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- Same source on CI: keep a curated dataset (often 100+ examples) of core features, past bugs and edge cases; "Favor assertions or other deterministic checks over LLM-as-judge evaluators"; "add representative examples to your CI dataset" when monitoring finds new failures; run cheap assertions on every change and expensive judges nightly or before release; before building an eval "prove that you can trigger the error at least once". — [hamel.dev evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- Same source on tooling: a custom annotation tool is "the single most impactful investment"; buying is justified "when you need to coordinate dozens of distributed annotators"; store prompts in Git; appoint one domain expert as the quality decision-maker; spend 30 minutes reviewing 20 to 50 outputs after significant changes. — [hamel.dev evals FAQ](https://hamel.dev/blog/posts/evals-faq/)
- Shankar et al., "Who Validates the Validators?" (UIST 2024, older): grading needs criteria, yet grading is how people discover criteria, which the authors call "criteria drift"; participants kept refining criteria during grading and went back to change earlier grades; tools should support rapid iteration over criteria and judge implementations together. — [arXiv 2404.12272](https://arxiv.org/abs/2404.12272)
- Eugene Yan (2024, older) on summarization evals: factual consistency via an NLI model with the source as premise and summary as hypothesis is the primary reference-free metric; ROUGE and BERTScore are "unreliable and/or impractical"; G-Eval-style LLM judges had low recall; expect "5 - 10%" factual inconsistency even with RAG and good prompting, and set thresholds by stakes. — [eugeneyan.com](https://eugeneyan.com/writing/evals/)
- GOV.UK AI Playbook: "Establish performance metrics for AI systems that measure the accuracy of model outputs"; "Outputs of models should be tested against known good responses and should be systematically tested for biases"; "Test your system in a variety of scenarios, including those capturing extreme or rare potential events". — [GOV.UK AI Playbook](https://www.gov.uk/government/publications/ai-playbook-for-the-uk-government/artificial-intelligence-playbook-for-the-uk-government-html)
- i.AI Consult was evaluated with a multi-label F1 (0.76) against human coders plus user research, before wider use. — [Digital Government Hub](https://digitalgovernmenthub.org/library/consult-evaluation-scottish-governments-non-surgical-cosmetic-procedures-consultation/)
- Tooling comparisons (vendor and third-party, treat with care): promptfoo is a CLI-first open-source runner with a YAML config that "runs locally and in CI"; Braintrust bundles tracing, evals and CI gates with a free tier; Inspect AI is the UK AI Security Institute's MIT-licensed Python framework aimed at agent and research-grade evaluation rather than CI gating. — [Braintrust vs promptfoo](https://www.braintrust.dev/articles/braintrust-vs-promptfoo); [SFAI Labs guide](https://sfailabs.com/guides/promptfoo-vs-inspect-vs-langfuse-which-eval-tool-your-mvp-partner-should-use)
- Both batch APIs list "running evaluations" as a recommended use, which halves the cost of re-running a golden set. — [OpenAI batch guide](https://developers.openai.com/api/docs/guides/batch); [Anthropic batch docs](https://platform.claude.com/docs/en/build-with-claude/batch-processing)

### Inferences
- Minimal credible setup for LDT: (1) a golden set of 30 to 50 municipalities spanning the three countries, score extremes, missing-data cases and municipalities with and without plan PDFs; (2) a spreadsheet or Supabase table of binary labels per stage and failure mode, produced by the country experts who already review briefs; (3) deterministic checks first: every cited indicator value matches the run store, every plan citation resolves to a page in the PDF, SWOT items reference an upstream evidence id, recommendations reference a SWOT item, length and language constraints; (4) one or two LLM judges only for the subjective failures (unsupported claim, generic recommendation), each validated against the expert labels with TPR/TNR; (5) promptfoo or a short script in CI that runs the deterministic checks on the golden set whenever a prompt or model changes, with judges run per release.
- Because stages feed each other, the end-to-end judgment is "is the final brief acceptable to a planner", and step-level checks exist to localise failures. The "first failure" rule means a bad evidence narrative should be fixed before anyone grades the SWOT built on it.
- Reviewer edits from question 3 are the cheapest source of failure examples; feeding edited briefs back into the golden set follows Husain's "add representative examples" rule.
- Criteria drift means the rubric should be versioned alongside prompts, and expert graders should expect to revise it after the first grading pass rather than fix it up front.
- Pairwise comparison (old release vs new release for the same municipality) is a natural regression check at yearly refresh; no source in this batch quantified its bias risks, so position swapping is prudent.

### Gaps
- No primary documentation for OpenAI Evals, Braintrust, promptfoo, LangSmith or Inspect was fetched; comparisons rely on vendor and third-party articles.
- Eugene Yan's NLI recommendation targets English summarization; its fit for Nepali, Spanish or other LDT languages is unverified.
- No source addressed evaluating "plan alignment" style tasks (comparing narrative to a long PDF) specifically.

## Key question 5: Interaction beyond a static report

### Takeaway
The highest-value, lowest-risk additions are grounded Q&A over the brief's own evidence (the NotebookLM model) and export; comparison of two units adds value if it is computed from stored outputs rather than fresh generation; free-form what-if scenarios carry the most risk because they invite the model to speculate past the evidence.

### Cited Findings
- NotebookLM restricts answers to uploaded sources with passage-level inline citations; grounding reduces but does not eliminate retrieval and interpretation errors, with one journalism test reporting roughly 13 percent response-level hallucination versus about 40 percent ungrounded (unverified figures). — [Siena College](https://www.siena.edu/academics/ai-at-siena/artificial-intelligence-services-and-tools/notebook-lm-at-siena/); [Peekaboo Labs](https://peekaboolabs.ai/blog/source-grounding-meaning-explained-how-notebooklm-answers-and-where-it-falls-short-2026-185476) (secondary)
- Gemini Deep Research lets users "ask follow-up questions or ask Gemini to refine the report" and export to Google Docs. — [Google blog](https://blog.google/products/gemini/google-gemini-deep-research/)
- OpenAI Deep Research lets the user "interrupt the research to adjust focus" and update allowed sources mid-run. — [OpenAI help center, via snippet](https://help.openai.com/en/articles/10500283-deep-research-faq)
- Elicit exports reviews to CSV and offers view-only share links; results carry supporting quotes for verification. — [Elicit blog](https://elicit.com/blog/systematic-review)
- Vercel publishes a reference stack for "AI chat with retrieval, reranking, source citations" on Next.js. Vendor-specific. — [linked from Vercel Workflows docs](https://vercel.com/kb/guide/building-ai-chat-app-with-rag-and-citations-on-vercel)
- GOV.UK AI Playbook: services affecting legal rights "must only use AI to support decisions that must be made by a human decision maker", and outputs are "statistically informed guesses rather than facts". — [GOV.UK AI Playbook](https://www.gov.uk/government/publications/ai-playbook-for-the-uk-government/artificial-intelligence-playbook-for-the-uk-government-html)
- GOV.UK Chat users "underestimated or dismissed the inaccuracy risks" of a conversational interface carrying a trusted brand. — [Inside GOV.UK blog](https://insidegovuk.blog.gov.uk/2024/01/18/the-findings-of-our-first-generative-ai-experiment-gov-uk-chat/) (older)

### Inferences
- "Ask this brief": grounded on the reviewed brief plus its evidence set (indicator values, plan excerpts), with passage citations and a refusal when the answer is not in the set. This is the NotebookLM pattern and is the safest live feature because the evidence set is fixed and already reviewed. It should be clearly labelled as unreviewed, live output, unlike the brief.
- Compare two municipalities: build it from stored, reviewed stage outputs (side-by-side SWOT, score deltas) with a short generated synthesis at most. The risk is low because the inputs are reviewed and the comparison logic is mostly deterministic.
- What-if scenarios ("if road access improved by X"): the brief's evidence does not contain causal estimates, so a model answer is speculation presented with the Bank's brand. The Playbook's "support decisions made by a human" line and the GOV.UK Chat overtrust finding both argue against shipping this to the public; if offered, limit it to analysts, label it as hypothetical, and require it to cite which indicators it changed.
- Print-ready export: pure value, no new risk, provided the export carries the same labels, data vintage and reviewed status as the page.
- Mid-run steering (OpenAI style) is for analysts regenerating a brief, not for public readers.

### Gaps
- No source evaluated what-if or scenario features in a public-sector LLM tool.
- Hallucination rates for grounded Q&A are reported only by secondary sources with unclear methodology.

## Key question 6: Labelling and trust

### Takeaway
Government guidance wants AI-generated content signposted on the content itself, backed by a public record of model, version, human review and risks, plus a way for readers to report errors; existing products settle on inline citations, a mistake disclaimer, and a per-response rating.

### Cited Findings
- GOV.UK AI Playbook: "Clearly signpost when AI has been used to create content"; "Transparency is the communication of appropriate information about an AI system to the right people"; "Put feedback mechanisms in place to allow individuals to report unfair decisions" and "consider individuals' feedback, views and corrections of factual errors"; "Adopt an approach of continuous evaluation". — [GOV.UK AI Playbook](https://www.gov.uk/government/publications/ai-playbook-for-the-uk-government/artificial-intelligence-playbook-for-the-uk-government-html)
- ATRS records publish model name and version, task, input and output, phase (Redbox: "Beta"), maintenance, human review process, risks and mitigations, and usage scale ("2,000 Civil Servants" as of Feb 2025). — [GOV.UK ATRS: DSIT Redbox](https://www.gov.uk/algorithmic-transparency-records/dsit-redbox)
- Redbox puts a per-response footer that LLMs "may make mistakes" and collects a five-star rating per response, reviewed monthly, with an incident-reporting channel. — [GOV.UK ATRS: DSIT Redbox](https://www.gov.uk/algorithmic-transparency-records/dsit-redbox)
- Elicit attaches "supporting quotes from the paper and an explanation" to every AI answer. — [Elicit blog](https://elicit.com/blog/systematic-review)
- Perplexity shows citations per sentence or even per phrase; NotebookLM shows inline passage citations. — [LLMPulse](https://llmpulse.ai/blog/how-perplexity-works/); [Simplilearn](https://www.simplilearn.com/what-is-notebooklm-article) (secondary)
- Vercel Workflows records every step input and output and Vercel's batch and workflow products keep run data with defined retention; the OpenAI Batch API returns results keyed by `custom_id` with per-request error codes. — [Vercel Workflows docs](https://vercel.com/docs/workflows); [OpenAI batch guide](https://developers.openai.com/api/docs/guides/batch)
- Shankar et al. show that evaluation criteria change as graders see more outputs, which implies rubric versions must be recorded if quality claims are to be reproducible. — [arXiv 2404.12272](https://arxiv.org/abs/2404.12272) (older)

### Inferences
- A brief header block for LDT: "AI-assisted draft, reviewed by [country team] on [date]" or "AI-generated, not yet reviewed"; data vintage (release year); model id; prompt and rubric version; link to a methodology page that reads like an ATRS record (purpose, inputs, human review, known limitations, risks). The GOV.UK chatbot label example shows that the label should be plain language, not a version string.
- Every narrative claim that rests on a number should cite the indicator and value from the run store; every plan-alignment claim should cite the PDF page. This is the Elicit and NotebookLM pattern and is what lets reviewers and readers check the brief quickly.
- Feedback: a per-section "report a problem" control with a free-text reason is more useful than a star rating for a read-mostly audience, because the reports become eval cases; the Redbox monthly review cadence is a reasonable floor.
- Version history: keep every generated version with its batch id, and show "updated for 2026 data" when a yearly re-run replaces a brief, so planners can tell which vintage they printed.

### Gaps
- No primary source on how Perplexity, OpenAI or Google disclose model and prompt versions to end users; consumer products generally do not.
- No World Bank or UN labelling convention for AI-assisted analytical publications was found.
