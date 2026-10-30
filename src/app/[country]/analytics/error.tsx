"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import { getCountryBySlug } from "@/lib/countries";
import { cn } from "@/lib/utils";

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { country: slug } = useParams<{ country: string }>();
  const country = getCountryBySlug(slug);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 pb-16 pt-16 sm:px-8">
      <h1 className="font-heading text-2xl font-semibold tracking-tight text-ink">
        Analytics did not load
      </h1>
      <p className="text-base leading-7 text-ink-muted">
        {error.message || "Something went wrong while preparing this view."}
      </p>
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button size="lg" onClick={reset}>
          Try again
        </Button>
        <Link href={`/${slug}`} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          Back to {country?.name ?? "country page"}
        </Link>
      </div>
    </main>
  );
}
