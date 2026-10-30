"use client";

import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";

import { SHARED_VIEW_PARAMS, countryHref, countryWorkspaceLinks, currentCountry } from "@/components/layout/site-links";
import { cn } from "@/lib/utils";

/**
 * The header's country menu. Base UI's menu gives arrow keys, type-ahead, and Escape; each
 * item is a link, so it opens in a new tab like any other.
 */
export function CountrySwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const current = currentCountry(pathname);

  // Carry the view's shared parameters, read at click time so the header needs no search-params boundary.
  function keepView(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!href.endsWith("/analytics") || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const params = new URLSearchParams(window.location.search);
    const kept = new URLSearchParams(SHARED_VIEW_PARAMS.flatMap((name) => (params.get(name) ? [[name, params.get(name)!]] : [])));
    if (kept.size === 0) return;
    event.preventDefault();
    router.push(`${href}?${kept.toString()}`);
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-sm px-3 text-sm font-semibold text-[var(--gpb-chrome-link)] transition-colors duration-200 hover:text-[var(--gpb-chrome-active)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gpb-chrome-focus)] data-[popup-open]:text-[var(--gpb-chrome-active)]",
          current && "text-[var(--gpb-chrome-active)]",
        )}
      >
        {current ? current.label : "Countries"}
        <ChevronDown aria-hidden="true" className="size-4 transition-transform duration-150 ease-out motion-reduce:transition-none [[data-popup-open]_&]:rotate-180" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="start" className="isolate z-50">
          <Menu.Popup className="min-w-44 origin-(--transform-origin) rounded-md border border-[var(--border-strong)] bg-[var(--surface-strong)] p-1 text-ink shadow-float duration-150 ease-out data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:animate-none">
            {countryWorkspaceLinks.map((country) => {
              const href = countryHref(pathname, country.href);
              const active = current?.href === country.href;
              return (
                <Menu.LinkItem
                  key={country.href}
                  closeOnClick
                  render={<Link href={href} onClick={(event) => keepView(event, href)} aria-current={active ? "page" : undefined} />}
                  className="flex min-h-9 items-center justify-between gap-6 rounded-sm px-2.5 text-sm outline-none select-none data-[highlighted]:bg-[var(--surface-muted)]"
                >
                  {country.label}
                  {active ? <Check aria-hidden="true" className="size-4 text-accent" /> : null}
                </Menu.LinkItem>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
