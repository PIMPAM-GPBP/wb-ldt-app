"use client";

import { Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildBriefMarkdown, type BriefData } from "@/lib/brief/document";

/** Print and Markdown download. Both carry the brief's status line and notes. */
export function BriefActions({ brief }: { brief: BriefData }) {
  function downloadMarkdown() {
    const markdown = buildBriefMarkdown(brief, window.location.href);
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `planning-brief-${brief.sheetId.replaceAll(".", "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer aria-hidden data-icon="inline-start" />
        Print
      </Button>
      <Button variant="outline" size="sm" onClick={downloadMarkdown}>
        <Download aria-hidden data-icon="inline-start" />
        Download Markdown
      </Button>
    </div>
  );
}
