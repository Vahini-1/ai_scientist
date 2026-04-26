import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { protocolSteps as seedSteps, validation as seedValidation, ProtocolStep } from "@/lib/mock-report";
import type { BackendPlan } from "@/lib/backend-plan";
import { fetchGeneratePlan, fetchReportChat } from "@/lib/backend-plan";
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

export type ReportParameters = {
  selectedVendor: string;
  sampleSize: number;
  automationLevel: "low" | "medium" | "high";
};

export type ReportTab =
  | "summary"
  | "protocol"
  | "materials"
  | "budget"
  | "parameters"
  | "timeline"
  | "literature"
  | "memory";

type ReviewModeByTab = Record<ReportTab, boolean>;

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
  reviewModeByTab: ReviewModeByTab;
  setTabReviewMode: (tab: ReportTab, value: boolean) => void;

  memory: MemoryEntry[];
  addMemory: (e: Omit<MemoryEntry, "id" | "timestamp">) => void;
  library: LibraryEntry[];
  insights: Insight[];
  addInsight: (i: Omit<Insight, "id" | "date">) => void;
  chatByReportId: Record<string, ChatMessage[] | undefined>;
  sendChat: (text: string) => Promise<void>;
  parametersByReportId: Record<string, ReportParameters | undefined>;
  updateReportParameters: (reportId: string, patch: Partial<ReportParameters>) => void;
};

const WorkstationContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "ai-scientist-workstation-v2";
const DEFAULT_TAB_REVIEW: ReviewModeByTab = {
  summary: false,
  protocol: false,
  materials: false,
  budget: false,
  parameters: false,
  timeline: false,
  literature: false,
  memory: false,
};

