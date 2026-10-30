import type { Metadata } from "next";

import { StrategyInventoryDashboard } from "@/components/strategy-inventory/strategy-inventory-dashboard";
import { getCountryBySlug } from "@/lib/countries";
import { loadStrategyInventoryDataset } from "@/lib/strategy-inventory/server";

export const metadata: Metadata = {
  title: "Zambia strategy inventory | Local Development Tracker",
  description: "Which of Zambia's 116 districts have a local development plan online, the years each plan covers, and whether its text could be read.",
};

export const dynamic = "force-dynamic";

export default async function ZambiaStrategyInventoryPage() {
  const dataset = await loadStrategyInventoryDataset({
    countryCode: "ZMB",
    countryName: "Zambia",
    expectedLsgCount: 116,
    samplePath: "public/data/zambia/strategy_inventory.sample.json",
  });

  return <StrategyInventoryDashboard dataset={dataset} country={getCountryBySlug("zambia")!} />;
}
