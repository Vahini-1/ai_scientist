import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type ExpertMemoryRow = Record<string, unknown>;

const TABLE_CANDIDATES = ["ExpertMemory", "expert_memory"];

async function trySelectByColumn(experimentType: string, column: string, table: string) {
  return await supabase
    .from(table)
    .select("*")
    .eq(column, experimentType)
    .order("created_at", { ascending: false })
    .limit(10);
}

export async function loadExpertMemory(experimentType: string): Promise<ExpertMemoryRow[]> {
  const attempts = await Promise.allSettled(
    TABLE_CANDIDATES.flatMap(table => ([
      trySelectByColumn(experimentType, "experimentType", table),
      trySelectByColumn(experimentType, "experiment_type", table),
      // fallback: some schemas may use "type"
      trySelectByColumn(experimentType, "type", table),
    ]))
  );

  for (const a of attempts) {
    if (a.status === "fulfilled" && !a.value.error) return (a.value.data ?? []) as ExpertMemoryRow[];
  }
  return [];
}

async function tryInsert(payload: Record<string, unknown>, table: string) {
  return await supabase.from(table).insert(payload);
}

async function tryInsertFlexible(payload: Record<string, unknown>, table: string) {
  let current = { ...payload };
  for (let i = 0; i < 8; i++) {
    const res = await tryInsert(current, table);
    if (!res.error) return res;
    const err = res.error as any;
    const msg = String(err?.message ?? "");
    const colMatch = msg.match(/Could not find the '([^']+)' column/i);
    if (err?.code === "PGRST204" && colMatch?.[1]) {
      delete (current as any)[colMatch[1]];
      continue;
    }
    return res;
  }
  return await tryInsert(current, table);
}

export async function saveExpertMemoryCorrection(args: {
  experimentType: string;
  hypothesis: string;
  editedText: string;
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
  const { experimentType, hypothesis, editedText, correction } = args;
  const domain = correction?.domain ?? "general";
  const summary = correction?.summary ?? editedText;

  const candidates: Array<Record<string, unknown>> = [
    { experimentType, hypothesis, correction: editedText },
    { experiment_type: experimentType, hypothesis, correction: editedText },
    { experiment_type: experimentType, hypothesis, correction_text: editedText },
    { type: experimentType, hypothesis, correction: editedText },
    { type: experimentType, hypothesis, text: editedText },
    {
      experimentType,
      hypothesis,
      correction: editedText,
      created_at: new Date().toISOString(),
    },
    // Structured payload variants for feedback-store schemas.
    {
      experiment_type: experimentType,
      domain,
      source: correction?.source,
      field: correction?.field,
      before_text: correction?.before,
      after_text: correction?.after ?? editedText,
      correction_summary: summary,
      tags: correction?.tags ?? [],
      hypothesis,
      created_at: new Date().toISOString(),
    },
    {
      experimentType,
      domain,
      source: correction?.source,
      field: correction?.field,
      before: correction?.before,
      after: correction?.after ?? editedText,
      tags: correction?.tags ?? [],
      hypothesis,
      created_at: new Date().toISOString(),
    },
    // Minimal fallback insert for unknown schemas.
    { correction: editedText },
    { correction_text: editedText },
  ];

  let lastError: unknown = undefined;
  for (const table of TABLE_CANDIDATES) {
    for (const c of candidates) {
      const res = await tryInsertFlexible(c, table);
      if (!res.error) return { ok: true as const };
      lastError = res.error;
    }
  }
  return { ok: false as const, error: lastError };
}

