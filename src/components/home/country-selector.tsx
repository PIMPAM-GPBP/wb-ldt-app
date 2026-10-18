"use client";

import { useState } from "react";

import { ArrowRightIcon, Globe2Icon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

const countryOptions = [
  { value: "", label: "Select country workspace" },
  { value: "/nepal", label: "Nepal" },
  { value: "/serbia", label: "Serbia" },
  { value: "/zambia", label: "Zambia" },
  { value: "/vietnam", label: "Vietnam" },
] as const;

export function CountrySelector() {
  const router = useRouter();
  const [selectedRoute, setSelectedRoute] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRoute) {
      return;
    }

    router.push(selectedRoute);
  }

  return (
    <div
      id="country-workspaces"
      className="mt-4 w-full max-w-[48rem] scroll-mt-28 rounded-[1.25rem] border border-[var(--border-soft)] bg-[var(--surface-strong)] p-3 shadow-[0_14px_34px_rgba(2,20,32,0.07)] sm:p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 lg:flex-row lg:items-center"
      >
        <label className="sr-only" htmlFor="country-selector">
          Select a country
        </label>
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-[var(--muted-foreground)]">
            <Globe2Icon aria-hidden="true" className="size-5" />
          </span>
          <select
            id="country-selector"
            value={selectedRoute}
            onChange={(event) => setSelectedRoute(event.target.value)}
            className="h-[3.25rem] w-full appearance-none rounded-[0.95rem] border border-[var(--border-soft)] bg-[var(--surface)] pl-12 pr-12 text-sm font-semibold text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent-strong)] sm:text-base"
          >
            {countryOptions.map((option) => (
              <option
                key={option.value || "placeholder"}
                value={option.value}
                disabled={option.value === ""}
              >
                {option.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-[var(--muted-foreground)]">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="h-6 w-6"
            >
              <path
                d="M5 7.5L10 12.5L15 7.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
        <Button
          type="submit"
          disabled={!selectedRoute}
          className="h-[3.25rem] min-w-[10.5rem] rounded-[0.95rem] bg-[var(--accent-strong)] px-6 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(224,122,95,0.22)] hover:brightness-95 sm:text-base"
        >
          Open data
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Button>
      </form>
    </div>
  );
}
