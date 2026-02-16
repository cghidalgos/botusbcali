import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import AppFooter from "@/components/AppFooter";
import logoBot from "@/assets/logoBot.png";

const AppLayout = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-white">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b border-border px-4 bg-white">
            <SidebarTrigger className="mr-3" />
            <img src={logoBot} alt="Bot Logo" className="w-8 h-8 object-contain mr-3" />
            <span className="text-sm font-semibold text-foreground">Bot de la Facultad de Ingeniería</span>
          </header>
          <main className="flex-1 p-6 max-w-5xl w-full mx-auto">
            <Outlet />
          </main>
          <AppFooter />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
