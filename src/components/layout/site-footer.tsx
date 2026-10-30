import Image from "next/image";
import Link from "next/link";

import { GpbSuiteBadge, PimPamLogoPlate } from "@/components/layout/gpb-suite-branding";
import { countryWorkspaceLinks, footerNavItems } from "@/components/layout/site-links";
import { getAllReleaseMetadata, getGlobalReleaseSummary } from "@/lib/release-metadata";
import ldtLogo from "../../../images/ldt-logo-dark.png";

const footerLinkClass =
  "inline-flex min-h-8 items-center text-sm text-[var(--gpb-chrome-link)] transition-colors duration-200 hover:text-[var(--gpb-chrome-active)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gpb-chrome-focus)]";

/**
 * The site footer, per the page patterns report: what is measured, who built and funded it,
 * the ways to the data, and the producers' marks. It does not repeat the header's links.
 */
export function SiteFooter() {
  const summary = getGlobalReleaseSummary();
  const names = new Intl.ListFormat("en", { type: "conjunction" }).format(
    [...getAllReleaseMetadata()].sort((a, b) => a.countryName.localeCompare(b.countryName)).map((release) => release.countryName),
  );

  return (
    <footer className="mt-auto border-t border-[var(--gpb-chrome-divider)] bg-[var(--gpb-chrome-bg)] text-[var(--gpb-chrome-active)] print:hidden">
      <div className="mx-auto grid w-full max-w-7xl gap-x-12 gap-y-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,0.7fr)] lg:px-10">
        <section>
          <Link
            href="/"
            className="inline-flex focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gpb-chrome-focus)]"
            aria-label="Local Development Tracker home"
          >
            <Image src={ldtLogo} alt="Local Development Tracker" className="h-12 w-auto object-contain" />
          </Link>
          <p className="mt-5 max-w-md text-base leading-7 text-[var(--gpb-chrome-active)]">
            Local development scores for {summary.totalLoadedLocalUnits.toLocaleString("en-US")} local governments in {names}, from satellite and open
            data.
          </p>
          <p className="mt-3 max-w-md text-sm leading-6 text-[var(--gpb-chrome-link)]">
            Built by the World Bank Global PIM-PAM Solutions Team, with support from the World Bank Financial Management Umbrella Program and the Japan
            Quality of Infrastructure Investment Partnership program.
          </p>
        </section>

        <nav aria-labelledby="footer-data">
          <h2 id="footer-data" className="text-sm font-semibold text-[var(--gpb-chrome-active)]">
            The data
          </h2>
          <ul className="mt-3">
            {footerNavItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={footerLinkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-countries">
          <h2 id="footer-countries" className="text-sm font-semibold text-[var(--gpb-chrome-active)]">
            Countries
          </h2>
          <ul className="mt-3">
            {countryWorkspaceLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={footerLinkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-[var(--gpb-chrome-divider)]">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-8 gap-y-5 px-4 py-6 sm:px-6 lg:px-10">
          <GpbSuiteBadge />
          <PimPamLogoPlate className="w-44 p-2.5" />
        </div>
      </div>
    </footer>
  );
}
