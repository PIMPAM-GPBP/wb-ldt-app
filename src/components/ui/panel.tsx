// Panel: a floating surface with the one shadow.
// Use it for panels over a map and for popovers built by hand.
// Page sections and cards do not float; use Section or Card for those.
import * as React from "react"

import { cn } from "@/lib/utils"

function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel"
      className={cn(
        "rounded-xl border border-[var(--border-strong)] bg-[var(--surface-strong)] p-4 text-sm text-foreground shadow-float",
        className
      )}
      {...props}
    />
  )
}

export { Panel }
