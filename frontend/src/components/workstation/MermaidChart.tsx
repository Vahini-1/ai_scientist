import { useEffect, useRef } from "react";
import mermaid from "mermaid";
import { useTheme } from "@/components/theme-provider";

let initialised = false;

export function MermaidChart({ definition }: { definition: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === "dark" ? "dark" : "neutral",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      gantt: {
        leftPadding: 90,
        barHeight: 22,
        barGap: 6,
        topPadding: 60,
        gridLineStartPadding: 50,
        fontSize: 12,
      },
      themeVariables: theme === "dark"
        ? { primaryColor: "#6366f1", primaryTextColor: "#e5e7eb", lineColor: "#475569", taskBkgColor: "#6366f1", activeTaskBkgColor: "#0ea5e9", doneTaskBkgColor: "#10b981" }
        : { primaryColor: "#4f46e5", primaryTextColor: "#1e293b", lineColor: "#cbd5e1", taskBkgColor: "#4f46e5", activeTaskBkgColor: "#0ea5e9", doneTaskBkgColor: "#10b981" },
    });
    initialised = true;

    let cancelled = false;
    const id = `m-${Math.random().toString(36).slice(2, 9)}`;
    mermaid.render(id, definition).then(({ svg }) => {
      if (!cancelled && ref.current) ref.current.innerHTML = svg;
    }).catch(err => {
      if (ref.current) ref.current.innerHTML = `<pre class="text-xs text-destructive">${String(err)}</pre>`;
    });
    return () => { cancelled = true; };
  }, [definition, theme]);

  return <div ref={ref} className="mermaid-host w-full overflow-x-auto" />;
}