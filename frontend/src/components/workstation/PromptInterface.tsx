import { useState } from "react";
import { Sparkles, Loader2, FlaskConical, Microscope, Dna, Brain, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkstation } from "@/context/workstation-context";
import { fetchNoveltyCheck, type NoveltyCheckResult } from "@/lib/novelty";

const examples = [
  { icon: Dna, label: "Diagnostics", text: "A paper-based electrochemical biosensor functionalized with anti-CRP antibodies will detect C-reactive protein in whole blood at concentrations below 0.5 mg/L within 10 minutes, matching laboratory ELISA sensitivity without requiring sample preprocessing." },
  { icon: FlaskConical, label: "Gut Health", text: "Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin." },
  { icon: Microscope, label: "Cell Biology", text: "Replacing sucrose with trehalose as a cryoprotectant in the freezing medium will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to the standard DMSO protocol, due to trehalose's superior membrane stabilization at low temperatures." },
  { icon: Cloud, label: "Climate", text: "Introducing Sporomusa ovata into a bioelectrochemical system at a cathode potential of −400mV vs SHE will fix CO₂ into acetate at a rate of at least 150 mmol/L/day, outperforming current biocatalytic carbon capture benchmarks by at least 20%."}
];

export function PromptInterface() {
  const { generateReport, generating } = useWorkstation();
  const [hypothesis, setHypothesis] = useState("");
  const [constraints, setConstraints] = useState("");
  const [checking, setChecking] = useState(false);
  const [novelty, setNovelty] = useState<NoveltyCheckResult | null>(null);

  const onGenerate = async () => {
    if (!hypothesis.trim()) return;
    setChecking(true);
    try {
      const res = await fetchNoveltyCheck(hypothesis.trim());
      setNovelty(res);
      await generateReport(hypothesis.trim(), constraints, res);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-3xl px-6 py-10">
      {novelty && (
        <Card className="mb-4 border-primary/30 bg-accent/30 p-4">
          <div className="font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">Novelty check</div>
          <div className="mt-1 text-sm font-medium">{novelty.noveltyStatus}</div>
          <div className="mt-1 text-xs text-muted-foreground">Novelty is shown first while the full plan is being generated.</div>
        </Card>
      )}

      {/* Header */}
      <div className="mb-8 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/30 bg-accent text-accent-foreground font-mono-data text-[10px]">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            AGENT READY
          </Badge>
          <span className="font-mono-data text-[10px] text-muted-foreground">model: gpt-5.1 · grounding: pubmed+biorxiv</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Plan an experiment</h1>
        <p className="text-sm text-muted-foreground">
          Provide a hypothesis and operating constraints. The agent returns a literature-grounded protocol,
          materials list, budget, and timeline ready for benchwork.
        </p>
      </div>

      <Card className="overflow-hidden border-border shadow-sm">
        <div className="border-b border-border bg-muted/40 px-4 py-2">
          <div className="flex items-center gap-2 font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">
            <Brain className="h-3 w-3 text-primary" />
            Operational plan request
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium">
              Hypothesis / Research goal
              <span className="ml-1.5 font-mono-data text-[10px] text-muted-foreground">required</span>
            </label>
            <Textarea
              value={hypothesis}
              onChange={e => setHypothesis(e.target.value)}
              placeholder="State the hypothesis you want to test, including expected direction of effect, primary readout, and population…"
              rows={5}
              className="resize-none font-sans text-sm leading-relaxed"
            />
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Be specific: state population, intervention, comparator, outcome.</span>
              <span className="font-mono-data">{hypothesis.length} chars</span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium">
              Context & constraints
              <span className="ml-1.5 font-mono-data text-[10px] text-muted-foreground">budget · equipment · timeline · ethics</span>
            </label>
            <Textarea
              value={constraints}
              onChange={e => setConstraints(e.target.value)}
              rows={3}
              className="resize-none font-sans text-sm"
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="text-[11px] text-muted-foreground">
              Provide clear constraints for budget, timeline, and equipment.
            </div>
            <div className="flex items-center gap-3">
              {generating && (
                <div className="hidden text-[11px] text-muted-foreground md:block">
                  Processing... (Estimated 30-40s)
                </div>
              )}
              <Button onClick={() => void onGenerate()} disabled={!hypothesis.trim() || generating || checking} className="gap-2">
                {(generating || checking) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {checking ? "Checking novelty…" : generating ? "Generating plan…" : "Generate Operational Plan"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Examples */}
      <div className="mt-8">
        <div className="mb-3 font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">
          Seed examples — click to load
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {examples.map(ex => {
            const Icon = ex.icon;
            return (
              <button
                key={ex.label}
                onClick={() => setHypothesis(ex.text)}
                className="group rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/50"
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">{ex.label}</span>
                </div>
                <p className="line-clamp-3 text-[11px] leading-relaxed text-muted-foreground group-hover:text-foreground">
                  {ex.text}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}