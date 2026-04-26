export type NoveltyCheckResult = {
  noveltyStatus: "not found" | "similar work exists" | "exact match found";
  priorPapers: Array<{
    title: string;
    url: string;
    doi?: string;
    year?: number;
    citationCount?: number;
    score?: number;
  }>;
};

export async function fetchNoveltyCheck(hypothesis: string): Promise<NoveltyCheckResult> {
  const res = await fetch("/api/novelty-check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hypothesis }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Novelty check failed (${res.status}): ${text}`);
  }
  return (await res.json()) as NoveltyCheckResult;
}

