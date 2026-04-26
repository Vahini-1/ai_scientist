import { env } from "./env.js";
import { PlanSchema } from "./schema.js";
function buildChatCompletionsUrl() {
    const base = env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, "");
    const dep = encodeURIComponent(env.AZURE_OPENAI_DEPLOYMENT);
    const apiVersion = encodeURIComponent(env.AZURE_OPENAI_API_VERSION);
    return `${base}/openai/deployments/${dep}/chat/completions?api-version=${apiVersion}`;
}
function extractJsonFromText(text) {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first)
        throw new Error("No JSON object found in model output");
    const jsonText = text.slice(first, last + 1);
    return JSON.parse(jsonText);
}
export async function generatePlanWithAzureClaude(args) {
    const { hypothesis, experimentType, searches, expertMemory, noveltyPapers, marketData } = args;
    const system = [
        "You are GPT-5.1-Codex acting as The AI Scientist backend planner.",
        "Return ONLY valid JSON. No markdown. No code fences. No extra keys.",
        "Citations must be URLs or DOIs as strings inside citations arrays.",
        "Be concrete and lab-actionable; assume a 10-week plan.",
        "",
        "You MUST compute `summary.noveltySignal` (0.0 to 1.0) based ONLY on the Semantic Scholar papers JSON below.",
        "Use factors like: number of close priors, recency, citation counts, and how directly they match the hypothesis.",
        "If there are many direct matches, noveltySignal should be low. If few/none and only distant priors, noveltySignal should be high.",
        "",
        "=== ExpertMemory (apply these corrections; prefer them when conflicting) ===",
        JSON.stringify(expertMemory),
        "",
        "=== Semantic Scholar novelty papers (authoritative for Novelty Signal + Literature tab) ===",
        JSON.stringify(noveltyPapers),
        "",
        "=== Market / supplier context (use for Materials tab: vendor, catalog #, price) ===",
        JSON.stringify(marketData),
    ].join("\n");
    const user = [
        `Hypothesis: ${hypothesis}`,
        `Experiment type: ${experimentType}`,
        "",
        "Tavily search results JSON:",
        JSON.stringify(searches),
        "",
        "Return JSON with this exact structure:",
        JSON.stringify({
            summary: { noveltySignal: 0, noveltyReason: "", totalBudget: 0 },
            protocol: [{ step: 1, instruction: "", duration: "", citations: [""] }],
            materials: [{ item: "", catalogNum: "", vendor: "", price: 0 }],
            budget: [{ category: "", description: "", amount: 0 }],
            timeline: { weeks: [{ week: 1, tasks: [""] }] },
            literature: [{ title: "", doi: "", relevance: "" }],
            memory: [{ id: "", experimentType: "", correction: "" }],
        }),
    ].join("\n");
    const url = buildChatCompletionsUrl();
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "api-key": env.AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({
            temperature: 0.2,
            max_tokens: 6000,
            messages: [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
            // If the Azure endpoint supports it, this pushes the model to return JSON only.
            response_format: { type: "json_object" },
        }),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Azure model call failed (${res.status}): ${errText}`);
    }
    const data = (await res.json());
    const content = data?.choices?.[0]?.message?.content;
    if (!content)
        throw new Error("Azure model returned no content");
    // Some endpoints still wrap JSON in prose; recover if needed.
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch {
        parsed = extractJsonFromText(content);
    }
    const validated = PlanSchema.safeParse(parsed);
    if (validated.success)
        return validated.data;
    // One repair attempt: ask the model to output the same object but valid.
    const repairRes = await fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "api-key": env.AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({
            temperature: 0,
            max_tokens: 6000,
            messages: [
                { role: "system", content: system },
                {
                    role: "user",
                    content: "Fix this to be VALID JSON matching the required schema EXACTLY. Output ONLY JSON.\n\n" +
                        content,
                },
            ],
            response_format: { type: "json_object" },
        }),
    });
    if (!repairRes.ok) {
        const errText = await repairRes.text().catch(() => "");
        throw new Error(`Azure model output invalid and repair failed (${repairRes.status}): ${errText}`);
    }
    const repairData = (await repairRes.json());
    const repairedContent = repairData?.choices?.[0]?.message?.content;
    if (!repairedContent)
        throw new Error("Azure repair call returned no content");
    const repairedParsed = JSON.parse(repairedContent);
    const repairedValidated = PlanSchema.parse(repairedParsed);
    return repairedValidated;
}
