import Image from "next/image";

import { cn } from "@/lib/utils";
import gpbLogo from "../../../images/gpb-logo.png";
import gpbpLogo from "../../../images/gpbp_logo.webp";
import pimpamLogo from "../../../images/pimpam_logo.png";

type GpbSuiteBadgeProps = {
  compact?: boolean;
};

export function GpbSuiteBadge({ compact = false }: GpbSuiteBadgeProps) {
  return (
    <a
      href="https://pim-pam.net/web-applications/#gpbp"
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex min-h-16 items-center gap-3 border-[var(--gpb-chrome-divider)] text-[var(--gpb-chrome-active)] transition-colors duration-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gpb-chrome-focus)]",
        compact ? "border-t pt-4" : "border-l pl-6",
      )}
      aria-label="Open the GPB Suite page"
    >
      <Image
        src={gpbpLogo}
        alt=""
        aria-hidden="true"
        className="h-10 w-12 object-contain"
      />
      <span className="text-sm font-semibold leading-tight">
        <span className="block">Part of the</span>
        <span className="block">GPB Suite</span>
      </span>
    </a>
  );
}

export function EcosystemLogoGrid() {
  return (
    <div className="grid gap-3 border-t border-[var(--gpb-chrome-divider)] pt-5 sm:grid-cols-2">
      <a
        href="https://pim-pam.net/web-applications/#gpbp"
        target="_blank"
        rel="noreferrer"
        className="flex min-h-16 items-center rounded-sm bg-[var(--gpb-chrome-plate)] p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gpb-chrome-focus)]"
      >
        <Image
          src={gpbLogo}
          alt="GPB Tools"
          className="h-12 w-auto object-contain"
        />
      </a>
      <PimPamLogoPlate className="min-h-16 p-2" />
    </div>
  );
}

export function PimPamLogoPlate({ className }: { className?: string }) {
  return (
    <a
      href="https://pim-pam.net/"
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center rounded-sm bg-[var(--gpb-chrome-plate)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gpb-chrome-focus)]",
        className,
      )}
    >
      <Image
        src={pimpamLogo}
        alt="PIM PAM"
        className="h-auto w-full object-contain"
      />
    </a>
  );
}
