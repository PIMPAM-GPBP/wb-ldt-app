// Section: a full-width page block with a top rule and one heading size.
// Use it for the main blocks of a page in place of a card-in-card stack.
// Write the title in sentence case and keep the description to one short line.
import * as React from "react"

import { cn } from "@/lib/utils"

type HeadingLevel = "h1" | "h2" | "h3" | "h4"

type SectionProps = Omit<React.ComponentProps<"section">, "title"> & {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  headingLevel?: HeadingLevel
}

function Section({
  title,
  description,
  actions,
  headingLevel = "h2",
  className,
  children,
  ...props
}: SectionProps) {
  const Heading = headingLevel
  return (
    <section
      data-slot="section"
      className={cn("w-full border-t border-[var(--border-soft)] pt-6", className)}
      {...props}
    >
      <div
        data-slot="section-header"
        className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2"
      >
        <div className="min-w-0 flex-1">
          <Heading
            data-slot="section-title"
            className="font-heading text-xl leading-tight font-semibold text-ink"
          >
            {title}
          </Heading>
          {description ? (
            <p
              data-slot="section-description"
              className="mt-1 text-sm text-ink-muted"
            >
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div
            data-slot="section-actions"
            className="flex shrink-0 items-center gap-2"
          >
            {actions}
          </div>
        ) : null}
      </div>
      {children ? (
        <div data-slot="section-content" className="mt-5">
          {children}
        </div>
      ) : null}
    </section>
  )
}

export { Section }
export type { SectionProps }
