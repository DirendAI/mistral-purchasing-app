# Mistral Purchasing App

A [Mistral Studio app](https://docs.mistral.ai/studio/apps/overview) that tracks products you want
to buy and researches their current prices for you — near your location, on demand or on a schedule
you set per product.

## What it does

- **Settings screen** (`/settings`): your preferred location (address and optional coordinates),
  the search radius in km, and your currency. Stored per user in Postgres (`user_settings`).
- **Main screen** (`/`): the tracking list of your products, each showing the details of the last
  research run (status, best price and store, whether the target price was reached, and the full
  list of offers found).
- **Add-product dialog**: add a product by uploading a photo of it, or a photo URL, plus the store
  page where you saw it, a product URL you enter manually, an optional target price, and free-form
  extra AI context. Optionally start the first price research immediately.
- **Manual research**: a "Research now" button per product triggers a research run right away.
- **Custom schedule per product**: repeat the research on a cron expression (UTC) or a fixed
  interval, enabled/paused from the app. Schedules are Mistral Workflows schedules; the app keeps
  them in sync in `product_schedules`.

## Architecture

Scaffolded with `mistral apps init --preset app` (web + FastAPI + Postgres + workflow worker):

- `apps/web` — TanStack Start frontend. File-based routes; the typed API client in
  `src/api/generated` is generated from the FastAPI OpenAPI spec (`bunx nx run fastapi-tanstack-start:gen-types`).
- `apps/api` — FastAPI backend. File-based routers under `src/api/routers/api/v1` (all behind the
  gateway caller-auth rule: the gateway token is resolved to a principal id via `/v1/whoami`, and
  every row is scoped to it). Endpoints: settings get/put, product CRUD + photo + research
  history + manual research trigger + schedule get/put/delete.
- `apps/worker` — durable workflow worker. `worker/workflows/price_research.py` defines the
  `price-research` workflow: load product + settings, identify the product from its photo
  (vision), run a web-search agent for offers near the user's location, parse offers into
  structured findings, and persist the run and findings. All DB and model calls happen in
  activities; the entrypoint only sequences them.
- `packages/py/db` — SQLModel models + accessors + Alembic migrations. Tables:
  `user_settings`, `products`, `research_runs`, `price_findings`, `product_schedules`.

Research runs are recorded in `research_runs` (with the workflow execution id), and each offer in
`price_findings`. Scheduled runs are fired by Mistral Workflows schedules whose input carries
`{product_id, user_id, trigger: "schedule"}`.

## Run locally

```bash
# install tools (git, uv, Docker, bun, mistral CLI), then:
mistral login
# set MISTRAL_API_KEY in .env
mistral apps dev
```

Open the printed URL (e.g. `http://mistral-purchasing-app.apps.localhost:8080`). Docker must be
running for the local Postgres.

## Deploy

Push this repository to GitHub, connect it to your Mistral account, then:

```bash
mistral deploy
```

Set `MISTRAL_API_KEY` in the app's **Secrets** tab in Studio on the modules that need it.

## Checks

```bash
bash tools/uv.sh run --with pytest --with pytest-asyncio -- pytest apps/api/tests packages/py/db/tests apps/worker/tests -o asyncio_mode=auto
bunx nx run worker:semgrep                       # workflow determinism rules
bash tools/gen-types.sh --check                  # generated client matches the API
cd apps/web && bun run test && bunx tsc --noEmit -p tsconfig.json
bunx nx run web:build
```
