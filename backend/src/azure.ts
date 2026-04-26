import { env } from "./env.js";
import { PlanSchema, type Plan } from "./schema.js";

function buildChatCompletionsUrl() {
  const base = env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, "");
  const dep = encodeURIComponent(env.AZURE_OPENAI_DEPLOYMENT);
  const apiVersion = encodeURIComponent(env.AZURE_OPENAI_API_VERSION);
  return `${base}/openai/deployments/${dep}/chat/completions?api-version=${apiVersion}`;
}

function extractJsonFromText(text: string): unknown {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) throw new Error("No JSON object found in model output");
  const jsonText = text.slice(first, last + 1);
  return JSON.parse(jsonText);
}

function extractModelText(choice: any): string | undefined {
  const message = choice?.message;
  const content = message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const joined = content
      .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
    if (joined) return joined;
  }
  const toolArgs = message?.tool_calls?.[0]?.function?.arguments;
  if (typeof toolArgs === "string" && toolArgs.trim()) return toolArgs.trim();
  return undefined;
}

export async function generatePlanWithAzureClaude(args: {
  hypothesis: string;
  constraints?: string;
  requestedDuration?: string;
  experimentType: string;
  searches: any;
  expertMemory: any[];
  noveltyPapers: any;
  marketData: any;
}): Promise<Plan> {
  const { hypothesis, constraints, requestedDuration, experimentType } = args;

  // --- TOKEN SAFETY: PRUNE ALL LARGE GROUNDING PAYLOADS ---
  const prunedMemory = (args.expertMemory || []).slice(0, 10);

  const prunedNovelty = Array.isArray(args.noveltyPapers)
    ? args.noveltyPapers.slice(0, 8).map((p: any) => ({
      title: p?.title,
      url: p?.url,
      year: p?.year,
      externalIds: p?.externalIds,
      abstract: typeof p?.abstract === "string" ? p.abstract.slice(0, 800) : undefined,
    }))
    : args.noveltyPapers;

  const prunedMarket = pruneTavilyLike(args.marketData, 8, 900);
  const prunedSearches = pruneTavilyLike(args.searches, 6, 900);
  // --- END TOKEN SAFETY ---

  const baseSystemLines = [
    "You are GPT-5.1-Codex acting as The AI Scientist backend planner.",
    "Return ONLY valid JSON. No markdown. No code fences. No extra keys.",
    "Citations must be URLs or DOIs as strings inside citations arrays.",
    "Be concrete and lab-actionable; derive realistic duration from the hypothesis and constraints.",
    "Use internal step-by-step reasoning before finalizing values, but output only final JSON.",
    "If the user provides an explicit duration (e.g., 14 days), you MUST respect it in timeline/protocol durations.",
    requestedDuration ? `Requested duration (hard preference): ${requestedDuration}. Do not default to 10 weeks.` : "Do not default to 10 weeks unless explicitly requested.",
    "",
    "HARD OUTPUT SIZE CAPS (to avoid truncation):",
    "- protocol: at most 10 steps",
    "- materials: at most 20 items",
    "- budget: at most 10 lines",
    "- timeline.weeks: at most 12 weeks",
    "- literature: at most 12 entries",
    "- memory: at most 10 entries",
    "",
    "Keep text concise:",
    "- summary.noveltyReason <= 300 chars",
    "- protocol[].instruction <= 240 chars",
    "- summary.executiveSummary <= 500 chars",
    "- timeline.weeks[].tasks: at most 4 short tasks per week",
    "",
    "You MUST compute `summary.noveltyStatus` based ONLY on the Semantic Scholar papers JSON below.",
    "Choose EXACTLY one of: \"not found\", \"similar work exists\", \"exact match found\".",
    "",
    "Threshold guidance:",
    "- \"not found\": no close priors; only distant/irrelevant papers OR empty results.",
    "- \"similar work exists\": related papers exist but do NOT match the same protocol/hypothesis 1:1.",
    "- \"exact match found\": one or more papers strongly indicate the same protocol/hypothesis already exists (near-duplicate).",
    "",
    "If noveltyStatus is \"similar work exists\" or \"exact match found\", you MUST populate `summary.priorPapers` with 1-5 best prior papers and include working URLs.",
    "If noveltyStatus is \"not found\", set `summary.priorPapers` to an empty array.",
    "",
    "=== ExpertMemory (apply these corrections; prefer them when conflicting) ===",
    JSON.stringify(prunedMemory),
    "",
    "=== Semantic Scholar novelty papers (authoritative for Novelty Signal + Literature tab) ===",
    JSON.stringify(prunedNovelty),
    "",
    "=== Market / supplier context (use for Materials tab: vendor, catalog #, price) ===",
    JSON.stringify(prunedMarket),
    "Materials must use real-looking catalog numbers, realistic prices, and sourceUrl links from market context when available.",
  ];

  const baseSystem = baseSystemLines.join("\n");

  const user = [
    `Hypothesis: ${hypothesis}`,
    `Constraints: ${constraints ?? ""}`,
    `Experiment type: ${experimentType}`,
    "",
    "Tavily search results JSON:",
    JSON.stringify(prunedSearches),
    "",
    "Return JSON with this exact structure:",
    JSON.stringify({
      summary: {
        noveltyStatus: "similar work exists",
        noveltyReason: "",
        priorPapers: [{ title: "", url: "https://example.com", doi: "10.0000/example", year: 2026 }],
        totalBudget: 0,
        selectedVendors: [""],
        timelineWeeks: 8,
        executiveSummary: "",
      },
      protocol: [{ step: 1, phase: "Preparation", instruction: "", duration: "", citations: [""] }],
      materials: [{ item: "", catalogNum: "", vendor: "", price: 0, sourceUrl: "https://example.com/item" }],
      budget: [{ category: "", description: "", amount: 0 }],
      timeline: { weeks: [{ week: 1, tasks: [""] }] },
      literature: [{ title: "", doi: "", relevance: "" }],
      memory: [{ id: "", experimentType: "", correction: "" }],
      parameters: {
        selectedVendors: [""],
        sampleSize: 48,
        sampleSizeMin: 24,
        sampleSizeMax: 96,
        automationLevel: "medium",
      },
      impact: {
        estimatedCost: 0,
        timelineWeeks: 8,
        sampleSize: 48,
        reproducibility: 75,
      },
    }),
  ].join("\n");

  const url = buildChatCompletionsUrl();

  async function callAzurePlan(systemContent: string, userContent: string, maxTokens: number) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "api-key": env.AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify({
        temperature: 0.2,
        max_completion_tokens: maxTokens,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Azure model call failed (${res.status}): ${errText}`);
    }
    const data = (await res.json()) as any;
    const finishReason = data?.choices?.[0]?.finish_reason;
    const content = extractModelText(data?.choices?.[0]);
    return { data, finishReason, content };
  }

  const compactSystem = [
    baseSystem,
    "",
    "COMPACT RETRY MODE:",
    "If you cannot fit everything, prioritize correctness over completeness.",
    "Do not exceed the caps. Prefer fewer items and shorter strings.",
    "Use generic but plausible entries instead of long explanations.",
  ].join("\n");

  const primary = await callAzurePlan(baseSystem, user, 6500);

  let finishReason = primary.finishReason;
  let content = primary.content;
  if (!content) {
    if (finishReason === "length") {
      const retry = await callAzurePlan(compactSystem, user, 6500);
      finishReason = retry.finishReason;
      content = retry.content;
    }
    if (!content) {
      throw new Error(`Azure model returned no content (finish_reason=${String(finishReason ?? "unknown")})`);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    if (finishReason === "length") {
      const retry = await callAzurePlan(compactSystem, user, 6500);
      finishReason = retry.finishReason;
      content = retry.content;
      if (!content) throw new Error(`Azure model returned no content (finish_reason=${String(finishReason ?? "unknown")})`);
      parsed = JSON.parse(content);
    } else {
      parsed = extractJsonFromText(content);
    }
  }

  const validated = PlanSchema.safeParse(parsed);
  if (validated.success) return validated.data;

  // If the model truncated, a repair prompt is likely to be too large/unreliable.
  // Prefer a compact retry that regenerates cleanly within caps.
  if (finishReason === "length") {
    const retry = await callAzurePlan(compactSystem, user, 6500);
    const retryContent = retry.content;
    if (!retryContent) {
      throw new Error(`Azure model returned no content (finish_reason=${String(retry.finishReason ?? "unknown")})`);
    }
    const retryParsed = JSON.parse(retryContent);
    return PlanSchema.parse(retryParsed);
  }

  const repair = await callAzurePlan(
    baseSystem,
    "Fix this to be VALID JSON matching the required schema EXACTLY. Output ONLY JSON.\n\n" + content,
    6500
  );
  if (!repair.content) {
    throw new Error(`Azure repair call returned no content (finish_reason=${String(repair.finishReason ?? "unknown")})`);
  }
  const repairedParsed = JSON.parse(repair.content);
  return PlanSchema.parse(repairedParsed);
}

function pruneTavilyLike(input: any, maxResults: number, maxTextChars: number) {
  // Tavily can return either:
  // - { results: [{ title, url, content, raw_content, ...}], answer?: string }
  // - or an array of results
  const results = Array.isArray(input?.results)
    ? input.results
    : Array.isArray(input)
      ? input
      : [];

  const prunedResults = results.slice(0, maxResults).map((r: any) => ({
    title: typeof r?.title === "string" ? r.title.slice(0, 200) : undefined,
    url: typeof r?.url === "string" ? r.url : undefined,
    content: typeof r?.content === "string" ? r.content.slice(0, maxTextChars) : undefined,
    // intentionally drop raw_content / html to avoid token blow-ups
  }));

  const answer = typeof input?.answer === "string" ? input.answer.slice(0, maxTextChars) : undefined;
  return { answer, results: prunedResults };
}

export async function summarizeEditWithAzure(args: { before: string; after: string }) {
  const url = buildChatCompletionsUrl();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "api-key": env.AZURE_OPENAI_API_KEY,
    },
    body: JSON.stringify({
      temperature: 0,
      max_completion_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Summarize user edits for memory storage. Output ONLY JSON with keys: before, after. Keep both concise and focused on the changed meaning.",
        },
        {
          role: "user",
          content: JSON.stringify(args),
        },
      ],
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Azure summarize failed (${res.status}): ${txt}`);
  }
  const data = (await res.json()) as any;
  const content = extractModelText(data?.choices?.[0]);
  if (!content) throw new Error("Azure summarize returned no content");
  const parsed = JSON.parse(content);
  return {
    before: String(parsed?.before ?? args.before).slice(0, 800),
    after: String(parsed?.after ?? args.after).slice(0, 800),
  };
}

export async function chatWithPlanContext(args: {
  message: string;
  hypothesis: string;
  plan: unknown;
  noveltyStatus?: string;
}) {
  const url = buildChatCompletionsUrl();
  const system = [
    "You are an interactive scientific planning assistant.",
    "Reply concisely and specifically to the user message using the report context.",
    "If user asks for revision suggestions, provide concrete edits.",
  ].join("\n");
  const user = JSON.stringify(args);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "api-key": env.AZURE_OPENAI_API_KEY,
    },
    body: JSON.stringify({
      temperature: 0.3,
      max_completion_tokens: 500,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Azure chat failed (${res.status}): ${txt}`);
  }
  const data = (await res.json()) as any;
  const content = extractModelText(data?.choices?.[0]);
  if (!content) throw new Error("Azure chat returned no content");
  return content.trim();
}