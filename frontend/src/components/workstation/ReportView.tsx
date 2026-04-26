import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ExternalLink, TrendingUp, DollarSign, CheckCircle2, AlertCircle, Brain, FlaskConical, GitBranch, Calendar, BookOpen, FileText } from "lucide-react";
import { useWorkstation } from "@/context/workstation-context";
import { budgetLines, citations, ganttDefinition, materials, protocolSteps, validation } from "@/lib/mock-report";
import { CitationRef } from "./CitationRef";
import { EditableText } from "./EditableText";
import { MermaidChart } from "./MermaidChart";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import type { BackendPlan } from "@/lib/backend-plan";

export function ReportView() {
  const {
    reports,
    activeReportId,
    steps,
    updateStep,
    validationText,
    setValidationText,
    setReviewMode,
    reviewModeByTab,
    setTabReviewMode,
    memory,
    planByReportId,
    noveltyByReportId,
    lastPlanError,
    parametersByReportId,
    updateReportParameters,
  } = useWorkstation();
  const report = reports.find(r => r.id === activeReportId) ?? reports[0];
  const plan: BackendPlan | undefined = (report?.id ? planByReportId[report.id] : undefined);
  const novelty = report?.id ? noveltyByReportId[report.id] : undefined;
  const budgetCap = parseBudgetCap(report?.constraints ?? "");
  const timelineWeeks = plan?.timeline?.weeks?.length || 10;

  const budgetLinesLive = plan?.budget?.length
    ? plan.budget.map(b => ({ category: b.category, description: b.description, amount: b.amount }))
    : budgetLines;

  const materialsLive = plan?.materials?.length
    ? plan.materials.map(m => ({ item: m.item, qty: "1", vendor: m.vendor, catalog: m.catalogNum, refs: [], cost: m.price, sourceUrl: m.sourceUrl, sourceQuality: m.sourceQuality }))
    : materials;

  const citationsLive = plan?.literature?.length
    ? plan.literature.map((c, idx) => ({
      id: idx + 1,
      title: c.title,
      authors: c.relevance,
      journal: "—",
      year: plan?.summary?.priorPapers?.find(p => p.doi && c.doi && p.doi === c.doi)?.year ?? undefined,
      doi: c.doi,
    }))
    : citations;

  const protocolLive = steps.length
    ? steps
    : plan?.protocol?.length
      ? plan.protocol.map((p, idx) => ({
        id: `P${p.step || idx + 1}`,
        phase: p.phase || `Phase ${idx + 1}`,
        title: p.instruction.split(".")[0] || `Step ${idx + 1}`,
        duration: p.duration || `Week ${idx + 1}`,
        description: p.instruction,
        refs: [],
      }))
      : protocolSteps;

  const memoryLive = memory.length
    ? memory
    : (plan?.memory ?? []).map((m: Record<string, unknown>, i: number) => ({
      id: `M-${String(i + 1).padStart(3, "0")}`,
      timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
      source: String(m?.source ?? m?.id ?? "Plan memory"),
      field: String(m?.field ?? "correction"),
      before: String(m?.before ?? "—"),
      after: String(m?.after ?? m?.correction ?? JSON.stringify(m)),
      author: String(m?.author ?? "System"),
    }));

  const totalBudget = budgetLinesLive.length ? budgetLinesLive.reduce((s, l) => s + l.amount, 0) : (plan?.summary?.totalBudget ?? 0);
  const budgetByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of budgetLinesLive) {
      const key = String(line.category ?? "Other") || "Other";
      map.set(key, (map.get(key) ?? 0) + (Number.isFinite(line.amount) ? Number(line.amount) : 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [budgetLinesLive]);
  const [activeTab, setActiveTab] = useState("summary");
  useEffect(() => {
    const key = activeTab as keyof typeof reviewModeByTab;
    if (key in reviewModeByTab) setReviewMode(Boolean(reviewModeByTab[key]));
  }, [activeTab, reviewModeByTab, setReviewMode]);
  const reportParams = report?.id ? parametersByReportId[report.id] : undefined;
  const vendorOptions = useMemo(() => {
    const fromMaterials = Array.from(new Set(materialsLive.map(m => m.vendor).filter(Boolean)));
    const fromSummary = plan?.summary?.selectedVendors ?? [];
    return Array.from(new Set([...fromMaterials, ...fromSummary]));
  }, [materialsLive, plan?.summary?.selectedVendors]);
  const selectedVendor = reportParams?.selectedVendor ?? vendorOptions[0] ?? "Best available";
  const selectedSampleSize = reportParams?.sampleSize ?? plan?.parameters?.sampleSize ?? 48;
  const selectedAutomation = reportParams?.automationLevel ?? plan?.parameters?.automationLevel ?? "medium";
  const baseSampleSize = plan?.parameters?.sampleSize ?? 48;
  const baseTimeline = plan?.summary?.timelineWeeks ?? timelineWeeks;
  const baseCost = plan?.summary?.totalBudget ?? totalBudget;
  const vendorItems = materialsLive.filter(m => m.vendor === selectedVendor);
  const selectedVendorAvg = vendorItems.length ? vendorItems.reduce((s, m) => s + m.cost, 0) / vendorItems.length : 0;
  const vendorProjectedBase = selectedVendorAvg > 0 ? selectedVendorAvg * materialsLive.length : baseCost;
  const vendorMultiplier = selectedVendorAvg > 0 ? vendorProjectedBase / Math.max(1, baseCost) : (plan?.summary?.selectedVendors?.includes(selectedVendor) ? 1 : 1.08);
  const automationCostMultiplier = selectedAutomation === "high" ? 1.22 : selectedAutomation === "low" ? 0.92 : 1;
  const automationTimeMultiplier = selectedAutomation === "high" ? 0.82 : selectedAutomation === "low" ? 1.18 : 1;
  const sizeMultiplier = Math.max(0.5, selectedSampleSize / Math.max(1, baseSampleSize));
  const projectedCost = Math.round(baseCost * Math.max(0.6, vendorMultiplier) * automationCostMultiplier * sizeMultiplier);
  const sampleSizeMin = plan?.parameters?.sampleSizeMin ?? Math.max(8, Math.round((plan?.parameters?.sampleSize ?? 48) * 0.5));
  const sampleSizeMax = plan?.parameters?.sampleSizeMax ?? Math.max(sampleSizeMin + 8, Math.round((plan?.parameters?.sampleSize ?? 48) * 2));
  const projectedTimelineWeeks = Number((baseTimeline * automationTimeMultiplier * (0.85 + sizeMultiplier * 0.15)).toFixed(1));
  const projectedReproducibility = Math.max(
    50,
    Math.min(100, Math.round((selectedAutomation === "high" ? 90 : selectedAutomation === "low" ? 65 : 78) - Math.max(0, sizeMultiplier - 1) * 4))
  );
  const executiveSummary = plan?.summary?.executiveSummary || [
    `Novelty: ${novelty?.noveltyStatus ?? plan?.summary?.noveltyStatus ?? "not found"}.`,
    `Budget: $${totalBudget.toLocaleString()}.`,
    `Vendors: ${(plan?.summary?.selectedVendors ?? vendorOptions).slice(0, 3).join(", ") || "to be finalized"}.`,
    `Timeline: ${baseTimeline} weeks.`,
  ].join(" ");
  const materialsSubtotal = useMemo(() => materialsLive.reduce((s, m) => s + (m.cost ?? 0), 0), [materialsLive]);
  const nonMaterialsSubtotal = useMemo(() => Math.max(0, totalBudget - materialsSubtotal), [totalBudget, materialsSubtotal]);

  if (!report) {
    return (
      <div className="p-6">
        <Card className="p-6 text-sm text-muted-foreground">
          Report data is unavailable. Open a report from the library or generate a new one.
        </Card>
      </div>
    );
  }

  return (
    <div id="report-export-root" className="flex h-full flex-col">
      {/* Report meta strip */}
      <div className="border-b border-border bg-muted/30 px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="font-mono-data text-[10px]">{report?.id ?? "N/A"}</Badge>
            <Badge className="bg-success/15 text-success hover:bg-success/20 border border-success/30">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Active
            </Badge>
          </div>
          <div className="text-muted-foreground"><span className="font-medium text-foreground">Hypothesis:</span> {report?.hypothesis ?? "No report selected"}</div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border bg-background px-4">
          <TabsList className="h-11 flex-1 justify-start gap-1 bg-transparent p-0">
            <TabTriggerItem value="summary" icon={<TrendingUp className="h-3.5 w-3.5" />} label="Summary" />
            <TabTriggerItem value="protocol" icon={<FlaskConical className="h-3.5 w-3.5" />} label="Protocol & Validation" />
            <TabTriggerItem value="materials" icon={<GitBranch className="h-3.5 w-3.5" />} label="Materials & Supply Chain" />
            <TabTriggerItem value="budget" icon={<DollarSign className="h-3.5 w-3.5" />} label="Budget & Finance" />
            <TabTriggerItem value="parameters" icon={<FileText className="h-3.5 w-3.5" />} label="Parameters" />
            <TabTriggerItem value="timeline" icon={<Calendar className="h-3.5 w-3.5" />} label="Detailed Timeline" />
            <TabTriggerItem value="literature" icon={<BookOpen className="h-3.5 w-3.5" />} label="Literature" />
            <TabTriggerItem value="memory" icon={<Brain className="h-3.5 w-3.5" />} label="Expert Memory" />
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          {!plan && !lastPlanError && (
            <div className="p-6">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">Processing</div>
                    <div className="mt-1 text-base font-semibold">Generating your operational plan…</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Checking prior work, grounding with literature, building protocol, materials, budget, and timeline.
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Novelty: <span className="font-medium text-foreground">{novelty?.noveltyStatus ?? "checking..."}</span>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <BufferItem title="1. Novelty check" subtitle={novelty?.noveltyStatus ?? "Semantic Scholar scan + priors"} />
                  <BufferItem title="2. Materials & pricing" subtitle="Supplier signals + catalog numbers" />
                  <BufferItem title="3. Plan synthesis" subtitle="Protocol → budget → timeline" />
                </div>
              </Card>
            </div>
          )}

          {lastPlanError && (
            <div className="px-6 pt-6">
              <Card className="border-warning/40 bg-warning/10 p-4 text-sm">
                <div className="mb-1 font-semibold">Backend not connected</div>
                <div className="text-muted-foreground break-words">{lastPlanError}</div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Using mock report data for now. Ensure the backend is running and reachable at <span className="font-mono-data">/api/*</span>.
                </div>
              </Card>
            </div>
          )}

          {/* SUMMARY */}
          <TabsContent value="summary" className={cn("m-0 p-6", !plan && !lastPlanError && "hidden")}>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="p-4 lg:col-span-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">Executive summary</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">Novelty · Budget · Vendors · Timeline</Badge>
                    <ReadReviewToggle checked={reviewModeByTab.summary} onCheckedChange={v => setTabReviewMode("summary", v)} />
                  </div>
                </div>
                <p className="text-sm leading-relaxed">{executiveSummary}</p>
              </Card>
              {/* Novelty */}
              <Card className="p-4 lg:col-span-1">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">Novelty signal</div>
                  <Badge className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/20">
                    {novelty?.noveltyStatus ?? (plan ? plan.summary.noveltyStatus : "similar work exists")}
                  </Badge>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {plan ? plan.summary.noveltyReason : (
                    <>
                      Combination of crossover design with deep SCFA profiling has limited prior art.
                      Closest precedent <CitationRef id={5} /> uses parallel arms only.
                    </>
                  )}
                </p>
                {plan?.summary?.priorPapers?.length ? (
                  <div className="mt-3 space-y-1.5">
                    <div className="font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">Prior papers</div>
                    <ul className="space-y-1 text-[11px]">
                      {plan.summary.priorPapers.slice(0, 5).map((p, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                          <a className="text-primary hover:underline" href={p.url} target="_blank" rel="noreferrer">
                            {p.title || p.doi || p.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Pill>n=3 close priors</Pill>
                  <Pill>0 direct replicas</Pill>
                </div>
              </Card>

              {/* Total budget */}
              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">Total budget</div>
                  <Badge variant="outline" className="text-[10px]">{budgetCap ? `vs cap $${budgetCap.toLocaleString()}` : "no budget cap provided"}</Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="font-mono-data text-3xl font-semibold">${totalBudget.toLocaleString()}</div>
                  {budgetCap ? (
                    <div className={cn("text-xs", totalBudget <= budgetCap ? "text-success" : "text-warning")}>
                      {totalBudget <= budgetCap
                        ? `${Math.round((1 - totalBudget / budgetCap) * 100)}% under cap`
                        : `${Math.round((totalBudget / budgetCap - 1) * 100)}% over cap`}
                    </div>
                  ) : null}
                </div>
                {budgetCap ? (
                  <Progress value={(totalBudget / budgetCap) * 100} className="mt-2 h-1.5" />
                ) : null}

                <div className="mt-4 grid gap-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Materials subtotal</span>
                    <span className="font-mono-data font-medium">${materialsSubtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Non-materials subtotal</span>
                    <span className="font-mono-data font-medium">${nonMaterialsSubtotal.toLocaleString()}</span>
                  </div>
                  {budgetCap ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Cap</span>
                      <span className="font-mono-data font-medium">${budgetCap.toLocaleString()}</span>
                    </div>
                  ) : null}
                  {budgetCap ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{totalBudget <= budgetCap ? "Headroom" : "Over cap"}</span>
                      <span className={cn("font-mono-data font-medium", totalBudget <= budgetCap ? "text-success" : "text-warning")}>
                        ${Math.abs(budgetCap - totalBudget).toLocaleString()}
                      </span>
                    </div>
                  ) : null}
                </div>
              </Card>

              {/* Materials at a glance */}
              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">Materials at a glance</div>
                  <Badge variant="outline" className="text-[10px]">{materialsLive.length} items</Badge>
                </div>
                <ul className="space-y-1.5">
                  {materialsLive.slice(0, 5).map(m => (
                    <li key={m.catalog} className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate">{m.item}</span>
                      <span className="font-mono-data text-[10px] text-muted-foreground">{m.vendor} · {m.catalog}</span>
                    </li>
                  ))}
                  <li className="pt-1 text-[10px] text-muted-foreground">
                    <button className="text-primary hover:underline" onClick={() => setActiveTab("materials")}>
                      + {Math.max(0, materialsLive.length - 5)} more items in supply chain tab
                    </button>
                  </li>
                </ul>
              </Card>

              {/* Timeline overview */}
              <Card className="p-4 lg:col-span-2 min-h-[210px]">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">Timeline overview · {timelineWeeks} weeks</div>
                  <div className="font-mono-data text-[10px] text-muted-foreground">W1 → W{timelineWeeks}</div>
                </div>
                <TimelineBar weeks={plan?.timeline?.weeks} />
                {plan?.timeline?.weeks?.length ? (
                  <div className="mt-3 grid grid-cols-3 gap-1.5 text-[10px] text-muted-foreground">
                    {plan.timeline.weeks.slice(0, 6).map(w => <span key={w.week}>Week {w.week}</span>)}
                  </div>
                ) : null}
              </Card>

            </div>
          </TabsContent>

          {/* PROTOCOL */}
          <TabsContent value="protocol" className={cn("m-0 p-6", !plan && !lastPlanError && "hidden")}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Operational protocol</h2>
                <p className="text-xs text-muted-foreground">Click the pencil on any step to edit. You can apply locally or submit to Expert Memory.</p>
              </div>
              <ReadReviewToggle checked={reviewModeByTab.protocol} onCheckedChange={v => setTabReviewMode("protocol", v)} />
            </div>

              <Card className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="w-16 px-3 py-2">Step</th>
                    <th className="w-28 px-3 py-2">Phase</th>
                    <th className="px-3 py-2">Detail</th>
                    <th className="w-10 px-3 py-2 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {protocolLive.map(step => (
                    <ProtocolRow key={step.id} step={step} onSave={d => updateStep(step.id, { description: d })} />
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold">Validation approach</h3>
                <Badge variant="outline" className="text-[10px]">how we prove it worked</Badge>
              </div>
              <Card className="p-4">
                <EditableText
                  value={validationText}
                  onSave={setValidationText}
                  source="Validation approach"
                  field="approach"
                />
                <Separator className="my-4" />
                <div className="mb-2 font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">Success criteria</div>
                <ul className="space-y-1.5">
                  {validation.successCriteria.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </TabsContent>

          {/* MATERIALS */}
          <TabsContent value="materials" className={cn("m-0 p-6", !plan && !lastPlanError && "hidden")}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Materials & supply chain</h2>
                <p className="text-xs text-muted-foreground">Live supplier table generated for this plan.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono-data text-[10px]">
                  <AlertCircle className="mr-1 h-3 w-3 text-warning" /> {materialsLive.length} items
                </Badge>
                <ReadReviewToggle checked={reviewModeByTab.materials} onCheckedChange={v => setTabReviewMode("materials", v)} />
              </div>
            </div>

            <Card className="overflow-hidden">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">Item</th>
                    <th className="w-28 px-3 py-2">Quantity</th>
                    <th className="w-36 px-3 py-2">Preferred vendor</th>
                    <th className="w-32 px-3 py-2">Catalog #</th>
                    <th className="w-40 px-3 py-2">Source</th>
                    <th className="w-20 px-3 py-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {materialsLive.map(m => (
                    <tr key={m.catalog} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2.5">{m.item}</td>
                      <td className="px-3 py-2.5 font-mono-data text-xs">{m.qty}</td>
                      <td className="px-3 py-2.5">{m.vendor}</td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono-data text-xs rounded border border-border bg-muted/40 px-1.5 py-0.5">#{m.catalog}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono-data text-xs">
                        <div className="flex items-center gap-2">
                          {m.sourceUrl ? <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">open</a> : "n/a"}
                          {m.sourceQuality ? (
                            <span className={cn(
                              "rounded border px-1.5 py-0.5 text-[10px]",
                              m.sourceQuality === "exact" ? "border-success/40 text-success" :
                                m.sourceQuality === "partial" ? "border-warning/40 text-warning" :
                                  "border-border text-muted-foreground"
                            )}>
                              {m.sourceQuality}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-data text-xs">${m.cost.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/40 font-medium">
                    <td colSpan={5} className="px-3 py-2 text-right font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">Reagent subtotal</td>
                    <td className="px-3 py-2 text-right font-mono-data text-sm">${materialsLive.reduce((s, m) => s + m.cost, 0).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </TabsContent>

          {/* BUDGET */}
          <TabsContent value="budget" className={cn("m-0 p-6", !plan && !lastPlanError && "hidden")}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Budget & finance</h2>
              <div className="flex items-center gap-2 text-xs flex-wrap justify-end">
                {budgetCap ? (
                  <>
                    <span className="text-muted-foreground">Cap:</span>
                    <span className="font-mono-data font-medium">${budgetCap.toLocaleString()}</span>
                    <Separator orientation="vertical" className="h-4" />
                  </>
                ) : null}
                <span className="text-muted-foreground">Total:</span>
                <span className="font-mono-data font-medium">${totalBudget.toLocaleString()}</span>
                {budgetCap ? (
                  <Badge className={cn(
                    totalBudget <= budgetCap
                      ? "bg-success/15 text-success border-success/30"
                      : "bg-warning/15 text-warning border-warning/30"
                  )}>
                    {totalBudget <= budgetCap
                      ? `$${(budgetCap - totalBudget).toLocaleString()} headroom`
                      : `$${(totalBudget - budgetCap).toLocaleString()} over cap`}
                  </Badge>
                ) : null}
                <ReadReviewToggle checked={reviewModeByTab.budget} onCheckedChange={v => setTabReviewMode("budget", v)} />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <Card className="p-4 lg:col-span-2">
                <div className="mb-2 font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">By category</div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={budgetByCategory}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      >
                        {budgetByCategory.map((_, i) => (
                          <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                        formatter={(v: number) => `$${v.toLocaleString()}`}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="square"
                        wrapperStyle={{ fontSize: 11, color: "hsl(var(--foreground))" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="overflow-x-auto lg:col-span-3">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="w-12 px-3 py-2">#</th>
                      <th className="w-28 px-3 py-2">Category</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="w-28 px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="[&_td]:align-top">
                    {budgetLinesLive.map((l, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono-data text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</td>
                        <td className="px-3 py-2">
                          <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium">{l.category}</span>
                        </td>
                        <td className="max-w-[320px] px-3 py-2 text-sm break-words">{l.description}</td>
                        <td className="px-3 py-2 text-right font-mono-data text-sm">${l.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/40 font-medium">
                      <td colSpan={3} className="px-3 py-2 text-right text-xs uppercase tracking-wider text-muted-foreground">Total</td>
                      <td className="px-3 py-2 text-right font-mono-data">${totalBudget.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            </div>
          </TabsContent>

          {/* TIMELINE */}
          <TabsContent value="parameters" className={cn("m-0 p-6", !plan && !lastPlanError && "hidden")}>
            <div className="mb-4 flex items-center justify-between">
              <div>
              <h2 className="text-base font-semibold">Experiment parameters</h2>
              <p className="text-xs text-muted-foreground">Select vendor strategy, sample size, and automation level to project cost/timeline/reproducibility impact.</p>
              </div>
              <ReadReviewToggle checked={reviewModeByTab.parameters} onCheckedChange={v => setTabReviewMode("parameters", v)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <div className="mb-2 font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">Selected vendor</div>
                <div className="flex flex-wrap gap-2">
                  {(vendorOptions.length ? vendorOptions : ["Best available"]).map(vendor => (
                    <Button
                      key={vendor}
                      size="sm"
                      variant={selectedVendor === vendor ? "default" : "outline"}
                      onClick={() => report?.id && updateReportParameters(report.id, { selectedVendor: vendor })}
                    >
                      {vendor}
                    </Button>
                  ))}
                </div>
                <Separator className="my-4" />
                <div className="mb-2 font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">Sample size: {selectedSampleSize}</div>
                <input
                  type="range"
                  min={sampleSizeMin}
                  max={sampleSizeMax}
                  step={1}
                  value={selectedSampleSize}
                  onChange={e => report?.id && updateReportParameters(report.id, { sampleSize: Number(e.target.value) })}
                  className="w-full"
                />
                <Separator className="my-4" />
                <div className="mb-2 font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">Automation level</div>
                <div className="flex gap-2">
                  {(["low", "medium", "high"] as const).map(level => (
                    <Button
                      key={level}
                      size="sm"
                      variant={selectedAutomation === level ? "default" : "outline"}
                      onClick={() => report?.id && updateReportParameters(report.id, { automationLevel: level })}
                    >
                      {level}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  low: manual workflow, lower cost but more variability · medium: semi-automated balance · high: robotic/high-throughput, higher cost and better reproducibility
                </p>
              </Card>
              <Card className="p-4">
                <div className="mb-3 font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">Projected impact</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <ImpactStat label="Estimated cost" value={`$${projectedCost.toLocaleString()}`} />
                  <ImpactStat label="Timeline" value={`${projectedTimelineWeeks} weeks`} />
                  <ImpactStat label="Sample size" value={`${selectedSampleSize}`} />
                  <ImpactStat label="Reproducibility" value={`${projectedReproducibility}/100`} />
                </div>
                <Separator className="my-4" />
                <p className="text-xs text-muted-foreground">
                  Baseline values come from the unified generated report and are deterministically adjusted from your parameter choices.
                </p>
              </Card>
            </div>
          </TabsContent>

          {/* TIMELINE */}
          <TabsContent value="timeline" className={cn("m-0 p-6", !plan && !lastPlanError && "hidden")}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Detailed timeline</h2>
                <p className="text-xs text-muted-foreground">{timelineWeeks}-week plan generated from backend timeline tasks.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono-data text-[10px]">mermaid · gantt v10.9</Badge>
                <ReadReviewToggle checked={reviewModeByTab.timeline} onCheckedChange={v => setTabReviewMode("timeline", v)} />
              </div>
            </div>
            <Card className="overflow-hidden p-4">
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <MermaidChart definition={buildGanttDefinition(plan) ?? ganttDefinition} />
                </div>
              </div>
              {plan?.timeline?.weeks?.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {plan.timeline.weeks.map(w => (
                    <div key={w.week} className="rounded border border-border bg-muted/20 p-3">
                      <div className="font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">Week {w.week}</div>
                      <ul className="mt-1 space-y-1 text-xs">
                        {w.tasks.map((t, i) => <li key={i}>- {t}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          </TabsContent>

          {/* LITERATURE */}
          <TabsContent value="literature" className={cn("m-0 p-6", !plan && !lastPlanError && "hidden")}>
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Literature</h2>
                  <p className="text-xs text-muted-foreground">Citations indexed by [n] markers throughout the protocol and materials tabs.</p>
                </div>
                <ReadReviewToggle checked={reviewModeByTab.literature} onCheckedChange={v => setTabReviewMode("literature", v)} />
              </div>
            </div>
            <div className="grid gap-3">
              {citationsLive.map(c => (
                <Card key={c.id} className="p-4 transition-colors hover:border-primary/40">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-primary/40 bg-accent font-mono-data text-xs font-medium text-accent-foreground">
                      {c.id}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium leading-snug">{c.title}</h3>
                      <div className="mt-1 text-xs text-muted-foreground">{c.authors}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                        <span className="italic text-muted-foreground">{c.journal} · {c.year ?? "n/a"}</span>
                        <a
                          href={`https://doi.org/${c.doi}`}
                          target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono-data text-primary hover:underline"
                        >
                          doi:{c.doi} <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* MEMORY */}
          <TabsContent value="memory" className={cn("m-0 p-6", !plan && !lastPlanError && "hidden")}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Expert Memory log</h2>
                <p className="text-xs text-muted-foreground">Memory reflects your saved edits and backend-provided corrections for this plan.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono-data text-[10px]">{memoryLive.length} entries</Badge>
                <ReadReviewToggle checked={reviewModeByTab.memory} onCheckedChange={v => setTabReviewMode("memory", v)} />
              </div>
            </div>
            <Card className="overflow-hidden">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="w-20 px-3 py-2">ID</th>
                    <th className="w-40 px-3 py-2">Timestamp</th>
                    <th className="w-48 px-3 py-2">Source</th>
                    <th className="px-3 py-2">Change</th>
                    <th className="w-32 px-3 py-2">Author</th>
                  </tr>
                </thead>
                <tbody>
                  {memoryLive.map(m => (
                    <tr key={m.id} className="border-b border-border last:border-0 align-top hover:bg-muted/30">
                      <td className="px-3 py-2.5 font-mono-data text-xs">{m.id}</td>
                      <td className="px-3 py-2.5 font-mono-data text-xs text-muted-foreground">{m.timestamp}</td>
                      <td className="px-3 py-2.5 text-xs">{m.source} <span className="text-muted-foreground">· {m.field}</span></td>
                      <td className="px-3 py-2.5">
                        <div className="space-y-1 text-xs">
                          <div className="rounded border border-destructive/30 bg-destructive/5 px-2 py-1 text-muted-foreground line-through decoration-destructive/60">{m.before}</div>
                          <div className="rounded border border-success/30 bg-success/5 px-2 py-1">{m.after}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{m.author}</td>
                    </tr>
                  ))}
                  {memoryLive.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-xs text-muted-foreground">No memory entries yet for this report.</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function BufferItem({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="text-xs font-medium">{title}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</div>
    </div>
  );
}

function TabTriggerItem({ value, icon, label }: { value: string; icon: React.ReactNode; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="relative h-11 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-3 text-xs font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
    >
      {icon}
      {label}
    </TabsTrigger>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 font-mono-data text-[10px] text-muted-foreground">{children}</span>;
}

function ImpactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-muted/20 p-3">
      <div className="font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

function ReadReviewToggle({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-muted/20 px-2 py-1 text-[10px]">
      <span className={cn(!checked ? "text-foreground" : "text-muted-foreground")}>Read</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      <span className={cn(checked ? "text-foreground" : "text-muted-foreground")}>Review</span>
    </div>
  );
}

function TimelineBar({ weeks }: { weeks?: Array<{ week: number; tasks: string[] }> }) {
  const phases = (weeks?.length
    ? weeks.map((w, i) => ({ name: `W${w.week}`, weeks: 1, color: `hsl(var(--chart-${(i % 5) + 1}))` }))
    : [
      { name: "Prep", weeks: 1, color: "hsl(var(--chart-2))" },
      { name: "Baseline", weeks: 1, color: "hsl(var(--chart-2))" },
      { name: "Intervention", weeks: 4, color: "hsl(var(--chart-1))" },
      { name: "Sampling", weeks: 1, color: "hsl(var(--chart-4))" },
      { name: "Sequencing", weeks: 1, color: "hsl(var(--chart-5))" },
      { name: "Analysis", weeks: 2, color: "hsl(var(--chart-3))" },
    ]);
  const total = phases.reduce((s, p) => s + p.weeks, 0) || 1;
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex h-8">
        {phases.map(p => (
          <div
            key={p.name}
            className="group relative flex items-center justify-center text-[10px] font-medium text-white/95 transition-opacity hover:opacity-80"
            style={{ width: `${(p.weeks / total) * 100}%`, backgroundColor: p.color }}
            title={`${p.name} · ${p.weeks}w`}
          >
            <span className="font-mono-data">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProtocolRow({ step, onSave }: { step: ReturnType<typeof useWorkstation>["steps"][number]; onSave: (d: string) => void }) {
  return (
    <tr className="border-b border-border align-top last:border-0 hover:bg-muted/20">
      <td className="px-3 py-3">
        <span className="font-mono-data text-xs font-medium">{step.id}</span>
      </td>
      <td className="px-3 py-3">
        <Badge variant="outline" className="text-[10px]">{step.phase}</Badge>
        <div className="mt-1 font-mono-data text-[10px] text-muted-foreground">{step.duration}</div>
      </td>
      <td className="px-3 py-3">
        <div className="mb-1 text-sm font-medium">{step.title}</div>
        <EditableText
          value={step.description}
          onSave={onSave}
          source={`Protocol step ${step.id}`}
          field="description"
          textClassName="text-xs leading-relaxed text-muted-foreground"
        />
      </td>
      <td className="px-3 py-3 text-right" />
    </tr>
  );
}

function parseBudgetCap(text: string): number | null {
  const m = text.match(/\$\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+(?:\.[0-9]+)?)/);
  if (!m) return null;
  const n = Number(m[1].split(",").join(""));
  return Number.isFinite(n) ? n : null;
}

function buildGanttDefinition(plan?: BackendPlan): string | null {
  if (!plan?.timeline?.weeks?.length) return null;
  const lines = [
    "gantt",
    "    title Generated Operational Timeline",
    "    dateFormat  YYYY-MM-DD",
    "    axisFormat  W%V",
    "    section Plan",
  ];
  let cursor = "2026-01-01";
  for (const w of plan.timeline.weeks) {
    const label = `Week ${w.week}: ${(w.tasks?.[0] ?? "Task").slice(0, 40)}`.replace(/[:]/g, "-");
    lines.push(`    ${label.padEnd(30)} :${cursor}, 7d`);
    const dt = new Date(cursor);
    dt.setDate(dt.getDate() + 7);
    cursor = dt.toISOString().slice(0, 10);
  }
  return lines.join("\n");
}