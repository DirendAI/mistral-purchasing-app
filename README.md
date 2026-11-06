# Mistral Purchasing App

[![Mistral Studio App](https://img.shields.io/badge/Mistral_Studio-App-FF7000?logo=mistral)](https://docs.mistral.ai/studio/apps/overview)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/python-3.12%2B-blue.svg)](pyproject.toml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg?logo=typescript&logoColor=white)](apps/web/package.json)

A fresh [Mistral Studio app](https://docs.mistral.ai/studio/apps/overview) scaffolded from the
current `app` preset: a web frontend, a Python API, a Postgres database, and a workflow worker in
one deployable project, with hosting, authentication, and access control provided by Studio.

## Modules

Declared in [`mistral.json`](mistral.json):

- `apps/web` — TanStack Start frontend (Bun/NX), served at `/`.
- `apps/api` — FastAPI backend, served at `/api`, with the file-based router and health routes.
- `apps/worker` — durable workflow worker (Mistral Workflows platform); workflows live in
  `apps/worker/src/worker/workflows/`.
- `postgres` — managed Postgres database.

Capabilities are pinned in [`.mistral/capabilities.json`](.mistral/capabilities.json) from the
`@mistralai-capabilities` registry.

## Quickstart

Follow the [Studio Apps quickstart](https://docs.mistral.ai/studio/apps/quickstart):

1. Install Git, [uv](https://docs.astral.sh/uv/), Docker, Bun, and the
   [Mistral CLI](https://docs.mistral.ai/studio/mistral-cli).
2. Sign in: `mistral login`
3. Set `MISTRAL_API_KEY` in the generated `.env` file (gitignored — never commit it). The worker
   uses it to connect to Mistral. When deploying, set it in the **Secrets** tab of the app in
   Studio instead.
4. Start Docker (for the database), then run locally: `mistral dev`
5. Commit and push, then deploy: `mistral deploy` (CI on `master` runs
   `mistral apps deploy --yes` with the `MISTRAL_API_KEY` secret).

## Notes

- The root `package.json` pins `tailwindcss`/`@tailwindcss/vite` to `4.3.4`: npm's latest
  `tailwindcss@4.3.5` requires `@tailwindcss/oxide@4.3.5`, which was never published, so
  `bun install` fails to resolve it.
- Before writing a workflow in `apps/worker`, read
  `.agents/skills/capability-workflows/SKILL.md` (determinism and import rules, activity
  timeouts and retries, lint and test requirements).

## Docs

- [Apps overview](https://docs.mistral.ai/studio/apps/overview)
- [Quickstart](https://docs.mistral.ai/studio/apps/quickstart)
- [Local development](https://docs.mistral.ai/studio/apps/local-development)
- [Deploy](https://docs.mistral.ai/studio/apps/deploy)
- [Publish to Vibe](https://docs.mistral.ai/studio/apps/publish-to-vibe)
