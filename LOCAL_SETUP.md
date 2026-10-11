# Run LDT locally

This repository contains the Next.js LDT web application for Nepal, Zambia, and Serbia.
The [datacube factory](https://github.com/PIMPAM-GPBP/wb-ldt-datacube-factory) is a separate Python pipeline that acquires source data and calculates indicators and scores.

## Choose the revision

Record the branch and commit before comparing local behavior with a deployment:

```sh
git branch --show-current
git rev-parse HEAD
```

A local branch can differ from the commit shown in the deployment dashboard.
Use the same revision when reproducing a deployment issue.

## Configure and start the app

Use [Node.js 20.9 or newer](https://nextjs.org/docs/app/getting-started/installation) and install from the repository lockfile.
Copy `.env.sample` to `.env.local`, then replace the database placeholders with values from an authorized project owner:

```sh
cp .env.sample .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`.
To check production-mode behavior, run `npm run build`, then `npm start`.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project API URL, required by the server client. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server database credential, required by the server client. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional public client key, unused by the current server client. |
| `NEXT_PUBLIC_APP_NAME` | Optional deployment setting, unused by the current source. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | AI generation credentials and model. The code defaults to `gpt-4.1-mini` when the model variable is absent. |
| `EXA_API_KEY` | Web search and content extraction for AI context. |
| `AI_GENERATION_ENABLED` | Set to `true` to allow production generation without an admin token. |
| `AI_ADMIN_TOKEN` | Optional server token for authorized production generation. |
| `AI_PROMPT_VERSION`, `AI_INVALIDATION_VERSION` | Optional cache-version controls, defaulting to `v2` and `v1`. |

The project URL and database credential must belong to the same Supabase project.
Account membership and application credentials are separate, so obtain both through the project owner.
Retrieve keys through the project's API Keys settings using [Supabase's guide](https://supabase.com/docs/guides/getting-started/api-keys).
Keep the service-role key, provider keys, and admin token in server settings or `.env.local`.
Do not commit them or add a `NEXT_PUBLIC_` prefix to a secret.
The current code uses the legacy service-role variable name; plan changes for Supabase's documented key transition separately.

OpenAI generates narratives, recommendations, plan alignment, and SWOT text.
Exa searches and extracts source content.
They do not calculate the published PIL scores.
Provider setup is documented in the [OpenAI API reference](https://developers.openai.com/api/reference/overview) and [Exa quickstart](https://exa.ai/docs/search/quickstart).
Leave their keys empty when testing views that do not use AI.
Development mode permits generation regardless of `AI_GENERATION_ENABLED`, so supplied keys can incur usage when AI actions run.

## Use an existing or new database

For an existing populated database, configuring the app does not require migrations or ingestion.
Packaged analytics JSON and GeoJSON allow some views to work without a database connection, while database records and AI caches still need working credentials.

A new empty database needs the migrations under `supabase/migrations/` in numeric order, the `analytics` schema [exposed to the Data API with its required grants](https://supabase.com/docs/guides/api/using-custom-schemas), and the input datasets under `data/`.
The current migration sequence is `0001` through `0012`.
For a deliberate database initialization, use these scripts in order:

```sh
npm run build:data -- --country all
npm run ingest:supabase -- --country all
npm run ingest:boundaries -- --country all
npm run ingest:province-plans -- --country all
```

`build:data` creates local analytics JSON and map files.
The ingestion scripts write to the configured database.
SNG display and strategy-inventory ingestion need their own reviewed CSV or JSON inputs.
Do not run these commands against a populated production database merely to start the app.

## Source APIs for the datacube factory

The factory's [source list](https://github.com/PIMPAM-GPBP/wb-ldt-datacube-factory#data-sources-and-domains) and [credential guide](https://github.com/PIMPAM-GPBP/wb-ldt-datacube-factory#credentials) describe the complete pipeline.
Earth Engine supplies flood, land-cover, and luminosity data.
[OpenWeatherMap](https://openweathermap.org/api/air-pollution) supplies air-pollution history, and [Mapbox](https://docs.mapbox.com/api/navigation/isochrone/) supplies accessibility isochrones.
Other configured sources include Geofabrik OSM, WorldPop, Climate TRACE, heatwave NetCDF files, and Ookla Parquet files.
Google credentials support Drive acquisition and approved development-plan publication to Cloud Storage.

Configure factory credentials in its separate runtime, not the webapp's `.env.local`.
Its names include `EE_SERVICE_ACCOUNT`, `EE_KEY_FILE`, `GOOGLE_APPLICATION_CREDENTIALS`, `OWM_API_KEY`, `MAPBOX_ACCESS_TOKEN`, and `EXA_API_KEY`.
An Earth Engine Cloud project must have its API enabled, registration completed, and [appropriate IAM access](https://developers.google.com/earth-engine/guides/access).
Select commercial or noncommercial registration according to [actual eligibility](https://earthengine.google.com/noncommercial/), including [noncommercial quotas and reverification](https://developers.google.com/earth-engine/guides/noncommercial_tiers).
Earth Engine uses Google authentication rather than a simple API key.
Google recommends [Application Default Credentials](https://developers.google.com/earth-engine/guides/service_account) for unattended execution, and the factory also supports an external service-account JSON key file.
Viewing the webapp's packaged boundaries and OpenStreetMap basemap does not require Earth Engine or Mapbox credentials.

## Verify a build

Check the country landing pages and analytics pages, detailed-metrics tables, plan availability, map selection, and CSV downloads for all three countries.
Server routes that read local JSON need those files in their deployment bundles.
After `npm run build`, run the repository's check of both country API traces:

```sh
node scripts/verify-country-api-tracing.mjs
```

This checks bundle contents; it does not replace testing the deployed app.
