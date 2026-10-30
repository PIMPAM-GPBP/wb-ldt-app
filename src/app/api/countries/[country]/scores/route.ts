import { countries, getCountryBySlug } from "@/lib/countries";
import { buildScoresCsv } from "@/lib/downloads";

/** Every unit's pillar and component scores for every year in the edition, one row per unit and year. */
export async function GET(_request: Request, { params }: { params: Promise<{ country: string }> }) {
  const { country: slug } = await params;
  const country = getCountryBySlug(slug);
  if (!country) return new Response("Country not found.", { status: 404 });
  const { csv, fileName } = await buildScoresCsv(country);
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${fileName}"` },
  });
}

export function generateStaticParams() {
  return countries.filter((country) => country.analyticsStatus === "live").map((country) => ({ country: country.slug }));
}
