import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import AppFooter from "@/components/AppFooter";
import logoBot from "@/assets/logoBot.png";
import { useAuth } from "@/lib/authContext";
import { getManageMode, getStoredBotId, setManageMode, setStoredBotId } from "@/lib/botContext";
import { listBots, type BotRecord } from "@/lib/api";

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [bots, setBots] = useState<BotRecord[]>([]);
  const [selectedBotId, setSelectedBotId] = useState(getStoredBotId());
  const isAdminManage = user?.role === "admin" ? getManageMode() : true;

  useEffect(() => {
    const loadBots = async () => {
      if (!user) return;
      if (user.role === "admin") {
        try {
          const response = await listBots();
          setBots(response.bots);
        } catch {
          setBots([]);
        }
      } else {
        setBots(
          (user.botIds || []).map((id) => ({
            id,
            name: id,
            status: "active",
            createdAt: "",
            updatedAt: "",
          }))
        );
      }
    };

    loadBots();
  }, [user]);

  const availableBots = useMemo(() => bots.filter((bot) => bot.id), [bots]);
  const activeBot = useMemo(
    () => availableBots.find((bot) => bot.id === selectedBotId) || null,
    [availableBots, selectedBotId]
  );

  useEffect(() => {
    if (!availableBots.length) return;
    if (user?.role === "manager") {
      if (!selectedBotId || !availableBots.some((bot) => bot.id === selectedBotId)) {
        const next = availableBots[0].id;
        setSelectedBotId(next);
        setStoredBotId(next);
      }
      return;
    }

    if (user?.role === "admin") {
      if (!isAdminManage) {
        setSelectedBotId("");
        setStoredBotId("");
        return;
      }
      if (selectedBotId && !availableBots.some((bot) => bot.id === selectedBotId)) {
        setSelectedBotId("");
        setStoredBotId("");
      }
    }
  }, [availableBots, selectedBotId, user, isAdminManage]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-white">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b border-border px-4 bg-white">
            <SidebarTrigger className="mr-3" />
            <img src={logoBot} alt="Bot Logo" className="w-8 h-8 object-contain mr-3" />
            <span className="text-sm font-semibold text-foreground">Bot de la Facultad de Ingeniería</span>
            <div className="ml-auto flex items-center gap-3">
              {activeBot && (user?.role !== "admin" || isAdminManage) ? (
                <span className="text-xs px-2 py-1 rounded-full bg-secondary text-foreground">
                  Bot activo: {activeBot.name || activeBot.id}
                </span>
              ) : null}
              {availableBots.length > 0 && (user?.role === "manager" || isAdminManage) ? (
                <select
                  className="text-xs border border-border rounded-md px-2 py-1 bg-white"
                  value={selectedBotId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedBotId(value);
                    setStoredBotId(value);
                  }}
                >
                  {availableBots.map((bot) => (
                    <option key={bot.id} value={bot.id}>
                      {bot.name || bot.id}
                    </option>
                  ))}
                </select>
              ) : null}
              {user?.role === "admin" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStoredBotId("");
                      setSelectedBotId("");
                      navigate("/");
                    }}
                    className="text-xs font-medium text-slate-700 hover:text-slate-900"
                  >
                    Volver al admin
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/bots")}
                    className="text-xs font-medium text-slate-700 hover:text-slate-900"
                  >
                    Bots
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/accesos")}
                    className="text-xs font-medium text-slate-700 hover:text-slate-900"
                  >
                    Accesos
                  </button>
                </div>
              ) : null}
              {user ? <span className="text-xs text-muted-foreground">{user.email}</span> : null}
              <button
                type="button"
                onClick={() => logout()}
                className="text-xs font-medium text-slate-700 hover:text-slate-900"
              >
                Salir
              </button>
            </div>
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
