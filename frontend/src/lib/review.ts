export async function submitReviewCorrection(args: {
  hypothesis: string;
  editedText: string;
  experimentType?: string;
  correction?: {
    domain?: string;
    source?: string;
    field?: string;
    before?: string;
    after?: string;
    summary?: string;
    tags?: string[];
  };
}) {
  const res = await fetch("/api/generate-plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hypothesis: args.hypothesis,
      experimentType: args.experimentType ?? "general",
      isReviewing: true,
      editedText: args.editedText,
      correction: args.correction,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Review submit failed (${res.status}): ${txt}`);
  }
}

export function summarizeChange(before: string, after: string): { before: string; after: string } {
  const b = before.trim();
  const a = after.trim();
  if (b === a) return { before: b, after: a };
  const prefixLen = commonPrefixLen(b, a);
  const suffixLen = commonSuffixLen(b.slice(prefixLen), a.slice(prefixLen));
  const beforeDelta = b.slice(prefixLen, b.length - suffixLen).trim();
  const afterDelta = a.slice(prefixLen, a.length - suffixLen).trim();
  return {
    before: beforeDelta || "(minor text change)",
    after: afterDelta || "(minor text change)",
  };
}

export async function summarizeChangeWithAI(before: string, after: string): Promise<{ before: string; after: string }> {
  const res = await fetch("/api/summarize-change", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ before, after }),
  });
  if (!res.ok) return summarizeChange(before, after);
  try {
    return (await res.json()) as { before: string; after: string };
  } catch {
    return summarizeChange(before, after);
  }
}

function commonPrefixLen(a: string, b: string) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function commonSuffixLen(a: string, b: string) {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

