# Video scripts (≤60 seconds)

## 1) Demo Video (max 60 sec) — Demonstrate your project

**0–5s**\n- “This is AI Scientist SOW: a workstation that turns a hypothesis into a full operational experiment report.”

**5–20s**\n- “I enter a hypothesis and constraints like budget cap, timeline, and vendor preferences.”\n- “Click Generate: the system runs novelty check, searches suppliers, and produces a report.”

**20–40s**\n- “In the report, you get Protocol & Validation, Materials & Supply Chain with catalog numbers and source links, Budget & Finance totals, and a Detailed Timeline.”\n- “Each tab has a Read/Review toggle: Read is locked; Review enables edits.”

**40–55s**\n- “Edits can be submitted to Expert Memory for future plans.”\n- “Export generates a PDF/DOCX-ready output.”

**55–60s**\n- “Closed reports are archived in the Research Library and can be reopened later.”

## 2) Tech Video (max 60 sec) — Explain how you built it

**0–8s**\n- “This is a monorepo: Vite + React frontend and Express + TypeScript backend.”

**8–25s**\n- “The backend exposes `/api/generate-plan`, `/api/novelty-check`, and `/api/report-chat`.”\n- “Generation gathers grounding from Semantic Scholar and Tavily supplier search, then calls Azure chat completions to synthesize a structured JSON plan.”

**25–40s**\n- “We normalize outputs server-side for consistency: materials subtotal reconciles into budget totals, and protocol steps get phase defaults.”\n- “We also prune large search payloads before sending to Azure to avoid context-length errors.”

**40–55s**\n- “The frontend renders the report as tabs, persists reports and archive state to local storage, and gates edits with per-tab Read/Review toggles.”\n- “Export uses a structured experiment dataset for PDF/DOCX output.”

**55–60s**\n- “Overall, the system is designed to keep the whole report consistent across tabs and reusable through an archive.”

