import Image from "next/image";

import { cn } from "@/lib/utils";
import ldtMark from "../../../images/ldt-mark-white.png";

/**
 * The LDT mark with the tool's full name beside it, for the dark site chrome. The mark is the
 * circle from ldt-logo-dark.png, cut out on a transparent background so it sits on any navy.
 */
export function LdtWordmark({ priority = false, className }: { priority?: boolean; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Image src={ldtMark} alt="" priority={priority} className="size-10 shrink-0" />
      <span className="font-heading text-lg leading-tight font-semibold text-[var(--gpb-chrome-active)]">Local Development Tracker</span>
    </span>
  );
}
