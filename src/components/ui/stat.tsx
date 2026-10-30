// Stat: a small muted label over a headline number.
// Use it for a score, rank, or count that stands on its own.
// Pass delta as a signed number; it renders with a sign and a triangle,
// so the direction reads without color.
import * as React from "react"

import { cn } from "@/lib/utils"

type StatProps = Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode
  value: React.ReactNode
  unit?: React.ReactNode
  delta?: number
  deltaLabel?: React.ReactNode
  formatDelta?: (delta: number) => string
}

const defaultFormatDelta = (delta: number) =>
  Math.abs(delta).toLocaleString("en-US", { maximumFractionDigits: 1 })

function Stat({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  formatDelta = defaultFormatDelta,
  className,
  ...props
}: StatProps) {
  return (
    <div
      data-slot="stat"
      className={cn("flex min-w-0 flex-col gap-1", className)}
      {...props}
    >
      <span data-slot="stat-label" className="text-sm text-muted-foreground">
        {label}
      </span>
      <span
        data-slot="stat-value"
        className="font-heading text-2xl leading-none font-semibold tabular-nums text-foreground"
      >
        {value}
        {unit ? (
          <span
            data-slot="stat-unit"
            className="ml-1 font-sans text-sm font-normal text-muted-foreground"
          >
            {unit}
          </span>
        ) : null}
      </span>
      {delta !== undefined ? (
        <StatDelta delta={delta} format={formatDelta}>
          {deltaLabel}
        </StatDelta>
      ) : null}
    </div>
  )
}

function StatDelta({
  delta,
  format,
  children,
}: {
  delta: number
  format: (delta: number) => string
  children?: React.ReactNode
}) {
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat"
  const sign = direction === "up" ? "+" : direction === "down" ? "-" : ""
  return (
    <span
      data-slot="stat-delta"
      data-direction={direction}
      className={cn(
        "inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground",
        direction === "up" && "text-chart-3",
        direction === "down" && "text-destructive"
      )}
    >
      {direction !== "flat" ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 8 8"
          className={cn("size-2 fill-current", direction === "down" && "rotate-180")}
        >
          <path d="M4 1 7.5 7h-7z" />
        </svg>
      ) : null}
      <span className="font-medium">
        {sign}
        {format(delta)}
      </span>
      {children ? <span className="text-muted-foreground">{children}</span> : null}
    </span>
  )
}

export { Stat }
export type { StatProps }
