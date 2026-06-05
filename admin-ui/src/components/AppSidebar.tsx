import { MessageSquare, FileText, Clock, Activity, Home, Brain, Users, Tags, ClipboardList, Layers, Shield, ThumbsUp, AlertCircle } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import logoBot from "@/assets/logoBot.png";
import { useAuth } from "@/lib/authContext";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Inicio", url: "/", icon: Home },
  { title: "Contexto", url: "/contexto", icon: MessageSquare },
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Encuestas", url: "/surveys", icon: ClipboardList },
  { title: "Historial", url: "/historial", icon: Clock },
  { title: "Usuarios", url: "/usuarios", icon: Users },
  { title: "Bots", url: "/bots", icon: Layers },
  { title: "Accesos", url: "/accesos", icon: Shield },
  { title: "Categorías", url: "/categorias", icon: Tags },
  { title: "Actividad", url: "/actividad", icon: Activity },
  { title: "Aprendizaje", url: "/aprendizaje", icon: Brain },
  { title: "Feedback", url: "/feedback", icon: ThumbsUp },
  { title: "Vacíos", url: "/vacios", icon: AlertCircle },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user } = useAuth();

  const visibleItems = items.filter((item) => {
    if (user?.role === "admin") {
      return item.url === "/bots" || item.url === "/accesos";
    }
    if (item.url === "/bots" || item.url === "/accesos") {
      return false;
    }
    return true;
  });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <img src={logoBot} alt="Bot Logo" className="w-9 h-9 object-contain rounded-lg" />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold text-sidebar-foreground leading-tight">Bot Admin</span>
            <span className="text-[10px] text-muted-foreground leading-tight">Facultad de Ingeniería</span>
          </div>
        )}
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                      activeClassName="bg-primary/10 text-primary font-semibold"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
