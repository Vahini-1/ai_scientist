import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/workstation/AppSidebar";
import { TopHeader } from "@/components/workstation/TopHeader";
import { PromptInterface } from "@/components/workstation/PromptInterface";
import { ReportView } from "@/components/workstation/ReportView";
import { LibraryView } from "@/components/workstation/LibraryView";
import { MemoryView } from "@/components/workstation/MemoryView";
import { useWorkstation } from "@/context/workstation-context";

const Index = () => {
  const { view } = useWorkstation();
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader />
          <main className="flex-1 overflow-auto">
            {view === "home" && <PromptInterface />}
            {view === "report" && <ReportView />}
            {view === "library" && <LibraryView />}
            {view === "memory" && <MemoryView />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
