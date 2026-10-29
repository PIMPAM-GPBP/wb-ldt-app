import type {
  CountryTrustModel,
  CountryTrustStatus,
} from "@/lib/country-trust";

function statusClassName(status: CountryTrustStatus) {
  if (status === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "partial") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-rose-200 bg-rose-50 text-rose-800";
}

function statusLabel(status: CountryTrustStatus) {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "partial") {
    return "Partial";
  }

  return "Blocked";
}

export function CountryTrustCard({ model }: { model: CountryTrustModel }) {
  return (
    <section
      id="country-trust-card"
      className="mx-auto mt-8 w-full max-w-7xl px-6 sm:px-8 lg:px-12"
      aria-labelledby={`${model.countryName.toLowerCase()}-trust-heading`}
    >
      <article className="rounded-[1.4rem] border border-[var(--border-strong)] bg-[var(--surface)] p-6 shadow-[0_16px_38px_rgba(2,20,32,0.07)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Country Trust Card
            </p>
            <h2
              id={`${model.countryName.toLowerCase()}-trust-heading`}
              className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]"
            >
              Release trust and AI readiness
            </h2>
          </div>
          <p className="text-sm leading-7 text-[var(--muted-foreground)]">
            {model.releaseKey} · {model.methodologyVersion}
          </p>
        </div>

        <dl className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {model.items.map((item) => (
            <div
              key={item.label}
              className="rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4"
            >
              <dt className="flex items-start justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  {item.label}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClassName(item.status)}`}
                >
                  {statusLabel(item.status)}
                </span>
              </dt>
              <dd className="mt-3">
                <p className="text-xl font-semibold text-[var(--foreground)]">
                  {item.value}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  {item.detail}
                </p>
              </dd>
            </div>
          ))}
        </dl>

        {model.caveats.length > 0 ? (
          <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              Caveats
            </p>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-[var(--muted-foreground)] md:grid-cols-2">
              {model.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>
    </section>
  );
}
