# AI Scientist — Scientific Workstation (SOW)

Demo link: https://drive.google.com/file/d/1GKoETgcpLRbzsTixxDQ6TExnfK14fYYT/view?usp=sharing
This repo contains a **Vite + React** frontend and an **Express + TypeScript** backend that generates an operational experiment report (protocol, materials, budget, timeline, novelty) and provides report chat + export.

## Monorepo structure

- `frontend/`: Vite React app (UI + report tabs + export)
- `backend/`: Express server (plan generation, novelty check, report chat, review/memory sync)
- `vercel.json`: local/preview routing configuration (see “Deployment / Routing”)

## Features (what the app does)

- **Generate report** from a hypothesis + constraints:
  - Summary (including executive summary)
  - Protocol & validation
  - Materials & supply chain
  - Budget & finance
  - Parameters (vendor/sample size/automation)
  - Detailed timeline (Mermaid gantt)
  - Literature + expert memory
- **Report chat**: contextual Q&A against the full report object.
- **Read/Review per-tab toggles**: Read blocks edits; Review enables editing + memory submission.
- **Export**: PDF/DOCX export from the structured experiment export dataset.
- **Archive**: closed reports are archived and persisted in local storage and can be reopened from the library.

## Prerequisites

- **Node.js**: use an LTS version (Node 20 or 22 recommended).
- `npm` (or `pnpm`/`bun`, but the repo is currently wired around npm scripts).

## Quickstart (local)

### 1) Install dependencies

From repo root:

```bash
npm install --prefix frontend
npm install --prefix backend
```

### 2) Configure backend environment

Backend reads environment variables via `backend/src/env.ts` and requires keys for:

- `TAVILY_API_KEY`
- `SEMANTIC_SCHOLAR_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION` (default exists but still must be set in env if you want to override)

Create/update:

- `backend/.env`

### 3) Run backend

```bash
npm run dev --prefix backend
```

Backend default:
- `http://localhost:8787`
- health: `GET /health`

### 4) Run frontend

```bash
npm run dev --prefix frontend
```

Frontend default dev port is `8080`, but if that port is in use Vite will move to the next available port.
Check the terminal output for the active URL (e.g. `http://127.0.0.1:8083/`).

The frontend proxies API calls to backend via `frontend/vite.config.ts`:
- `/api/*` → backend
- `/health` → backend

## Core API endpoints

Backend routes live in `backend/src/index.ts`:

- `POST /api/generate-plan`
  - Input: `{ hypothesis, constraints?, experimentType?, isReviewing? ... }`
  - Output: structured `Plan` JSON (protocol/materials/budget/timeline/etc.)
- `POST /api/novelty-check`
  - Input: `{ hypothesis }`
  - Output: `{ noveltyStatus, priorPapers }`
- `POST /api/report-chat`
  - Input: `{ message, hypothesis, plan, noveltyStatus? }`
  - Output: `{ reply }`

## Report generation + data grounding

The backend gathers grounding context before generating the final plan:

- Semantic Scholar novelty search
- Tavily market/supplier search
- Tavily general searches
- Expert memory corrections (Supabase)

### Token safety (Azure context length)

If you see:

> `context_length_exceeded` / “Input tokens exceed the configured limit …”

It means the prompt payload was too large.

Fix in this repo:
- `backend/src/azure.ts` prunes and strips large search payloads (especially `raw_content`) before sending the request to Azure.

## Export

Export code:
- `frontend/src/lib/export.ts`

Export data source:
- `frontend/src/data/experiments/index.ts`

If you want exports to reflect the live generated report, you can extend export to build `experimentData` from `planByReportId[activeReportId]` instead of (or in addition to) the static dataset.

## Archive / Library persistence

Reports, plans, chat threads, and parameters are persisted in local storage from:
- `frontend/src/context/workstation-context.tsx`

Closing a report archives it (does not delete it). Archived reports can be reopened from the research library.

## Troubleshooting

### “Backend not connected”

- Ensure backend is running on `http://localhost:8787`
- Confirm `GET /health` returns `{ ok: true }`
- Ensure frontend dev server is using the correct proxy target in `frontend/vite.config.ts`

### “localhost is blank”

Most common causes:

- **Vite is running on a different port** (8081/8082/8083…) because 8080 is in use.
  - Use the exact URL printed by Vite (example: `http://127.0.0.1:8083/`)
- **Runtime error** in the browser (check devtools console).
  - A common symptom is “ReferenceError: X is not defined” from a missing import in a component.

### “Azure model returned no content”

Azure sometimes returns data in alternate shapes (e.g., tool calls) rather than `message.content`.
The backend uses a robust extractor in `backend/src/azure.ts` to handle these cases.

## Deployment / Routing

`vercel.json` defines experimental service routing (frontend + backend entrypoints).
In local dev, the frontend proxy handles `/api/*` to backend.

## Scripts

Frontend (`frontend/package.json`):
- `npm run dev --prefix frontend`
- `npm run build --prefix frontend`
- `npm run lint --prefix frontend`

Backend (`backend/package.json`):
- `npm run dev --prefix backend`
- `npm run build --prefix backend`
- `npm run lint --prefix backend`
