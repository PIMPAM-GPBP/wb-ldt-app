import { cn } from "@/lib/utils";

// Mirrors the atlas: a 48px workspace bar, then a full-bleed map. From 1024px the two panels float
// over the map at the same widths as the real layout; below that the map stacks above the panels.
// Flat blocks only, no shimmer, so nothing moves and reduced motion needs no override.

const PANEL =
  "border-b border-[var(--border-soft)] bg-[var(--surface)] lg:rounded-xl lg:border lg:border-[var(--border-strong)] lg:bg-[var(--surface-strong)] lg:shadow-float";

const BINS = [0, 1, 2, 3, 4];
const ROWS = [0, 1, 2, 3, 4, 5];
const PILLARS = [0, 1, 2];

function Block({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("rounded-md bg-[var(--surface-muted)]", className)} />;
}

export default function AnalyticsLoading() {
  return (
    <main aria-busy="true" className="flex flex-1 flex-col">
      <p role="status" className="sr-only">
        Loading analytics workspace
      </p>

      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--border-soft)] bg-[var(--surface)] px-4">
        <Block className="h-4 w-36" />
        <Block className="ml-auto h-4 w-20" />
      </div>

      <div className="relative flex flex-col lg:block lg:h-[max(600px,calc(100svh_-_8.0625rem))] lg:overflow-hidden">
        <div className="relative h-[60svh] min-h-80 shrink-0 bg-[var(--surface-muted)] lg:absolute lg:inset-0 lg:h-auto lg:min-h-0" />

        <div className="flex flex-col lg:absolute lg:inset-y-4 lg:left-4 lg:z-10 lg:w-[272px] lg:gap-3 xl:w-[300px]">
          <div className={cn("lg:min-h-0 lg:overflow-hidden", PANEL)}>
            <div className="px-4 pb-3 pt-4">
              <Block className="h-5 w-3/5" />
              <Block className="mt-2 h-3 w-2/5" />
            </div>
            <div className="space-y-2 px-4 pb-4">
              {ROWS.map((row) => (
                <Block key={row} className="h-9" />
              ))}
            </div>
          </div>

          <div className={cn("order-first px-4 py-3 lg:order-none lg:mt-auto lg:shrink-0 lg:p-3", PANEL)}>
            <Block className="h-3 w-24" />
            <div className="mt-3 grid grid-cols-5 gap-1">
              {BINS.map((bin) => (
                <Block key={bin} className="h-3" />
              ))}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex flex-col lg:absolute lg:right-4 lg:top-4 lg:z-10 lg:max-h-[calc(100%_-_2rem)] lg:w-[320px] lg:overflow-hidden xl:w-[360px]",
            PANEL,
          )}
        >
          <div className="shrink-0 border-b border-[var(--border-soft)] px-4 py-4">
            <Block className="h-9 w-full" />
          </div>
          <div className="space-y-4 px-4 py-4 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
            <Block className="h-6 w-3/4" />
            <Block className="h-3 w-1/2" />
            <div className="space-y-3 pt-2">
              {PILLARS.map((pillar) => (
                <Block key={pillar} className="h-8" />
              ))}
            </div>
            <Block className="h-40 w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
