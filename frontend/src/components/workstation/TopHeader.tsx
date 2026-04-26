import { FileDown, FileText, Moon, Sun, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/components/theme-provider";
import { useWorkstation } from "@/context/workstation-context";
import { toast } from "sonner";
import { exportPlanAsDOCX, exportPlanAsPDF } from "@/lib/export";

export function TopHeader() {
  const { theme, toggle } = useTheme();
  const { view, activeReportId, reports, planByReportId, steps, validationText, memory } = useWorkstation();
  const active = reports.find(r => r.id === activeReportId);
  const plan = activeReportId ? planByReportId[activeReportId] : undefined;

  const onExport = async (format: "PDF" | "DOCX") => {
    const title = active ? `${active.id} — ${active.title}` : "Operational Plan";
    const content = active
      ? [
        `Hypothesis:\n${active.hypothesis}`,
        `\nConstraints:\n${active.constraints}`,
        plan?.summary ? `\n\nSummary:\n- Novelty: ${plan.summary.noveltyStatus}\n- Reason: ${plan.summary.noveltyReason}\n- Total budget: ${plan.summary.totalBudget}` : "",
        plan?.protocol?.length ? `\n\nProtocol:\n${plan.protocol.map(p => `${p.step}. ${p.instruction} (${p.duration})`).join("\n")}` : `\n\nProtocol:\n${steps.map((s, i) => `${i + 1}. ${s.description}`).join("\n")}`,
        `\n\nValidation:\n${validationText}`,
        plan?.materials?.length ? `\n\nMaterials:\n${plan.materials.map(m => `- ${m.item} | ${m.vendor} | ${m.catalogNum} | ${m.price}`).join("\n")}` : "",
        plan?.budget?.length ? `\n\nBudget:\n${plan.budget.map(b => `- ${b.category}: ${b.description} = ${b.amount}`).join("\n")}` : "",
        plan?.timeline?.weeks?.length ? `\n\nTimeline:\n${plan.timeline.weeks.map(w => `Week ${w.week}: ${w.tasks.join("; ")}`).join("\n")}` : "",
        plan?.literature?.length ? `\n\nLiterature:\n${plan.literature.map(l => `- ${l.title} (${l.doi})`).join("\n")}` : "",
        memory.length ? `\n\nExpert Memory:\n${memory.map(m => `- ${m.source} | ${m.field} | ${m.after}`).join("\n")}` : "",
      ].join("")
      : "No report selected.";

    try {
      if (format === "PDF") exportPlanAsPDF({ title, content });
      else await exportPlanAsDOCX({ title, content });

      toast.success(`Export ready — ${format}`, {
        description: active ? `${active.id} · ${active.title}` : "Downloaded.",
      });
    } catch (e) {
      toast.error(`Export failed — ${format}`, { description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />

      <div className="flex min-w-0 items-center gap-2">
        <CircleDot className="h-3.5 w-3.5 text-success animate-pulse" />
        {view === "report" && active ? (
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="font-mono-data text-xs text-muted-foreground">{active.id}</span>
            <span className="truncate text-sm font-medium">{active.title}</span>
          </div>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">New Operational Plan</span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 font-mono-data text-[10px] text-muted-foreground md:flex">
          <span>v0.4.2</span>
          <span className="text-border">·</span>
          <span>session 7f3a</span>
        </div>

        <Button variant="outline" size="sm" onClick={() => void onExport("PDF")} className="gap-1.5">
          <FileDown className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export PDF</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() => void onExport("DOCX")} className="gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export DOCX</span>
        </Button>

        <Separator orientation="vertical" className="h-5" />

        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" className="h-8 w-8">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}