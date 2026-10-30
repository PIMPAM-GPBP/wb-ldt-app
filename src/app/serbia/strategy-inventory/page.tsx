import type { Metadata } from "next";

import { StrategyInventoryDashboard } from "@/components/strategy-inventory/strategy-inventory-dashboard";
import { getCountryBySlug } from "@/lib/countries";
import { loadStrategyInventoryDataset } from "@/lib/strategy-inventory/server";

export const metadata: Metadata = {
  title: "Serbia strategy inventory | Local Development Tracker",
  description: "Which of Serbia's 161 municipalities have a local development plan online, the years each plan covers, and whether its text could be read.",
};

export const dynamic = "force-dynamic";

export default async function SerbiaStrategyInventoryPage() {
  const dataset = await loadStrategyInventoryDataset({
    countryCode: "SRB",
    countryName: "Serbia",
    expectedLsgCount: 161,
    samplePath: "public/data/serbia/strategy_inventory.sample.json",
  });

  return <StrategyInventoryDashboard dataset={dataset} country={getCountryBySlug("serbia")!} />;
}
