import type { NextConfig } from "next";

const analyticsFallbackFiles = [
  "./src/generated/analytics-data.json",
  "./src/generated/zambia/analytics-data.json",
  "./src/generated/serbia/analytics-data.json",
  "./public/data/nepal-municipalities.geojson",
  "./public/data/zambia/municipalities.geojson",
  "./public/data/serbia/municipalities.geojson",
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
    "/api/countries/*/scores": analyticsFallbackFiles,
    "/api/indicators": analyticsFallbackFiles,
    "/methodology": analyticsFallbackFiles,
    "/about": analyticsFallbackFiles,
    "/serbia/strategy-inventory": serbiaStrategyInventoryFallbackFiles,
    "/zambia/strategy-inventory": zambiaStrategyInventoryFallbackFiles,
  },
  // The public roadmap and software release notes became one Data updates page on 2026-10-30;
  // their content is in docs/roadmap/product-roadmap.md and docs/release-history.md.
  async redirects() {
    return [
      { source: "/roadmap", destination: "/data-updates", permanent: false },
      { source: "/release-notes", destination: "/data-updates", permanent: false },
    ];
  },
};

export default nextConfig;
