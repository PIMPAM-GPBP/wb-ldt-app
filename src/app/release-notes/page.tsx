type ReleaseType = "Major" | "Minor" | "Patch" | "Operational pre-release";

type ReleaseSection = {
  title: string;
  items: string[];
};

type Release = {
  version: string;
  date: string;
  type: ReleaseType;
  summary: string;
  sections: ReleaseSection[];
};

const versionTypes: Array<{
  label: ReleaseType;
  description: string;
}> = [
  {
    label: "Major",
    description: "Significant platform, data model, country coverage, or workflow updates.",
  },
  {
    label: "Minor",
    description: "Focused UI/UX, analytics, content, or workflow improvements.",
  },
  {
    label: "Patch",
    description: "Bug fixes, deployment fixes, copy corrections, and stability updates.",
  },
  {
    label: "Operational pre-release",
    description: "Internal testing, preview deployments, and validation-only releases.",
  },
];

const releases: Release[] = [
  {
    version: "Release v1.5.0",
    date: "October 18, 2026",
    type: "Major",
    summary:
      "This release adds Vietnam as the fourth LDT country workspace, reflecting the country's July 2025 administrative reform to 34 provinces and roughly 3,300 commune-level units with the district tier removed.",
    sections: [
      {
        title: "Vietnam country workspace",
        items: [
          "Added a live Vietnam country landing page with population, land area, and national Socio-Economic Development Plan context sourced from the World Bank and the Vietnamese government.",
          "Added an administrative-level guide explaining Vietnam's post-reform two-tier structure (Province, Commune-level unit) in place of the retired province-district-commune system.",
          "Matched the loaded Vietnam commune-level boundary file against the generated analytics dataset, producing a full 3,319-feature match for the choropleth map.",
          "Enabled live Compare Scores and Map & Drivers analytics for Vietnam directly from its generated dataset, without requiring Supabase ingestion; the AI Planning Brief tab stays unavailable until local/SNG plan source documents are loaded.",
        ],
      },
    ],
  },
  {
    version: "Release v1.4.4",
    date: "June 15, 2026",
    type: "Minor",
    summary:
      "This release polishes the GPB ecosystem presentation after the multi-country release, adds a Resources page for LDT and country materials, and applies reviewer-requested content corrections across the public pages.",
    sections: [
      {
        title: "GPB ecosystem UI alignment",
        items: [
          "Aligned the global header and footer with the GPB digital tools guidance, including the dark chrome treatment, GPB Suite badge, PIM-PAM footer branding, and updated LDT logo usage.",
          "Reordered the primary navigation to Home, About, Methodology, Resources, and Release Notes, and replaced the previous Countries header link with About.",
          "Applied the GPB primary palette across the app while preserving the black header and footer treatment requested for the digital tools shell.",
        ],
      },
      {
        title: "Resources page",
        items: [
          "Added a Resources page to the header and footer for core LDT reference materials and country-specific workspaces.",
          "Linked the GPB LDT briefing, one-pager, and intro deck, plus Serbia, Zambia, and Nepal country folders with direct links to visible country documents, demos, and notebooks.",
          "Refined the Resources layout by removing redundant folder copy and the top-level Drive button so the page stays focused on document cards and country packs.",
        ],
      },
      {
        title: "Content cleanup and corrections",
        items: [
          "Removed the homepage implemented-by strip and the methodology standardization mapping block to reduce page clutter.",
          "Updated About page country findings to use 161 Serbia LSGs, approximately 94% Serbia strategy coverage, approximately 97% Zambia strategy coverage, and the corrected 94% Kosovo footnote.",
          "Standardized GPB Suite naming across header and footer surfaces.",
        ],
      },
    ],
  },
  {
    version: "Release v1.4.3",
    date: "June 13, 2026",
    type: "Minor",
    summary:
      "This release prepares the Local Development Tracker for the next multi-country release by expanding Serbia and Zambia workspaces, strengthening the Strategy Inventory dashboard, improving country-aware AI planning support, refreshing GPB LDT branding/content, and hardening production deployment on Vercel.",
    sections: [
      {
        title: "Multi-country workspaces",
        items: [
          "Added live Serbia and Zambia country landing pages and analytics routes.",
          "Standardized Nepal, Serbia, and Zambia on the same shared country landing-page layout.",
          "Updated the homepage to report global workspace coverage across all loaded countries.",
          "Added generated analytics fallbacks and tracing so country analytics load correctly in production.",
        ],
      },
      {
        title: "Strategy inventory",
        items: [
          "Added Strategy Inventory dashboards for Serbia and Zambia.",
          "Added Supabase-backed strategy inventory storage and ingest support.",
          "Added fallback and sample inventory data for preview resilience.",
          "Corrected Serbia coverage and readiness logic, including the 161-LSG denominator and Serbian-language AI-readiness handling.",
        ],
      },
      {
        title: "AI planning workflow",
        items: [
          "Made AI planning requests country-aware for Nepal, Serbia, and Zambia.",
          "Updated local and SNG plan context handling while preserving existing stage compatibility.",
          "Improved graceful behavior when local plan URLs are missing.",
          "Fixed Vercel PDF parsing issues with server-side PDF.js worker and polyfill handling.",
        ],
      },
      {
        title: "Branding, content, and documentation",
        items: [
          "Refreshed the About page using the GPB LDT Briefing content.",
          "Embedded GPB LDT figures, tables, and demo screenshots from the briefing document.",
          "Updated typography to Fira Sans headings and Inter body copy.",
          "Added the PIL diagram to the homepage and Methodology page.",
          "Expanded Release Notes into a more specific versioned changelog inspired by the GPBP release-notes format.",
        ],
      },
      {
        title: "Deployment and stability",
        items: [
          "Bundled generated analytics JSON assets for Vercel.",
          "Added tracing safeguards for analytics fallbacks used by AI routes.",
          "Removed build-time Google font fetching from the Next.js build path.",
          "Added regression tests for branding/content, release notes, strategy inventory, and country-page behavior.",
        ],
      },
    ],
  },
  {
    version: "Release v1.4.2",
    date: "June 12, 2026",
    type: "Minor",
    summary:
      "This release moves the app beyond the original Nepal-only framing, enables Serbia and Zambia strategy inventory workflows, and fixes production deployment issues for generated analytics assets and PDF document parsing on Vercel.",
    sections: [
      {
        title: "Strategy inventory workflows",
        items: [
          "Added Strategy Inventory dashboards for Serbia and Zambia.",
          "Backed the strategy inventory with a new Supabase table and ingest script.",
          "Added Serbia and Zambia sample and fallback inventory data.",
          "Corrected Serbia inventory coverage and readiness logic, including treating parsed Serbian-language documents as AI-ready.",
        ],
      },
      {
        title: "Shared country experience",
        items: [
          "Updated country landing pages so Nepal, Serbia, and Zambia use the same shared layout.",
          "Added country-aware landing actions, including the Strategy Inventory button.",
          "Made Development plan source availability collapsible by default.",
          "Updated homepage stats to summarize all loaded country workspaces instead of Nepal only.",
          "Removed static Nepal-only homepage framing.",
        ],
      },
      {
        title: "Release notes and production fixes",
        items: [
          "Added Release v1.4 notes.",
          "Fixed Vercel deployment and runtime issues for generated analytics JSON files.",
          "Added PDF.js server-side worker and polyfill handling for Vercel AI document parsing.",
        ],
      },
    ],
  },
  {
    version: "Release v1.4",
    date: "June 12, 2026",
    type: "Major",
    summary:
      "This release turns the Local Development Tracker into a more complete multi-country workspace, adds Serbia and Zambia strategy inventory capabilities, and refreshes the public GPB LDT briefing content.",
    sections: [
      {
        title: "Country workspaces and analytics",
        items: [
          "Serbia and Zambia now have live country landing pages, analytics routes, generated analytics datasets, and country-specific boundary assets.",
          "Nepal, Serbia, and Zambia now share the same country landing-page format, including country snapshots, administrative-level summaries, SNG metrics, and plan-source availability.",
          "The homepage now reports global workspace coverage across all three loaded countries instead of presenting the application as Nepal-only.",
        ],
      },
      {
        title: "Strategy inventory dashboard",
        items: [
          "Added Serbia and Zambia Strategy Inventory pages for tracking local strategy-document availability, publication timing, AI readiness, missing plans, and follow-up needs.",
          "Backed the inventory workflow with a Supabase table, ingest script, country fallback JSON, and dashboard summaries that separate LSG-level coverage from document counts.",
          "Corrected Serbia coverage denominators to use the expected 161 LSG universe and treated parsed Serbian-language documents as AI-ready while preserving validation blockers.",
        ],
      },
      {
        title: "AI planning and document context",
        items: [
          "Made AI planning requests country-aware so Zambia and Serbia can load the correct national and local/SNG plan sources instead of defaulting to Nepal.",
          "Kept the existing province-plan AI stage name for compatibility while relabeling prompts and UI copy around local/SNG planning context.",
          "Improved graceful behavior when local plan URLs are unavailable, allowing score narratives and national-plan context to continue while blocking local-plan-dependent outputs.",
        ],
      },
      {
        title: "Branding, content, and documentation",
        items: [
          "Replaced the About page with the GPB LDT Briefing content and embedded the relevant briefing figures, country demo panels, strategy screenshots, and tables.",
          "Updated the app typography to use Fira Sans for headings and Inter for body text, with appropriate fallback fonts.",
          "Added the PIL diagram to the homepage and Methodology page to make the Prosperity, Infrastructure, and Livability framework more visible.",
        ],
      },
      {
        title: "Deployment and stability fixes",
        items: [
          "Bundled generated analytics JSON files so Serbia and Zambia analytics pages load correctly on Vercel.",
          "Added server-side PDF.js worker handling and polyfills so AI document parsing works in Vercel functions.",
          "Removed build-time Google font fetching from the Next.js build path and added tracing safeguards for generated analytics assets used by AI routes.",
        ],
      },
    ],
  },
  {
    version: "Release v1.3",
    date: "May 21, 2026",
    type: "Minor",
    summary:
      "This release introduced the multi-country portal shell and prepared the app for country-specific landing pages beyond Nepal.",
    sections: [
      {
        title: "Portal and navigation",
        items: [
          "Reworked the homepage into a country portal with selector-based entry points for supported countries.",
          "Simplified header branding, navigation, and supporting page shells to match the multi-country product structure.",
          "Added under-construction handling for country routes that were not ready for public analytics yet.",
        ],
      },
      {
        title: "Country pages and theming",
        items: [
          "Tightened country landing-page copy and CTAs so each country page emphasizes analytics access and local context.",
          "Added persistent dark mode across the app with themed charts, improved tooltip contrast, and hydration-safe initialization.",
          "Adjusted country page positioning and shared page components so future countries can reuse the same layout patterns.",
        ],
      },
    ],
  },
  {
    version: "Release v1.2",
    date: "May 21, 2026",
    type: "Minor",
    summary:
      "This release refined the AI planning brief workflow and made analytics outputs easier to inspect and interpret.",
    sections: [
      {
        title: "AI workflow refinements",
        items: [
          "Improved web-context output so users see clearer summaries and source lists instead of dense per-source cards.",
          "Made planning-alignment bullets denser and more directly tied to the selected score theme and planning evidence.",
          "Expanded recommendation cards with clearer implementation-risk sections and more usable structured outputs.",
        ],
      },
      {
        title: "Score interpretation",
        items: [
          "Updated Step 1 AI analysis charts to plot 0-100 component scores instead of raw indicator values.",
          "Fixed chart ranges to match score semantics so prosperity, livability, and infrastructure comparisons are easier to read.",
          "Shortened AI tab labels and helper text to reduce cognitive load during the staged analysis workflow.",
        ],
      },
    ],
  },
  {
    version: "Release v1.1",
    date: "May 20, 2026",
    type: "Major",
    summary:
      "This release added the first staged AI Planning Brief workflow on top of the municipality analytics surface.",
    sections: [
      {
        title: "AI Planning Brief",
        items: [
          "Added staged AI routes for indicator narrative, local plan context, national plan context, web context, planning alignment, SWOT analysis, and investment recommendations.",
          "Wired document parsing and AI-stage caching into Supabase-backed server routes so repeated municipality analyses can reuse prior context.",
          "Added structured renderers for alignment, SWOT, recommendations, and web-context outputs on the analytics route.",
        ],
      },
      {
        title: "Supporting content",
        items: [
          "Aligned Release Notes, Methodology, and About pages with the expanded analytics-plus-AI product direction.",
          "Improved AI result cards so outputs are easier to scan, compare, and validate against source evidence.",
        ],
      },
    ],
  },
  {
    version: "Release v1.0",
    date: "May 18, 2026",
    type: "Major",
    summary:
      "This release established the public Local Development Tracker analytics application.",
    sections: [
      {
        title: "Core analytics",
        items: [
          "Restored the reference-style application structure with Home, Methodology, Release Notes, and About pages.",
          "Added interactive Plotly 2D and 3D scatterplots with hover, zoom, click selection, and axis labels.",
          "Shipped the MapLibre choropleth view as the default municipality map experience.",
        ],
      },
      {
        title: "Data foundation",
        items: [
          "Completed Supabase-backed score, component, municipality context, and analytics query layers for the public app.",
          "Connected score-driver charts, indicator metadata, and municipality summaries to the runtime analytics dataset.",
        ],
      },
    ],
  },
];

