import type { NextConfig } from "next";

const analyticsFallbackFiles = [
  "./src/generated/analytics-data.json",
  "./src/generated/zambia/analytics-data.json",
  "./src/generated/serbia/analytics-data.json",
  "./public/data/nepal-municipalities.geojson",
  "./public/data/zambia/municipalities.geojson",
  "./public/data/serbia/municipalities.geojson",
  "./public/data/vietnam/municipalities.geojson",
];

const aiDocumentFiles = [
  "./node_modules/@napi-rs/**/*",
  "./node_modules/pdf-parse/**/*",
  "./node_modules/pdfjs-dist/**/*",
];

const serbiaStrategyInventoryFallbackFiles = [
  "./public/data/serbia/strategy_inventory.sample.json",
];

const zambiaStrategyInventoryFallbackFiles = [
  "./public/data/zambia/strategy_inventory.sample.json",
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pim-pam.net",
      },
    ],
  },
  outputFileTracingIncludes: {
    "/nepal": analyticsFallbackFiles,
    "/zambia": analyticsFallbackFiles,
    "/serbia": analyticsFallbackFiles,
    "/[country]/analytics": analyticsFallbackFiles,
    "/api/countries/[country]/plan-availability": analyticsFallbackFiles,
    "/api/countries/[country]/sng-metrics": analyticsFallbackFiles,
    "/api/ai/indicator-narrative": analyticsFallbackFiles,
    "/api/ai/investment-recommendations": analyticsFallbackFiles,
    "/api/ai/plan-alignment": analyticsFallbackFiles,
    "/api/ai/swot-analysis": analyticsFallbackFiles,
    "/api/ai/web-context-search": analyticsFallbackFiles,
    "/api/ai/province-plan-context": [
      ...analyticsFallbackFiles,
      ...aiDocumentFiles,
    ],
    "/api/ai/national-plan-context": [
      ...analyticsFallbackFiles,
      ...aiDocumentFiles,
    ],
    "/serbia/strategy-inventory": serbiaStrategyInventoryFallbackFiles,
    "/zambia/strategy-inventory": zambiaStrategyInventoryFallbackFiles,
  },
};

export default nextConfig;
