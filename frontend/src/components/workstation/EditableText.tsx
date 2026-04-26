import { useState } from "react";
import { Pencil, Check, X, Brain } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useWorkstation } from "@/context/workstation-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { submitReviewCorrection, summarizeChange, summarizeChangeWithAI } from "@/lib/review";

type Props = {
  value: string;
  onSave: (next: string) => void;
  source: string;
  field: string;
  className?: string;
  textClassName?: string;
};

export function EditableText({ value, onSave, source, field, className, textClassName }: Props) {
  const { addMemory, reports, activeReportId, reviewMode } = useWorkstation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const start = () => {
    setDraft(value);
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const save = async (submitToMemory: boolean) => {
    if (draft !== value) {
      onSave(draft);
      if (submitToMemory) {
        const reduced = await summarizeChangeWithAI(value, draft).catch(() => summarizeChange(value, draft));
        addMemory({ source, field, before: reduced.before, after: reduced.after, author: "John Doe" });
        const active = reports.find(r => r.id === activeReportId);
        if (active) {
          const domain =
            source.toLowerCase().includes("protocol") ? "protocol" :
              source.toLowerCase().includes("validation") ? "validation" :
                source.toLowerCase().includes("budget") ? "budget" :
                  source.toLowerCase().includes("timeline") ? "timeline" : "general";
          try {
            await submitReviewCorrection({
              hypothesis: active.hypothesis,
              editedText: reduced.after,
              experimentType: "general",
              correction: {
                domain,
                source,
                field,
                before: reduced.before,
                after: reduced.after,
                summary: `${source} ${field} updated`,
                tags: [domain, "review-edit"],
              },
            });
            toast.success("Submitted to Expert Memory", { description: `${source} · ${field} saved to Supabase.` });
          } catch (e) {
            toast.error("Saved locally but failed syncing Supabase", { description: e instanceof Error ? e.message : String(e) });
          }
        }
      } else {
        toast.success("Edit applied (local only)");
      }
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className={cn("group relative", className)}>
        <p className={cn("text-sm leading-relaxed text-foreground", textClassName)}>{value}</p>
        {reviewMode ? (
          <button
            onClick={start}
            className="absolute -right-1 -top-1 inline-flex h-6 w-6 items-center justify-center rounded border border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
            aria-label="Edit / Review"
            title="Review mode"
          >
            <Pencil className="h-3 w-3" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2 rounded-md border border-primary/40 bg-accent/30 p-2", className)}>
      <div className="flex items-center justify-between">
        <span className="font-mono-data text-[10px] uppercase tracking-wider text-primary">Review mode · {source}</span>
      </div>
      <Textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={Math.max(3, Math.min(10, Math.ceil(draft.length / 80)))}
        className="font-sans text-sm leading-relaxed"
      />
      <div className="flex items-center justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={cancel} className="h-7 gap-1 text-xs">
          <X className="h-3 w-3" /> Cancel
        </Button>
        <Button size="sm" variant="outline" onClick={() => void save(false)} className="h-7 gap-1 text-xs">
          <Check className="h-3 w-3" /> Apply
        </Button>
        <Button size="sm" onClick={() => void save(true)} className="h-7 gap-1 text-xs">
          <Brain className="h-3 w-3" /> Submit to Memory
        </Button>
      </div>
    </div>
  );
}