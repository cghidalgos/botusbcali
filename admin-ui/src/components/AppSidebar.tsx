import { MessageSquare, FileText, Clock, Activity, Home, Brain, Users, Tags, ClipboardList } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import logoBot from "@/assets/logoBot.png";

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
  { title: "Categorías", url: "/categorias", icon: Tags },
  { title: "Actividad", url: "/actividad", icon: Activity },
  { title: "Aprendizaje", url: "/aprendizaje", icon: Brain },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

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
              {items.map((item) => (
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
