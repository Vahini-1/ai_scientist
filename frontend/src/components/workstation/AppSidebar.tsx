import { Beaker, BookMarked, Brain, FileText, FolderOpen, Plus, Send, X } from "lucide-react";
import { useState } from "react";
import { useWorkstation } from "@/context/workstation-context";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { reports, activeReportId, openReport, closeReport, view, setView, chatByReportId, sendChat } = useWorkstation();
  const [chatInput, setChatInput] = useState("");
  const active = reports.filter(r => r.status === "active");
  const thread = (activeReportId ? chatByReportId[activeReportId] : []) ?? [];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Beaker className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight">Operus<span className="text-primary">·</span>SOW</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Scientific Workstation</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* New Project */}
        <SidebarGroup>
          <SidebarGroupContent className="p-2">
            <button
              onClick={() => setView("home")}
              className={cn(
                "flex w-full items-center gap-2 rounded-md border border-primary/20 bg-accent px-3 py-2 text-left text-sm font-medium text-accent-foreground transition-colors hover:bg-primary hover:text-primary-foreground",
                view === "home" && "bg-primary text-primary-foreground border-primary",
                collapsed && "justify-center px-0",
              )}
            >
              <Plus className="h-4 w-4 shrink-0" />
              {!collapsed && <span>New Project</span>}
            </button>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Active Reports */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" /> Active Reports
            <Badge variant="secondary" className="ml-auto h-4 px-1.5 text-[10px] font-mono">{active.length}</Badge>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {active.map(r => (
                <SidebarMenuItem key={r.id}>
                  <SidebarMenuButton
                    isActive={view === "report" && activeReportId === r.id}
                    onClick={() => openReport(r.id)}
                    tooltip={r.title}
                    className="h-auto py-2"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium">{r.title}</div>
                        <div className="font-mono-data text-[10px] text-muted-foreground">{r.id}</div>
                      </div>
                    )}
                    {!collapsed && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeReport(r.id);
                        }}
                        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground"
                        title="Close report"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent className="p-2">
            <button
              onClick={() => setView("library")}
              className={cn(
                "flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent",
                view === "library" && "border-primary bg-accent text-accent-foreground",
                collapsed && "justify-center px-0",
              )}
              title="Research Library"
            >
              <BookMarked className="h-4 w-4 shrink-0" />
              {!collapsed && <div className="text-xs font-medium">Research Library</div>}
            </button>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent className="p-2">
            <button
              onClick={() => setView("memory")}
              className={cn(
                "flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent",
                view === "memory" && "border-primary bg-accent text-accent-foreground",
                collapsed && "justify-center px-0",
              )}
              title="Expert Memory"
            >
              <Brain className="h-4 w-4 shrink-0" />
              {!collapsed && <div className="text-xs font-medium">Expert Memory</div>}
            </button>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && view === "report" && (
          <SidebarGroup>
            <SidebarGroupLabel>Report chat</SidebarGroupLabel>
            <SidebarGroupContent className="p-2">
              <div className="h-80 overflow-auto rounded border border-border bg-muted/20 p-3 text-sm">
                {thread.length === 0 ? (
                  <div className="text-muted-foreground">Ask follow-up questions about this report.</div>
                ) : (
                  thread.map(m => (
                    <div key={m.id} className={cn("mb-2 rounded px-2 py-1", m.role === "user" ? "bg-primary/10" : "bg-background")}>
                      <div className="mb-0.5 font-mono-data text-[10px] uppercase text-muted-foreground">{m.role}</div>
                      <div>{m.text}</div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2 flex items-center gap-1">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Ask a follow-up..."
                  className="h-8 flex-1 rounded border border-border bg-background px-2 text-xs"
                />
                <button
                  onClick={() => {
                    void sendChat(chatInput);
                    setChatInput("");
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-border hover:bg-accent"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2" />
    </Sidebar>
  );
}