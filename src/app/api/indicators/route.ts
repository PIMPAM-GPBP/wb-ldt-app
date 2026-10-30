import { buildIndicatorsCsv } from "@/lib/downloads";

export const dynamic = "force-static";

/** The indicator list behind the Methodology table, as one CSV for every country. */
export async function GET() {
  const { csv, fileName } = await buildIndicatorsCsv();
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${fileName}"` },
  });
}
