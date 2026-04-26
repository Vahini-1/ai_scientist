import { citations } from "@/lib/mock-report";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ExternalLink } from "lucide-react";

export function CitationRef({ id }: { id: number }) {
  const c = citations.find(x => x.id === id);
  if (!c) return null;
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <a
          href={`https://doi.org/${c.doi}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-4 min-w-[18px] items-center justify-center rounded border border-primary/40 bg-accent px-1 align-baseline font-mono-data text-[10px] font-medium text-accent-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
        >
          [{c.id}]
        </a>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 text-xs" side="top">
        <div className="space-y-1.5">
          <div className="font-medium leading-snug">{c.title}</div>
          <div className="text-muted-foreground">{c.authors}</div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="italic">{c.journal} · {c.year}</span>
            <a href={`https://doi.org/${c.doi}`} target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-1 font-mono-data text-primary hover:underline">
              DOI <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function CitationGroup({ ids }: { ids: number[] }) {
  if (!ids.length) return <span className="text-muted-foreground/40 text-xs">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {ids.map(id => <CitationRef key={id} id={id} />)}
    </span>
  );
}