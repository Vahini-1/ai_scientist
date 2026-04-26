import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { GeneratePlanRequestSchema } from "./schema.js";
import { runSearches } from "./tavily.js";
import { saveExpertMemoryCorrection } from "./supabase.js";
import { generatePlanWithAzureClaude } from "./azure.js";
import { ResearchAgent } from "./researchAgent.js";
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.post("/api/generate-plan", async (req, res) => {
    const parsed = GeneratePlanRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid request body",
            details: parsed.error.flatten(),
        });
    }
    const { hypothesis, experimentType, isReviewing, editedText } = parsed.data;
    try {
        if (isReviewing) {
            if (!editedText || editedText.trim().length < 5) {
                return res.status(400).json({ error: "`editedText` is required when `isReviewing` is true" });
            }
            const saved = await saveExpertMemoryCorrection({ experimentType, hypothesis, editedText });
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
        const plan = await generatePlanWithAzureClaude({
            hypothesis,
            experimentType,
            searches,
            expertMemory,
            noveltyPapers,
            marketData,
        });
        return res.json(plan);
    }
    catch (e) {
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
