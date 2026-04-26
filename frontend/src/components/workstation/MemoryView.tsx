import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Plus, Sparkles, Database } from "lucide-react";
import { useWorkstation } from "@/context/workstation-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function MemoryView() {
  const { memory, insights, addInsight, reports } = useWorkstation();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    addInsight({ text: text.trim(), category: "Protocol Quality", source: "User Input" });
    setText("");
    setAdding(false);
    toast.success("Insight added to Expert Memory");
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">Expert Memory</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Accumulated insights from <span className="font-mono-data">{reports.length}</span> past experiments
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(v => !v)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Insight
        </Button>
      </div>

      {/* Add form */}
      {adding && (
        <Card className="mb-4 border-primary/30 p-4">
          <div className="mb-3 flex items-center gap-2 font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> New insight
          </div>
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            placeholder="Describe a learning, correction, or rule the agent should remember…"
            className="resize-none text-sm"
          />
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={!text.trim()}>Save</Button>
          </div>
        </Card>
      )}

      {/* Review corrections (from report edits) */}
      <div className="mb-2 font-mono-data text-[10px] uppercase tracking-wider text-muted-foreground">
        Structured correction log
      </div>
      <div className="grid gap-3">
        {memory.map(m => (
          <Card key={m.id} className="p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-mono-data">{m.id}</span>
              <span className="text-muted-foreground">{m.timestamp}</span>
            </div>
            <div className="mb-1 text-xs text-muted-foreground">{m.source} · {m.field}</div>
            <div className="space-y-1 text-xs">
              <div className="rounded border border-destructive/30 bg-destructive/5 px-2 py-1 line-through text-muted-foreground">{m.before}</div>
              <div className="rounded border border-success/30 bg-success/5 px-2 py-1">{m.after}</div>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">{m.author}</div>
          </Card>
        ))}
        {memory.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No review corrections saved yet.</p>
          </Card>
        )}
      </div>

      {/* Footer note */}
      <Card className="mt-6 border-dashed bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <div className="mb-0.5 text-sm font-medium">Feedback Store Intelligence</div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Feedback store captures corrections in structured form and supports tagging by experiment type and domain.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}