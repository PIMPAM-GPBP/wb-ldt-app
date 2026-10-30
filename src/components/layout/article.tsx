// Article: the layout for the reading pages (About, Methodology, Resources, Data updates). One title size, Inter body at 17px on a 68-character measure, and rules between
// sections instead of cards. Long pages pass a table of contents for wide screens.
import Image, { type StaticImageData } from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const ARTICLE_LINK =
  "rounded-sm text-accent underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid";

/** Body copy: 17px Inter at a readable measure. */
export const PROSE = "max-w-[68ch] space-y-5 text-[17px] leading-[1.75] text-ink";

export function ArticlePage({
  kicker,
  title,
  titleClassName,
  meta,
  lede,
  toc,
  children,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  /** For a title that must hold one line on wide screens, such as the QuickStart note's. */
  titleClassName?: string;
  meta?: ReactNode;
  lede?: ReactNode;
  toc?: ReadonlyArray<{ id: string; label: string }>;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-12 pb-24 sm:px-6 lg:px-10 lg:pt-16">
      <header>
        {kicker ? <p className="text-sm font-medium text-accent">{kicker}</p> : null}
        <h1 className={cn("mt-2 max-w-4xl font-heading text-4xl leading-[1.1] font-semibold tracking-tight text-ink sm:text-5xl", titleClassName)}>{title}</h1>
        {meta ? <p className="mt-3 text-sm text-ink-muted">{meta}</p> : null}
        {lede ? <div className="mt-6 max-w-3xl text-lg leading-8 text-ink sm:text-xl sm:leading-9">{lede}</div> : null}
      </header>
      <div className={cn("mt-12 lg:mt-16", toc && "lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-14")}>
        {toc ? (
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-xs font-medium text-ink-muted">On this page</p>
              <ul className="mt-3 space-y-2 border-l border-[var(--border-soft)] text-sm">
                {toc.map((entry) => (
                  <li key={entry.id}>
                    <a href={`#${entry.id}`} className="-ml-px block border-l border-transparent pl-3 leading-snug text-ink-muted hover:border-[var(--border-strong)] hover:text-ink">
                      {entry.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        ) : null}
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}

/** A top-level section: a rule, a Fira heading, and its content. */
export function ArticleSection({
  id,
  title,
  intro,
  children,
  className,
}: {
  id?: string;
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("mt-16 scroll-mt-24 border-t border-[var(--border-soft)] pt-8 first:mt-0", className)}>
      <h2 className="font-heading text-2xl leading-tight font-semibold text-ink sm:text-[1.75rem]">{title}</h2>
      {intro ? <div className={cn(PROSE, "mt-4")}>{intro}</div> : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}

/** Numbered steps with the number in the margin and a rule between steps. */
export function NumberedSteps({ steps }: { steps: ReadonlyArray<{ title?: string; body: ReactNode }> }) {
  return (
    <ol className="max-w-3xl divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">
      {steps.map((step, index) => (
        <li key={index} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 py-5">
          <span aria-hidden="true" className="font-heading text-2xl leading-none font-semibold tabular-nums text-ink-muted">
            {index + 1}
          </span>
          <div>
            {step.title ? <h3 className="font-heading text-lg leading-snug font-semibold text-ink">{step.title}</h3> : null}
            <div className={cn("text-base leading-7 text-ink", step.title && "mt-1.5")}>{step.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Titled entries in columns, each under a short rule. */
export function TermGrid({
  items,
  columns = 2,
}: {
  items: ReadonlyArray<{ title: ReactNode; body?: ReactNode; list?: readonly string[]; marker?: string }>;
  columns?: 2 | 3;
}) {
  return (
    <div className={cn("grid gap-x-10 gap-y-8", columns === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
      {items.map((item, index) => (
        <div key={index} className="border-t border-[var(--border-strong)] pt-4">
          <h3 className="flex items-center gap-2 font-heading text-lg leading-snug font-semibold text-ink">
            {item.marker ? <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.marker }} /> : null}
            {item.title}
          </h3>
          {item.body ? <div className="mt-2 text-base leading-7 text-ink">{item.body}</div> : null}
          {item.list ? (
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-7 text-ink marker:text-ink-muted">
              {item.list.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ArticleFigure({
  src,
  alt,
  caption,
  priority = false,
  className,
}: {
  src: StaticImageData;
  alt: string;
  caption?: ReactNode;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={className}>
      <Image src={src} alt={alt} priority={priority} className="h-auto w-full rounded-[4px] border border-[var(--border-soft)]" />
      {caption ? <figcaption className="mt-2.5 text-sm leading-6 text-ink-muted">{caption}</figcaption> : null}
    </figure>
  );
}

/** A single sentence set apart from the body. */
export function PullQuote({ children }: { children: ReactNode }) {
  return <p className="max-w-3xl border-l-2 border-accent pl-5 font-heading text-xl leading-8 text-ink">{children}</p>;
}
