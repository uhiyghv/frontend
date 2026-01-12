import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, Warehouse, Cpu, BarChart3, HelpCircle, LogOut, User, Users } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useTutorialContext } from "@/contexts/TutorialContext";
import { Link } from "react-router-dom";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Dispense", url: "/dispense", icon: Warehouse },
  { title: "Dispositivi", url: "/dispositivi", icon: Cpu },
  { title: "Inventario", url: "/inventario", icon: Package },
  { title: "Grafici", url: "/grafici", icon: BarChart3 },
  { title: "Gruppi", url: "/gruppi", icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { signOut, user } = useAuth();
  const { startTutorial } = useTutorialContext();
  const navigate = useNavigate();
  const isCollapsed = state === "collapsed";

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <Sidebar className={isCollapsed ? "w-16" : "w-64"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>

          {/* Logo linking to home */}
          <Link to="/" className={`flex items-center gap-2 group hover:opacity-80 transition-opacity transition-margin transition-width ${isCollapsed ? '' : 'mx-3'} mb-6 mt-2`}>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Warehouse className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className={`font-bold text-lg  ${isCollapsed ? 'hidden' : ''}`}>PantryOS</span>
          </Link>

          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50"}`}>
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="px-4">{!isCollapsed && "Aiuto"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button type="button" onClick={() => startTutorial()} className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:bg-sidebar-accent/50 w-full text-left cursor-pointer">
                    <HelpCircle className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && <span>Tutorial</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-4 border-t">
        {user && (
          <div className="space-y-3">
            <Button variant="ghost" className={`w-full justify-start gap-3 ${isCollapsed ? 'px-2' : ''}`} onClick={() => navigate('/profilo')}>
              <User className="h-5 w-5" />{!isCollapsed && "Profilo"}
            </Button>
            <Button variant="ghost-destructive" className={`w-full justify-start gap-3 ${isCollapsed ? 'px-2' : ''}`} onClick={handleLogout}>
              <LogOut className="h-5 w-5" />{!isCollapsed && "Esci"}
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
