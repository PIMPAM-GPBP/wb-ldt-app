// Class strings shared by the atlas panels, so the label and focus styles are decided once.

/** The one uppercase label style, for headings inside tool panels only. */
export const PANEL_LABEL = "text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted";

/** Focus ring for controls with room around them. */
export const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Focus ring drawn inside the control, for rows that fill the width of a scrolling panel. */
export const FOCUS_RING_INSET = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";

/** Text field in a panel or bar. 44px and 16px type on touch screens, so iOS does not zoom on focus. 36px and 14px from md up. */
export const TEXT_FIELD =
  "h-11 w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-base text-ink placeholder:text-ink-muted md:h-9 md:text-sm";