function TypeBadge({ type }: { type: ReleaseType }) {
  return (
    <span className="inline-flex w-fit rounded-full border border-[var(--border-soft)] bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]">
      {type}
    </span>
  );
}

export default function ReleaseNotesPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 pb-16 pt-10 sm:px-8 lg:px-12">
      <section className="rounded-[2rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] p-8 shadow-[0_18px_50px_rgba(2,20,32,0.08)]">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
          Release notes
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
          Local Development Tracker release history
        </h1>
        <p className="mt-5 max-w-4xl text-sm leading-8 text-[var(--muted-foreground)]">
          Release notes document changes to the application, data coverage,
          AI-assisted planning workflow, and user interface over time. The app
          uses GitHub for version control, while this page summarizes the
          user-facing changes by version, release type, and date.
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-[var(--border-soft)] bg-white/80 p-8">
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">
          Versioning guide
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {versionTypes.map((entry) => (
            <article
              key={entry.label}
              className="rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5"
            >
              <TypeBadge type={entry.label} />
              <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">
                {entry.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        {releases.map((release) => (
          <article
            key={release.version}
            className="rounded-[1.75rem] border border-[var(--border-soft)] bg-white/80 p-6 shadow-[0_14px_34px_rgba(2,20,32,0.06)] sm:p-8"
          >
            <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  {release.date} | {release.version}
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                  {release.version}
                </h2>
              </div>
              <TypeBadge type={release.type} />
            </div>

            <p className="mt-5 max-w-4xl text-sm leading-8 text-[var(--muted-foreground)]">
              {release.summary}
            </p>

            <div className="mt-6 grid gap-5">
              {release.sections.map((section) => (
                <section
                  key={section.title}
                  className="rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5"
                >
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">
                    {section.title}
                  </h3>
                  <ul className="mt-4 space-y-3 pl-5 text-sm leading-7 text-[var(--muted-foreground)]">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
