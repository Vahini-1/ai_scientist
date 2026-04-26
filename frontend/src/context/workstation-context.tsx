import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { protocolSteps as seedSteps, validation as seedValidation, ProtocolStep } from "@/lib/mock-report";
import type { BackendPlan } from "@/lib/backend-plan";
import { fetchGeneratePlan } from "@/lib/backend-plan";
import type { NoveltyCheckResult } from "@/lib/novelty";

export type MemoryEntry = {
  id: string;
  timestamp: string;
  source: string;       // e.g. "Protocol step P3"
  field: string;        // e.g. "description"
  before: string;
  after: string;
  author: string;
};

export type LibraryEntry = {
  id: string;
  reportId?: string;
  title: string;
  subtitle: string;
  date: string;
  tags: string[];
  status: "active" | "completed" | "archived";
  novelty: number;
};

export type InsightCategory =
  | "Protocol Quality"
  | "Budget Planning"
  | "Sample Handling"
  | "Analytical Methods"
  | "Study Design";

export type Insight = {
  id: string;
  text: string;
  category: InsightCategory;
  date: string;
  source: "User Input" | "AI Detected";
};

export type ReportMeta = {
  id: string;
  title: string;
  hypothesis: string;
  constraints: string;
  createdAt: string;
  status: "draft" | "active" | "archived";
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

type Ctx = {
  view: "home" | "report" | "library" | "memory";
  setView: (v: "home" | "report" | "library" | "memory") => void;
  reports: ReportMeta[];
  activeReportId: string | null;
  openReport: (id: string) => void;
  closeReport: (id: string) => void;
  generateReport: (hypothesis: string, constraints: string, novelty?: NoveltyCheckResult | null) => Promise<string>;
  generating: boolean;
  lastPlanError: string | null;
  planByReportId: Record<string, BackendPlan | undefined>;
  noveltyByReportId: Record<string, NoveltyCheckResult | undefined>;

  steps: ProtocolStep[];
  updateStep: (id: string, patch: Partial<ProtocolStep>) => void;
  validationText: string;
  setValidationText: (s: string) => void;
  reviewMode: boolean;
  setReviewMode: (v: boolean) => void;

  memory: MemoryEntry[];
  addMemory: (e: Omit<MemoryEntry, "id" | "timestamp">) => void;
  library: LibraryEntry[];
  insights: Insight[];
  addInsight: (i: Omit<Insight, "id" | "date">) => void;
  chatByReportId: Record<string, ChatMessage[] | undefined>;
  sendChat: (text: string) => Promise<void>;
};

const WorkstationContext = createContext<Ctx | null>(null);

export function WorkstationProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<"home" | "report" | "library" | "memory">("home");
  const [generating, setGenerating] = useState(false);
  const [lastPlanError, setLastPlanError] = useState<string | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [planByReportId, setPlanByReportId] = useState<Record<string, BackendPlan | undefined>>({});
  const [noveltyByReportId, setNoveltyByReportId] = useState<Record<string, NoveltyCheckResult | undefined>>({});
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [chatByReportId, setChatByReportId] = useState<Record<string, ChatMessage[] | undefined>>({});

  const [steps, setSteps] = useState<ProtocolStep[]>(seedSteps);
  const [validationText, setValidationText] = useState(seedValidation.approach);
  const [reviewMode, setReviewMode] = useState(false);
  const [memory, setMemory] = useState<MemoryEntry[]>([]);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);

  const updateStep = useCallback((id: string, patch: Partial<ProtocolStep>) => {
    setSteps(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const addMemory = useCallback((e: Omit<MemoryEntry, "id" | "timestamp">) => {
    setMemory(prev => [
      {
        ...e,
        id: `M-${String(prev.length + 1).padStart(3, "0")}`,
        timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
      },
      ...prev,
    ]);
  }, []);

  const addInsight = useCallback((i: Omit<Insight, "id" | "date">) => {
    setInsights(prev => [
      { ...i, id: `I-${String(prev.length + 1).padStart(3, "0")}`, date: new Date().toISOString().slice(0, 10) },
      ...prev,
    ]);
  }, []);

  const openReport = useCallback((id: string) => {
    setActiveReportId(id);
    setView("report");
  }, []);

  const closeReport = useCallback((id: string) => {
    setReports(prev => prev.filter(r => r.id !== id));
    setPlanByReportId(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setNoveltyByReportId(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setChatByReportId(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveReportId(prev => (prev === id ? null : prev));
    setView("home");
  }, []);

  const generateReport = useCallback(async (hypothesis: string, constraints: string, novelty?: NoveltyCheckResult | null) => {
    setGenerating(true);
    setLastPlanError(null);
    const id = `RPT-${new Date().toISOString().slice(0, 10).split("-").join("")}-${String(reports.length + 1).padStart(3, "0")}`;
    const newReport: ReportMeta = {
      id,
      title: hypothesis.slice(0, 60) + (hypothesis.length > 60 ? "…" : ""),
      hypothesis,
      constraints,
      createdAt: new Date().toISOString().slice(0, 10),
      status: "active",
    };
    setReports(prev => [newReport, ...prev]);
    setActiveReportId(id);
    setView("report");
    if (novelty) setNoveltyByReportId(prev => ({ ...prev, [id]: novelty }));
    try {
      const plan = await fetchGeneratePlan({ hypothesis, constraints, experimentType: "general" });
      if (novelty) {
        plan.summary.noveltyStatus = novelty.noveltyStatus;
        if (novelty.priorPapers?.length) {
          plan.summary.priorPapers = novelty.priorPapers.map(p => ({
            title: p.title,
            url: p.url,
            doi: p.doi,
            year: p.year,
          }));
        }
      }
      setPlanByReportId(prev => ({ ...prev, [id]: plan }));
      setLibrary(prev => [
        {
          id: `LIB-${String(prev.length + 1).padStart(3, "0")}`,
          reportId: id,
          title: newReport.title,
          subtitle: hypothesis.slice(0, 120),
          date: newReport.createdAt,
          tags: [experimentTypeFromHypothesis(hypothesis), plan.summary.noveltyStatus],
          status: "completed",
          novelty: plan.summary.noveltyStatus === "exact match found" ? 20 : plan.summary.noveltyStatus === "similar work exists" ? 55 : 85,
        },
        ...prev,
      ]);
      if (plan.protocol?.length) {
        setSteps(plan.protocol.map((p, idx) => ({
          id: `P${p.step || idx + 1}`,
          phase: `Phase ${idx + 1}`,
          title: p.instruction.split(".")[0] || `Step ${idx + 1}`,
          duration: p.duration || `Week ${idx + 1}`,
          description: p.instruction,
          refs: [],
        })));
      }
    } catch (e) {
      setLastPlanError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
    return id;
  }, [reports.length]);

  const sendChat = useCallback(async (text: string) => {
    if (!activeReportId || !text.trim()) return;
    const now = new Date().toISOString();
    const userMsg: ChatMessage = { id: `U-${now}`, role: "user", text: text.trim(), createdAt: now };
    setChatByReportId(prev => {
      const thread = prev[activeReportId] ?? [];
      return { ...prev, [activeReportId]: [...thread, userMsg] };
    });
    const plan = planByReportId[activeReportId];
    const noveltyStatus = noveltyByReportId[activeReportId]?.noveltyStatus;
    const m = text.toLowerCase();
    const total = Array.isArray(plan?.budget) ? plan.budget.reduce((s, b) => s + (b.amount || 0), 0) : undefined;
    const reply =
      m.includes("novelty") ? `Novelty signal is "${noveltyStatus ?? plan?.summary?.noveltyStatus ?? "not found"}".` :
        m.includes("budget") ? (total ? `Current total budget from line items is ${total}.` : "Budget data is not available yet.") :
          m.includes("timeline") || m.includes("week") ? `Timeline has ${plan?.timeline?.weeks?.length ?? 0} weeks.` :
            "I can help refine protocol, budget, materials, timeline, or novelty. Ask for a specific section change.";
    const aiMsg: ChatMessage = { id: `A-${new Date().toISOString()}`, role: "assistant", text: reply, createdAt: new Date().toISOString() };
    setChatByReportId(prev => {
      const thread = prev[activeReportId] ?? [];
      return { ...prev, [activeReportId]: [...thread, aiMsg] };
    });
  }, [activeReportId, noveltyByReportId, planByReportId]);

  const value = useMemo<Ctx>(() => ({
    view, setView, reports, activeReportId, openReport, closeReport, generateReport, generating,
    lastPlanError, planByReportId, noveltyByReportId,
    steps, updateStep, validationText, setValidationText, reviewMode, setReviewMode, memory, addMemory, library, insights, addInsight,
    chatByReportId, sendChat,
  }), [view, reports, activeReportId, openReport, closeReport, generateReport, generating, lastPlanError, planByReportId, noveltyByReportId, steps, updateStep, validationText, reviewMode, memory, addMemory, library, insights, addInsight, chatByReportId, sendChat]);

  return <WorkstationContext.Provider value={value}>{children}</WorkstationContext.Provider>;
}

export function useWorkstation() {
  const ctx = useContext(WorkstationContext);
  if (!ctx) throw new Error("useWorkstation must be used inside WorkstationProvider");
  return ctx;
}

function experimentTypeFromHypothesis(h: string) {
  const t = h.toLowerCase();
  if (t.includes("mouse") || t.includes("mice")) return "in-vivo";
  if (t.includes("cell") || t.includes("hela")) return "cell-biology";
  if (t.includes("biosensor") || t.includes("electrochemical")) return "diagnostics";
  return "general";
}