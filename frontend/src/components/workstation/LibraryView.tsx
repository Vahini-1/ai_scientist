import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Archive, BookMarked, Calendar, Search, Sparkles, TrendingUp } from "lucide-react";
import { useWorkstation, type LibraryEntry } from "@/context/workstation-context";
import { cn } from "@/lib/utils";

const statusStyles: Record<LibraryEntry["status"], string> = {
  active: "bg-success/15 text-success border-success/30",
  completed: "bg-primary/15 text-primary border-primary/30",
  archived: "bg-muted text-muted-foreground border-border",
};

export function LibraryView() {
  const { library, openReport } = useWorkstation();
  const [q, setQ] = useState("");
  const archived = library.filter(l => l.status === "archived" || l.status === "completed");
  const filtered = library.filter(l =>
    !q.trim() ||
    l.title.toLowerCase().includes(q.toLowerCase()) ||
    l.subtitle.toLowerCase().includes(q.toLowerCase()) ||
    l.tags.some(t => t.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">Research Library</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono-data">{archived.length}</span> experiments in archive · indexed by hypothesis, methodology and outcome
          </p>
        </div>
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search title, tags, methods…"
            className="h-9 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map(entry => (
          <Card
            key={entry.id}
            className="group cursor-pointer p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
            onClick={() => {
              if (entry.reportId) openReport(entry.reportId);
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold group-hover:text-primary">
                    {entry.title}
                  </h3>
                  <span className="font-mono-data text-[10px] text-muted-foreground">{entry.id}</span>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">{entry.subtitle}</p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-1 font-mono-data text-[10px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {entry.date}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {entry.tags.map(t => (
                      <Badge key={t} variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <Badge className={cn("border text-[10px] capitalize", statusStyles[entry.status])}>
                  {entry.status === "archived" && <Archive className="mr-1 h-3 w-3" />}
                  {entry.status}
                </Badge>
                <div className="flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="font-mono-data text-[10px] text-muted-foreground">Novelty:</span>
                  <span className="font-mono-data text-xs font-semibold">{entry.novelty}%</span>
                </div>
              </div>
            </div>

            {/* Novelty bar */}
            <div className="mt-3 flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all"
                  style={{ width: `${entry.novelty}%` }}
                />
              </div>
              <span className="font-mono-data text-[10px] text-muted-foreground">{entry.novelty}/100</span>
            </div>
          </Card>
        ))}

        {filtered.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No experiments matching "{q}"</p>
          </Card>
        )}
      </div>
    </div>
  );
}