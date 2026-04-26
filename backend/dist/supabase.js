import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});
async function trySelectByColumn(experimentType, column) {
    return await supabase
        .from("ExpertMemory")
        .select("*")
        .eq(column, experimentType)
        .order("created_at", { ascending: false })
        .limit(10);
}
export async function loadExpertMemory(experimentType) {
    const attempts = await Promise.allSettled([
        trySelectByColumn(experimentType, "experimentType"),
        trySelectByColumn(experimentType, "experiment_type"),
        // fallback: some schemas may use "type"
        trySelectByColumn(experimentType, "type"),
    ]);
    for (const a of attempts) {
        if (a.status === "fulfilled" && !a.value.error)
            return (a.value.data ?? []);
    }
    return [];
}
async function tryInsert(payload) {
    return await supabase.from("ExpertMemory").insert(payload);
}
export async function saveExpertMemoryCorrection(args) {
    const { experimentType, hypothesis, editedText } = args;
    const candidates = [
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
    ];
    let lastError = undefined;
    for (const c of candidates) {
        const res = await tryInsert(c);
        if (!res.error)
            return { ok: true };
        lastError = res.error;
    }
    return { ok: false, error: lastError };
}