export function WorkstationProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<"home" | "report" | "library" | "memory">("home");
  const [generating, setGenerating] = useState(false);
  const [lastPlanError, setLastPlanError] = useState<string | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [planByReportId, setPlanByReportId] = useState<Record<string, BackendPlan | undefined>>({});
  const [noveltyByReportId, setNoveltyByReportId] = useState<Record<string, NoveltyCheckResult | undefined>>({});
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [chatByReportId, setChatByReportId] = useState<Record<string, ChatMessage[] | undefined>>({});
  const [parametersByReportId, setParametersByReportId] = useState<Record<string, ReportParameters | undefined>>({});

  const [steps, setSteps] = useState<ProtocolStep[]>(seedSteps);
  const [validationText, setValidationText] = useState(seedValidation.approach);
  const [reviewMode, setReviewMode] = useState(false);
  const [memory, setMemory] = useState<MemoryEntry[]>([]);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [reviewModeByTab, setReviewModeByTab] = useState<ReviewModeByTab>(DEFAULT_TAB_REVIEW);

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
    setReports(prev => prev.map(r => (r.id === id ? { ...r, status: "active" } : r)));
    setLibrary(prev => prev.map(l => (l.reportId === id ? { ...l, status: "active" } : l)));
    setActiveReportId(id);
    setView("report");
  }, []);

  const closeReport = useCallback((id: string) => {
    setReports(prev => prev.map(r => (r.id === id ? { ...r, status: "archived" } : r)));
    setLibrary(prev => prev.map(l => (l.reportId === id ? { ...l, status: "archived" } : l)));
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
          phase: p.phase || `Phase ${idx + 1}`,
          title: p.instruction.split(".")[0] || `Step ${idx + 1}`,
          duration: p.duration || `Week ${idx + 1}`,
          description: p.instruction,
          refs: [],
        })));
      }
      setParametersByReportId(prev => ({
        ...prev,
        [id]: {
          selectedVendor: plan.parameters?.selectedVendors?.[0] ?? plan.summary?.selectedVendors?.[0] ?? "Best available",
          sampleSize: plan.parameters?.sampleSize ?? 48,
          automationLevel: plan.parameters?.automationLevel ?? "medium",
        },
      }));
    } catch (e) {
      setLastPlanError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
    return id;
  }, [reports.length]);

  const updateReportParameters = useCallback((reportId: string, patch: Partial<ReportParameters>) => {
    setParametersByReportId(prev => {
      const current = prev[reportId] ?? {
        selectedVendor: "Best available",
        sampleSize: 48,
        automationLevel: "medium" as const,
      };
      return {
        ...prev,
        [reportId]: { ...current, ...patch },
      };
    });
  }, []);

  const setTabReviewMode = useCallback((tab: ReportTab, value: boolean) => {
    setReviewModeByTab(prev => ({ ...prev, [tab]: value }));
    setReviewMode(value);
  }, []);

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
    const active = reports.find(r => r.id === activeReportId);
    let reply = "I can help with this report section.";
    try {
      reply = await fetchReportChat({
        message: text.trim(),
        hypothesis: active?.hypothesis ?? "",
        plan,
        noveltyStatus,
      });
    } catch {
      const total = Array.isArray(plan?.budget) ? plan.budget.reduce((s, b) => s + (b.amount || 0), 0) : undefined;
      if (text.toLowerCase().includes("budget") && total) reply = `Current estimated budget is $${total.toLocaleString()}.`;
      else if (text.toLowerCase().includes("timeline")) reply = `Timeline currently includes ${plan?.timeline?.weeks?.length ?? 0} weeks.`;
      else reply = "I can still help. Ask for a specific edit request (e.g. reduce vendor cost, rename phases, or compress timeline).";
    }
    const aiMsg: ChatMessage = { id: `A-${new Date().toISOString()}`, role: "assistant", text: reply, createdAt: new Date().toISOString() };
    setChatByReportId(prev => {
      const thread = prev[activeReportId] ?? [];
      return { ...prev, [activeReportId]: [...thread, aiMsg] };
    });
  }, [activeReportId, noveltyByReportId, planByReportId, reports]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        reports: ReportMeta[];
        planByReportId: Record<string, BackendPlan | undefined>;
        noveltyByReportId: Record<string, NoveltyCheckResult | undefined>;
        chatByReportId: Record<string, ChatMessage[] | undefined>;
        parametersByReportId: Record<string, ReportParameters | undefined>;
        library: LibraryEntry[];
        reviewModeByTab: ReviewModeByTab;
      }>;
      if (parsed.reports) setReports(parsed.reports);
      if (parsed.planByReportId) setPlanByReportId(parsed.planByReportId);
      if (parsed.noveltyByReportId) setNoveltyByReportId(parsed.noveltyByReportId);
      if (parsed.chatByReportId) setChatByReportId(parsed.chatByReportId);
      if (parsed.parametersByReportId) setParametersByReportId(parsed.parametersByReportId);
      if (parsed.library) setLibrary(parsed.library);
      if (parsed.reviewModeByTab) setReviewModeByTab({ ...DEFAULT_TAB_REVIEW, ...parsed.reviewModeByTab });
    } catch {
      // no-op on corrupted storage
    }
  }, []);

  useEffect(() => {
    const payload = {
      reports,
      planByReportId,
      noveltyByReportId,
      chatByReportId,
      parametersByReportId,
      library,
      reviewModeByTab,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [reports, planByReportId, noveltyByReportId, chatByReportId, parametersByReportId, library, reviewModeByTab]);

  const value = useMemo<Ctx>(() => ({
    view, setView, reports, activeReportId, openReport, closeReport, generateReport, generating,
    lastPlanError, planByReportId, noveltyByReportId,
    steps, updateStep, validationText, setValidationText, reviewMode, setReviewMode, reviewModeByTab, setTabReviewMode, memory, addMemory, library, insights, addInsight,
    chatByReportId, sendChat, parametersByReportId, updateReportParameters,
  }), [view, reports, activeReportId, openReport, closeReport, generateReport, generating, lastPlanError, planByReportId, noveltyByReportId, steps, updateStep, validationText, reviewMode, reviewModeByTab, setTabReviewMode, memory, addMemory, library, insights, addInsight, chatByReportId, sendChat, parametersByReportId, updateReportParameters]);

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