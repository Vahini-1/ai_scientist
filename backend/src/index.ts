import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { GeneratePlanRequestSchema, NoveltyCheckRequestSchema } from "./schema.js";
import { runSearches } from "./tavily.js";
import { saveExpertMemoryCorrection } from "./supabase.js";
import { chatWithPlanContext, generatePlanWithAzureClaude, summarizeEditWithAzure } from "./azure.js";
import { ResearchAgent } from "./researchAgent.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res
    .status(200)
    .type("text")
    .send("OK. Try GET /health or POST /api/generate-plan");
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/novelty-check", async (req, res) => {
  const parsed = NoveltyCheckRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  try {
    // Avoid rushing novelty classification; allow sources to return fully.
    await new Promise(resolve => setTimeout(resolve, 1800));
    const hypothesis = parsed.data.hypothesis;
    const papers = await ResearchAgent.checkNovelty(hypothesis);
    const scored = (papers ?? [])
      .map((p: any) => {
        const text = `${p?.title ?? ""} ${p?.abstract ?? ""}`.toLowerCase();
        const score = simpleOverlapScore(hypothesis, text);
        return {
          title: String(p?.title ?? "").trim(),
          url: String(p?.url ?? "").trim(),
          doi: (p?.externalIds?.DOI ? String(p.externalIds.DOI) : undefined),
          year: (typeof p?.year === "number" ? p.year : undefined),
          citationCount: (typeof p?.citationCount === "number" ? p.citationCount : undefined),
          score,
        };
      })
      .filter((p: any) => p.url && p.title)
      .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 5);

    const best = scored[0]?.score ?? 0;
    const noveltyStatus =
      scored.length === 0 ? "not found" :
        best >= 0.33 ? "exact match found" :
          best >= 0.18 ? "similar work exists" :
            "not found";

    return res.json({ noveltyStatus, priorPapers: scored });
  } catch (e: any) {
    return res.status(500).json({ error: "novelty-check failed", message: e?.message ?? String(e) });
  }
});

app.post("/api/summarize-change", async (req, res) => {
  const before = String(req.body?.before ?? "");
  const after = String(req.body?.after ?? "");
  if (!before.trim() || !after.trim()) {
    return res.status(400).json({ error: "before and after are required" });
  }
  try {
    const summary = await summarizeEditWithAzure({ before, after });
    return res.json(summary);
  } catch (e: any) {
    return res.status(500).json({ error: "summarize-change failed", message: e?.message ?? String(e) });
  }
});

app.post("/api/report-chat", async (req, res) => {
  const message = String(req.body?.message ?? "").trim();
  const hypothesis = String(req.body?.hypothesis ?? "").trim();
  const plan = req.body?.plan;
  const noveltyStatus = req.body?.noveltyStatus ? String(req.body.noveltyStatus) : undefined;
  if (!message) return res.status(400).json({ error: "message is required" });
  try {
    const reply = await chatWithPlanContext({ message, hypothesis, plan, noveltyStatus });
    return res.json({ reply });
  } catch (e: any) {
    const fallback = heuristicReportReply(message, plan, noveltyStatus);
    return res.json({ reply: fallback });
  }
});

app.post("/api/generate-plan", async (req, res) => {
  const parsed = GeneratePlanRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten(),
    });
  }

  const { hypothesis, constraints, experimentType, isReviewing, editedText, correction } = parsed.data;

  try {
    if (isReviewing) {
      if (!editedText || editedText.trim().length < 5) {
        return res.status(400).json({ error: "`editedText` is required when `isReviewing` is true" });
      }

      const saved = await saveExpertMemoryCorrection({ experimentType, hypothesis, editedText, correction });
      if (!saved.ok) {
        return res.status(500).json({
          error: "Failed saving review to Supabase ExpertMemory",
          details: saved.error,
        });
      }

      return res.json({ ok: true });
    }

    // Gather research context FIRST (tab-specific grounding).
    const [expertMemory, noveltyPapers, marketData, searches] = await Promise.all([
      ResearchAgent.getExpertMemory(experimentType),
      ResearchAgent.checkNovelty(hypothesis), // Literature & Grounding tab
      ResearchAgent.getMarketData(hypothesis), // Materials & Supply Chain tab
      runSearches(hypothesis), // extra general grounding (protocol, etc.)
    ]);

    // Surface novelty/prior work assessment FIRST (so UI can flag early and link priors).
    // The model will still compute the final `summary.noveltyStatus`, but this makes it explicit
    // that novelty checking happens before plan generation.
    const priorPapers = (noveltyPapers ?? [])
      .map((p: any) => ({
        title: String(p?.title ?? "").trim(),
        url: String(p?.url ?? "").trim(),
        doi: (p?.externalIds?.DOI ? String(p.externalIds.DOI) : undefined),
        year: (typeof p?.year === "number" ? p.year : undefined),
        citationCount: (typeof p?.citationCount === "number" ? p.citationCount : undefined),
      }))
      .filter((p: any) => p.url && p.title)
      .slice(0, 5);

    const plan = await generatePlanWithAzureClaude({
      hypothesis,
      constraints,
      requestedDuration: extractRequestedDuration(constraints),
      experimentType,
      searches,
      expertMemory,
      noveltyPapers,
      marketData,
    });

    return res.json({
      ...plan,
      // Extra field for UI/debug. Safe to ignore if client doesn’t use it.
      noveltyCheck: {
        priorPapers,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      error: "generate-plan failed",
      message: e?.message ?? String(e),
    });
  }
});

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${env.PORT}`);
});

function simpleOverlapScore(a: string, b: string) {
  const toks = (s: string) =>
    Array.from(new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(w => w.length >= 4)));
  const A = toks(a);
  if (A.length === 0) return 0;
  let hit = 0;
  for (const t of A) if (b.includes(t)) hit++;
  return hit / A.length;
}

function heuristicReportReply(message: string, plan: any, noveltyStatus?: string) {
  const m = message.toLowerCase();
  if (m.includes("novelty")) {
    return `Current novelty signal is "${noveltyStatus ?? plan?.summary?.noveltyStatus ?? "not found"}".`;
  }
  if (m.includes("budget")) {
    const total = plan?.summary?.totalBudget ?? (Array.isArray(plan?.budget) ? plan.budget.reduce((s: number, b: any) => s + (b.amount || 0), 0) : undefined);
    return total ? `Current estimated total budget is ${total}. I can break it down by category if you want.` : "Budget data is not available yet for this report.";
  }
  if (m.includes("timeline") || m.includes("week")) {
    const weeks = Array.isArray(plan?.timeline?.weeks) ? plan.timeline.weeks.length : 0;
    return weeks ? `The plan currently has ${weeks} timeline weeks. I can summarize the critical path next.` : "Timeline has not been generated yet.";
  }
  return "I can help refine protocol, budget, materials, timeline, or novelty. Tell me which section to improve and your constraint changes.";
}

function extractRequestedDuration(constraints?: string) {
  if (!constraints) return undefined;
  const s = constraints.toLowerCase();
  const day = s.match(/(\d+)\s*day/);
  if (day) return `${day[1]} days`;
  const week = s.match(/(\d+)\s*week/);
  if (week) return `${week[1]} weeks`;
  return undefined;
}

