export type BackendPlan = {
  summary: {
    noveltyStatus: "not found" | "similar work exists" | "exact match found";
    noveltyReason: string;
    priorPapers: Array<{
      title: string;
      url: string;
      doi?: string;
      year?: number;
    }>;
    totalBudget: number;
    selectedVendors: string[];
    timelineWeeks: number;
    executiveSummary: string;
  };
  protocol: Array<{
    step: number;
    phase?: string;
    instruction: string;
    duration: string;
    citations: string[];
  }>;
  materials: Array<{
    item: string;
    catalogNum: string;
    vendor: string;
    price: number;
    sourceUrl?: string;
    sourceQuality?: "exact" | "partial" | "weak";
  }>;
  budget: Array<{
    category: string;
    description: string;
    amount: number;
  }>;
  timeline: {
    weeks: Array<{
      week: number;
      tasks: string[];
    }>;
  };
  literature: Array<{
    title: string;
    doi: string;
    relevance: string;
  }>;
  memory: Array<Record<string, unknown>>;
  parameters: {
    selectedVendors: string[];
    sampleSize: number;
    sampleSizeMin?: number;
    sampleSizeMax?: number;
    automationLevel: "low" | "medium" | "high";
  };
  impact: {
    estimatedCost: number;
    timelineWeeks: number;
    sampleSize: number;
    reproducibility: number;
  };
};

export async function fetchGeneratePlan(input: {
  hypothesis: string;
  constraints: string;
  experimentType?: string;
}): Promise<BackendPlan> {
  const payload = {
    // Backend uses `hypothesis` to run web searches; keep it short to avoid provider limits.
    hypothesis: input.hypothesis.trim(),
    constraints: input.constraints?.trim() || undefined,
    experimentType: input.experimentType ?? "general",
    isReviewing: false,
  };

  const res = await fetch("/api/generate-plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let details: unknown = undefined;
    try {
      details = await res.json();
    } catch {
      // ignore
    }
    throw new Error(`Backend error (${res.status}): ${JSON.stringify(details)}`);
  }

  return (await res.json()) as BackendPlan;
}

export async function fetchReportChat(input: {
  message: string;
  hypothesis: string;
  plan?: BackendPlan;
  noveltyStatus?: string;
}): Promise<string> {
  const res = await fetch("/api/report-chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Report chat failed (${res.status})`);
  }
  const data = (await res.json()) as { reply?: string };
  return data.reply?.trim() || "No response generated.";
}

