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

export async function generatePlanWithAzureClaude(args: {
  hypothesis: string;
  constraints?: string;
  requestedDuration?: string;
  experimentType: string;
  searches: unknown;
  expertMemory: unknown[];
  noveltyPapers: unknown;
  marketData: unknown;
}): Promise<Plan> {
  const { hypothesis, constraints, requestedDuration, experimentType, searches, expertMemory, noveltyPapers, marketData } = args;

  const system = [
    "You are GPT-5.1-Codex acting as The AI Scientist backend planner.",
    "Return ONLY valid JSON. No markdown. No code fences. No extra keys.",
    "Citations must be URLs or DOIs as strings inside citations arrays.",
    "Be concrete and lab-actionable; derive realistic duration from the hypothesis and constraints.",
    "If the user provides an explicit duration (e.g., 14 days), you MUST respect it in timeline/protocol durations.",
    requestedDuration ? `Requested duration (hard preference): ${requestedDuration}. Do not default to 10 weeks.` : "Do not default to 10 weeks unless explicitly requested.",
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
    `Constraints: ${constraints ?? ""}`,
    `Experiment type: ${experimentType}`,
    "",
    "Tavily search results JSON:",
    JSON.stringify(searches),
    "",
    "Return JSON with this exact structure:",
    JSON.stringify({
      summary: {
        noveltyStatus: "similar work exists",
        noveltyReason: "",
        priorPapers: [{ title: "", url: "https://example.com", doi: "10.0000/example", year: 2026 }],
        totalBudget: 0,
      },
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
      // Azure OpenAI-compatible endpoints increasingly require `max_completion_tokens`
      // (and reject `max_tokens`) depending on the deployed model.
      max_completion_tokens: 6000,
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

  const data = (await res.json()) as any;
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Azure model returned no content");

  // Some endpoints still wrap JSON in prose; recover if needed.
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = extractJsonFromText(content);
  }

  const validated = PlanSchema.safeParse(parsed);
  if (validated.success) return validated.data;

  // One repair attempt: ask the model to output the same object but valid.
  const repairRes = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "api-key": env.AZURE_OPENAI_API_KEY,
    },
    body: JSON.stringify({
      temperature: 0,
      max_completion_tokens: 6000,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            "Fix this to be VALID JSON matching the required schema EXACTLY. Output ONLY JSON.\n\n" +
            content,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!repairRes.ok) {
    const errText = await repairRes.text().catch(() => "");
    throw new Error(
      `Azure model output invalid and repair failed (${repairRes.status}): ${errText}`
    );
  }

  const repairData = (await repairRes.json()) as any;
  const repairedContent: string | undefined = repairData?.choices?.[0]?.message?.content;
  if (!repairedContent) throw new Error("Azure repair call returned no content");

  const repairedParsed = JSON.parse(repairedContent);
  const repairedValidated = PlanSchema.parse(repairedParsed);
  return repairedValidated;
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
  const content: string | undefined = data?.choices?.[0]?.message?.content;
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
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Azure chat returned no content");
  return content.trim();
}

