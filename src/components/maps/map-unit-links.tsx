"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Opens the clicked unit of a server-rendered map in the workspace. One handler on the wrapper
 * replaces a link per unit, which on Nepal's 751 units more than halved the page. The map is
 * a pointer shortcut; the ranked lists beside it are the keyboard route to the same pages.
 */
export function MapUnitLinks({ hrefBase, children }: { hrefBase: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <div
      className="[&_path[data-k]]:cursor-pointer [&_path[data-k]:hover]:opacity-80"
      onClick={(event) => {
        const key = (event.target as Element).closest("[data-k]")?.getAttribute("data-k");
        if (key) router.push(`${hrefBase}${encodeURIComponent(key)}`);
      }}
    >
      {children}
    </div>
  );
}
