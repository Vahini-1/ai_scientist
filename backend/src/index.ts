import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { GeneratePlanRequestSchema, NoveltyCheckRequestSchema, type Plan } from "./schema.js";
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

    const rawPlan = await generatePlanWithAzureClaude({
      hypothesis,
      constraints,
      requestedDuration: extractRequestedDuration(constraints),
      experimentType,
      searches,
      expertMemory,
      noveltyPapers,
      marketData,
    });
    const plan = normalizePlan(rawPlan, constraints, marketData);

    return res.json({
      ...plan,
      // Extra field for UI/debug. Safe to ignore if client doesn’t use it.
      noveltyCheck: {
        priorPapers,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (e: any) {
    const rawMsg = String(e?.message ?? e ?? "");
    const finishReason = rawMsg.match(/finish_reason=([a-z_]+)/i)?.[1];
    return res.status(500).json({
      error: "generate-plan failed",
      message: rawMsg,
      attempt: finishReason === "length" ? "primary_or_compact_retry" : "unknown",
      finish_reason: finishReason,
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
  if (m.includes("material") || m.includes("vendor") || m.includes("catalog")) {
    const items = Array.isArray(plan?.materials) ? plan.materials.slice(0, 3) : [];
    if (items.length) {
      return `Top sourced items: ${items.map((i: any) => `${i.item} (${i.vendor} ${i.catalogNum})`).join("; ")}.`;
    }
    return "I do not have sourced materials yet; regenerate with market grounding enabled.";
  }
  if (m.includes("protocol") || m.includes("phase")) {
    const steps = Array.isArray(plan?.protocol) ? plan.protocol.slice(0, 3) : [];
    if (steps.length) {
      return `First phases: ${steps.map((s: any) => `${s.phase || "Phase"} - ${s.instruction}`).join("; ")}.`;
    }
  }
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
  return "I can review and improve any section. Ask for a concrete change (for example: reduce sequencing cost by 15%, replace vendors with Thermo/Qiagen only, or tighten protocol timeline by 2 weeks).";
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

function normalizePlan(plan: Plan, constraints?: string, marketData?: any): Plan {
  const marketCatalog = buildMarketCatalog(marketData);
  const materials = (plan.materials ?? []).map(m => {
    const hit = findBestMarketMatch(m.item, marketCatalog);
    const resolvedVendor = hit?.vendor ?? String(m.vendor ?? "").trim();
    const resolvedCatalog = hit?.catalogNum ?? String(m.catalogNum ?? "").trim();
    const resolvedPrice = Number.isFinite(hit?.price) ? Number(hit?.price) : m.price;
    return {
    ...m,
      vendor: resolvedVendor || "Unspecified vendor",
      catalogNum: resolvedCatalog || "TBD",
      price: Number.isFinite(resolvedPrice) ? Math.max(0, resolvedPrice) : 0,
      sourceUrl: hit?.sourceUrl ?? m.sourceUrl,
      sourceQuality: hit?.quality ?? "weak",
    };
  });
  const materialsSubtotal = materials.reduce((sum, m) => sum + m.price, 0);

  const budget = [...(plan.budget ?? [])];
  const materialsBudgetLine = {
    category: "Materials & Supply Chain",
    description: "Deterministic subtotal reconciled from materials table",
    amount: roundCurrency(materialsSubtotal),
  };
  const materialsBudgetIdx = budget.findIndex(line =>
    /material|reagent|supply/i.test(`${line.category} ${line.description}`)
  );
  if (materialsBudgetIdx >= 0) budget[materialsBudgetIdx] = materialsBudgetLine;
  else budget.unshift(materialsBudgetLine);

  const normalizedBudget = budget.map(line => ({
    ...line,
    amount: Number.isFinite(line.amount) ? Math.max(0, line.amount) : 0,
  }));
  const materialFloor = roundCurrency(materialsSubtotal);
  const nonMaterialTotal = normalizedBudget
    .filter(line => !/material|reagent|supply/i.test(`${line.category} ${line.description}`))
    .reduce((sum, line) => sum + line.amount, 0);
  const sanityTotal = roundCurrency(materialFloor + nonMaterialTotal);
  const totalBudget = roundCurrency(normalizedBudget.reduce((sum, line) => sum + line.amount, 0));
  const safeTotalBudget = Math.max(totalBudget, sanityTotal);
  const selectedVendors = Array.from(new Set(materials.map(m => m.vendor))).slice(0, 8);
  const sampleSize = parseSampleSize(constraints) ?? plan.parameters?.sampleSize ?? 48;
  const sampleSizeMin = Math.max(8, Math.round(sampleSize * 0.5));
  const sampleSizeMax = Math.max(sampleSizeMin + 8, Math.round(sampleSize * 2));
  const automationLevel = parseAutomationLevel(constraints) ?? plan.parameters?.automationLevel ?? "medium";
  const timelineWeeks = Math.max(1, plan.timeline?.weeks?.length || 1);

  const automationCostMultiplier = automationLevel === "high" ? 1.22 : automationLevel === "low" ? 0.92 : 1;
  const automationTimeMultiplier = automationLevel === "high" ? 0.82 : automationLevel === "low" ? 1.18 : 1;
  const sizeMultiplier = Math.max(0.5, sampleSize / 48);
  const estimatedCost = roundCurrency(safeTotalBudget * automationCostMultiplier * sizeMultiplier);
  const estimatedTimelineWeeks = roundCurrency(timelineWeeks * automationTimeMultiplier * (0.85 + sizeMultiplier * 0.15), 1);
  const reproducibility = Math.min(
    100,
    Math.max(50, Math.round((automationLevel === "high" ? 90 : automationLevel === "low" ? 65 : 78) - Math.max(0, sizeMultiplier - 1) * 4))
  );

  const executiveSummary = [
    `Novelty: ${plan.summary.noveltyStatus}.`,
    `Budget: $${safeTotalBudget.toLocaleString()} total with ${materials.length} materials.`,
    `Vendors: ${selectedVendors.slice(0, 3).join(", ") || "to be finalized"}.`,
    `Timeline: ${timelineWeeks} weeks planned (${estimatedTimelineWeeks} weeks projected at current parameters).`,
  ].join(" ");

  return {
    ...plan,
    protocol: (plan.protocol ?? []).map((p, idx) => ({
      ...p,
      phase: p.phase || inferPhaseName(p.instruction, idx),
    })),
    materials,
    budget: normalizedBudget,
    summary: {
      ...plan.summary,
      totalBudget: safeTotalBudget,
      selectedVendors,
      timelineWeeks,
      executiveSummary,
    },
    parameters: {
      selectedVendors,
      sampleSize,
      sampleSizeMin,
      sampleSizeMax,
      automationLevel,
    },
    impact: {
      estimatedCost,
      timelineWeeks: estimatedTimelineWeeks,
      sampleSize,
      reproducibility,
    },
  };
}

function parseSampleSize(constraints?: string): number | null {
  if (!constraints) return null;
  const patterns = [/sample size[^0-9]*(\d+)/i, /\bn\s*=\s*(\d+)/i, /(\d+)\s*samples?/i];
  for (const pattern of patterns) {
    const match = constraints.match(pattern);
    if (!match) continue;
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }
  return null;
}

function parseAutomationLevel(constraints?: string): "low" | "medium" | "high" | null {
  if (!constraints) return null;
  const s = constraints.toLowerCase();
  if (s.includes("high automation") || s.includes("fully automated") || s.includes("robotic")) return "high";
  if (s.includes("low automation") || s.includes("manual")) return "low";
  if (s.includes("medium automation") || s.includes("semi-automated")) return "medium";
  return null;
}

function roundCurrency(value: number, places = 2) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function inferPhaseName(instruction: string, idx: number) {
  const s = instruction.toLowerCase();
  if (s.includes("baseline") || s.includes("screen")) return "Preparation";
  if (s.includes("intervention") || s.includes("treat")) return "Intervention";
  if (s.includes("sample") || s.includes("collect")) return "Sampling";
  if (s.includes("analysis") || s.includes("sequence")) return "Analysis";
  return `Phase ${idx + 1}`;
}

function materialLookupKey(item: string) {
  return String(item || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(" ");
}

function buildMarketCatalog(marketData: any) {
  const out = new Map<string, { vendor: string; catalogNum: string; price: number; sourceUrl?: string; quality: "exact" | "partial" | "weak" }>();
  const rows = Array.isArray(marketData?.results) ? marketData.results : [];
  for (const row of rows) {
    const raw = `${row?.title ?? ""} ${row?.content ?? ""} ${row?.raw_content ?? ""}`;
    const vendor = normalizeVendor(raw.match(/\b(thermo fisher|thermo scientific|thermo|sigma|millipore sigma|qiagen|illumina|bio-rad|agilent)\b/i)?.[1] ?? "");
    const catalogNum = extractCatalog(raw, vendor);
    const priceText = raw.match(/(?:\$|usd\s*)(\d+(?:\.\d{1,2})?)/i)?.[1];
    const price = priceText ? Number(priceText) : NaN;
    const key = materialLookupKey(String(row?.title ?? ""));
    if (!key || !vendor || !catalogNum || !Number.isFinite(price)) continue;
    const sourceUrl = typeof row?.url === "string" ? row.url : undefined;
    const quality: "exact" | "partial" | "weak" =
      sourceUrl && /thermofisher|sigmaaldrich|qiagen|illumina|bio-rad|agilent/i.test(sourceUrl)
        ? "exact"
        : sourceUrl
          ? "partial"
          : "weak";
    out.set(key, {
      vendor,
      catalogNum,
      price,
      sourceUrl,
      quality,
    });
  }
  return out;
}

function findBestMarketMatch(item: string, catalog: Map<string, { vendor: string; catalogNum: string; price: number; sourceUrl?: string; quality: "exact" | "partial" | "weak" }>) {
  const key = materialLookupKey(item);
  if (catalog.has(key)) return catalog.get(key);
  const itemTokens = new Set(key.split(" "));
  let best: { score: number; row?: { vendor: string; catalogNum: string; price: number; sourceUrl?: string; quality: "exact" | "partial" | "weak" } } = { score: 0 };
  for (const [k, row] of catalog) {
    const kTokens = k.split(" ");
    const overlap = kTokens.filter(t => itemTokens.has(t)).length;
    const score = overlap / Math.max(1, Math.min(itemTokens.size, kTokens.length));
    if (score > best.score) best = { score, row };
  }
  return best.score >= 0.4 ? best.row : undefined;
}

function normalizeVendor(vendor: string) {
  const s = vendor.toLowerCase();
  if (s.includes("thermo")) return "Thermo Fisher";
  if (s.includes("sigma")) return "Sigma-Aldrich";
  if (s.includes("qiagen")) return "Qiagen";
  if (s.includes("illumina")) return "Illumina";
  if (s.includes("bio-rad")) return "Bio-Rad";
  if (s.includes("agilent")) return "Agilent";
  return vendor.trim();
}

function extractCatalog(raw: string, vendor: string) {
  const patterns: RegExp[] = [
    /\b([A-Z]{1,3}-\d{3,8}[A-Z0-9-]*)\b/,
    /\b([A-Z]{1,4}\d{4,8})\b/,
  ];
  if (/thermo/i.test(vendor)) patterns.unshift(/\b(A\d{4,8}|[A-Z]{1,2}\d{5,8})\b/);
  if (/sigma/i.test(vendor)) patterns.unshift(/\b(S\d{4,8}|[0-9]{5,8}-\d?[A-Z]?)\b/);
  for (const pattern of patterns) {
    const m = raw.match(pattern);
    if (m?.[1]) return m[1];
  }
  return "";
}

