"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import type { Scatter3DCardProps } from "@/components/analytics/scatter-3d";
import { Button } from "@/components/ui/button";

const DeferredScatter3DCard = dynamic(
  () => import("@/components/analytics/scatter-3d").then((module) => module.Scatter3DCard),
  {
    ssr: false,
    loading: () => (
      <div role="status" className="min-h-[420px]">
        <p className="text-sm text-ink-muted">Loading 3D chart</p>
      </div>
    ),
  },
);

export function Scatter3DLoader(props: Scatter3DCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  if (isLoaded) {
    return <DeferredScatter3DCard {...props} />;
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="max-w-prose text-sm text-ink-muted">
        The 3D view plots all three scores at once, so clusters that two axes hide can show.
      </p>
      <Button type="button" variant="outline" size="lg" onClick={() => setIsLoaded(true)}>
        Load 3D chart
      </Button>
    </div>
  );
}
