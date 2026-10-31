export const countries = [
  {
    code: "NPL",
    slug: "nepal",
    name: "Nepal",
    analyticsStatus: "live",
    fallbackDataPath: "src/generated/analytics-data.json",
    mapDataPath: "public/data/nepal-municipalities.geojson",
    adminLabels: {
      lower: { singular: "Municipality", plural: "Municipalities" },
      middle: { singular: "District", plural: "Districts" },
      higher: { singular: "Province", plural: "Provinces" },
    },
    adminLevelGuide: {
      summary:
        "The LDT uses Nepal's province-to-local-level structure so users can compare municipalities while still reading results in their provincial planning context.",
      levels: [
        {
          label: "Admin level 1",
          name: "Province",
          description:
            "Provinces are the higher subnational frame used on the country page to group municipalities and summarize geographic coverage.",
        },
        {
          label: "Admin level 2",
          name: "Municipality / local level",
          description:
            "Municipalities and rural municipalities are the local government units used for LDT analytics. Nepal's local level includes metropolitan cities, sub-metropolitan cities, municipalities, and rural municipalities.",
        },
      ],
      note:
        "As Nepal transitions into a three-tier federal administrative system, the district level, comprised of 77 distinct regions, is removed from the main LDT two-level rollup. What remains is the federal level, provincial level, and local / municipal level.",
      sourceLinks: [
        {
          label: "Local government in Nepal",
          href: "https://en.wikipedia.org/wiki/Local_government_in_Nepal",
        },
        {
          label: "Administrative divisions of Nepal",
          href: "https://en.wikipedia.org/wiki/Administrative_divisions_of_Nepal",
        },
      ],
    },
    profile: {
      populationMillions: null,
      areaKm2: null,
      context: {
        summary:
          "Nepal provides the baseline country workspace for the LDT, with local analytics organized around provinces, districts, and municipalities across a multi-year score release.",
        highlights: [
          "The workspace is useful for comparing municipality-level variation across terrain, population distribution, and service access patterns.",
          "Planning-document coverage is organized at province level for AI-assisted local plan context.",
          "The latest release now supports 2021-2025 time-series exploration for the core PIL scores.",
        ],
        sourceLinks: [
          {
            label: "National Planning Commission",
            href: "https://npc.gov.np/",
          },
        ],
      },
      strategy: {
        title: "Sixteenth Plan, 2024-2028",
        url: "http://elibrary.moest.gov.np/bitstream/123456789/308/1/16.pdf",
      },
    },
    planningDocuments: {
      aiEnabled: true,
      planSourceAdminLevel: "higher",
      message: "Planning documents are available for AI-assisted analysis.",
    },
  },
  {
    code: "ZMB",
    slug: "zambia",
    name: "Zambia",
    analyticsStatus: "live",
    fallbackDataPath: "src/generated/zambia/analytics-data.json",
    mapDataPath: "public/data/zambia/municipalities.geojson",
    adminLabels: {
      lower: { singular: "District", plural: "Districts" },
      middle: null,
      higher: { singular: "Province", plural: "Provinces" },
    },
    adminLevelGuide: {
      summary:
        "The LDT uses Zambia's province-to-district structure so district-level comparisons can be understood against the country's higher administrative planning geography.",
      levels: [
        {
          label: "Admin level 1",
          name: "Province",
          description:
            "Provinces are the higher administrative grouping used to organize district results, compare regional patterns, and connect local evidence to national planning priorities.",
        },
        {
          label: "Admin level 2",
          name: "District",
          description:
            "Districts are the local analysis units in the Zambia workspace. They are the units shown in district analytics, maps, and planning-document workflows.",
        },
      ],
      note:
        "The current LDT release follows the app's loaded Zambia workspace of 10 provinces and 116 districts.",
      sourceLinks: [
        {
          label: "Provinces of Zambia",
          href: "https://en.wikipedia.org/wiki/Provinces_of_Zambia",
        },
        {
          label: "Subdivisions of Zambia",
          href: "https://en.wikipedia.org/wiki/Subdivisions_of_Zambia",
        },
      ],
    },
    profile: {
      populationMillions: 22.5,
      areaKm2: 763027,
      context: {
        summary:
          "Zambia's LDT workspace links district-level development conditions to a national planning agenda shaped by economic diversification, human capital, infrastructure, agriculture, tourism, and energy-transition minerals.",
        highlights: [
          "The World Bank's Zambia Economic Update points to mining momentum, an agriculture rebound, and tourism improvements as important near-term growth signals.",
          "The 8th National Development Plan frames implementation around national development priorities for 2022-2026, making district-level comparisons useful for translating broad goals into local investment questions.",
          "District and province labels are intentionally preserved in the app so users can move between local plan evidence and higher-level administrative context.",
        ],
        sourceLinks: [
          {
            label: "World Bank Zambia overview",
            href: "https://www.worldbank.org/en/country/zambia/overview",
          },
          {
            label: "8th National Development Plan",
            href: "https://www.cabinet.gov.zm/newsite/wp-content/uploads/2023/12/8NDP-2022-2026.pdf",
          },
        ],
      },
      strategy: {
        title: "8th National Development Plan",
        url: "https://www.cabinet.gov.zm/newsite/wp-content/uploads/2023/12/8NDP-2022-2026.pdf",
      },
    },
    planningDocuments: {
      aiEnabled: true,
      planSourceAdminLevel: "lower",
      message:
        "Local/SNG planning documents are available for AI-assisted analysis where source links are loaded.",
    },
  },
  {
    code: "SRB",
    slug: "serbia",
    name: "Serbia",
    analyticsStatus: "live",
    fallbackDataPath: "src/generated/serbia/analytics-data.json",
    mapDataPath: "public/data/serbia/municipalities.geojson",
    adminLabels: {
      lower: { singular: "Municipality", plural: "Municipalities" },
      middle: null,
      higher: { singular: "District", plural: "Districts" },
    },
    adminLevelGuide: {
      summary:
        "The LDT uses Serbia's district-to-local-self-government structure so municipality-level evidence can be compared within the country's administrative district geography.",
      levels: [
        {
          label: "Admin level 1",
          name: "District",
          description:
            "Administrative districts are used in the app as the higher grouping for Serbian municipalities and cities, matching how the workspace summarizes local coverage.",
        },
        {
          label: "Admin level 2",
          name: "Municipality / city",
          description:
            "Municipalities and cities are the local self-government units used for Serbia's LDT analytics, maps, strategy inventory, and country landing-page counts.",
        },
      ],
      note:
        "Serbia's administrative districts are central-government coordination areas rather than elected local governments; the LDT uses them as a practical grouping layer for local analysis. In many Serbian contexts, Belgrade municipalities are often considered together as Belgrade, a single Admin level 1 entity, rather than as individual Admin level 2 regions.",
      sourceLinks: [
        {
          label: "Statistical Office of Serbia",
          href: "https://www.stat.gov.rs/en-US/oblasti/registar-prostornih-jedinica-i-gis/administrativno-teritorijalna-podela-i-nstj-nivoi-1-2-3/upravni-okruzi",
        },
        {
          label: "Administrative divisions of Serbia",
          href: "https://en.wikipedia.org/wiki/Administrative_divisions_of_Serbia",
        },
      ],
    },
    profile: {
      populationMillions: 6.7,
      areaKm2: null,
      context: {
        summary:
          "Serbia's LDT workspace connects municipality-level PIL evidence to national strategy, EU-aligned reform priorities, service delivery, competitiveness, and climate-resilient development questions.",
        highlights: [
          "The World Bank's Serbia partnership materials emphasize stronger institutions, sustainable growth, and more inclusive service delivery.",
          "The Serbia 2030 Strategy provides the national planning frame for reading local development patterns against Sustainable Development Goal priorities.",
          "Municipality and district labels are kept country-specific so users can interpret local strategy coverage without forcing Serbia into Nepal's administrative terminology.",
        ],
        sourceLinks: [
          {
            label: "World Bank Serbia overview",
            href: "https://www.worldbank.org/en/country/serbia/overview",
          },
          {
            label: "Serbia 2030 Strategy",
            href: "https://rsjp.gov.rs/wp-content/uploads/Srbija-i-Agenda-2030.-februar-2024.-lat.pdf",
          },
        ],
      },
      strategy: {
        title: "Serbia 2030 Strategy",
        url: "https://rsjp.gov.rs/wp-content/uploads/Srbija-i-Agenda-2030.-februar-2024.-lat.pdf",
      },
    },
    planningDocuments: {
      aiEnabled: true,
      planSourceAdminLevel: "lower",
      message:
        "Local/SNG planning documents are available for AI-assisted analysis where source links are loaded.",
    },
  },
] as const;

export type Country = (typeof countries)[number];
export type CountryCode = Country["code"];
export type CountrySlug = Country["slug"];
export type AdminLabels = Country["adminLabels"];

export const defaultCountry = countries[0];

export function getCountryBySlug(slug: string) {
  return countries.find((country) => country.slug === slug) ?? null;
}

export function getCountryByCode(code: string) {
  return countries.find((country) => country.code === code) ?? null;
}
