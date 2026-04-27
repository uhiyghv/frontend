import { useState } from "react";
import { Bell, Search, X, Trash2, Check, AlertTriangle, Info, XCircle, Radio } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { GroupSwitcher } from "@/components/GroupSwitcher";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { notifications, unreadCount, markAllAsRead, deleteNotification, clearAll } = useNotificationContext();
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && unreadCount > 0) {
      markAllAsRead();
    }
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "success":
        return { bg: "bg-success/10", border: "border-success/30", icon: Check, iconColor: "text-success" };
      case "warning":
        return { bg: "bg-warning/10", border: "border-warning/30", icon: AlertTriangle, iconColor: "text-warning" };
      case "error":
        return { bg: "bg-destructive/10", border: "border-destructive/30", icon: XCircle, iconColor: "text-destructive" };
      case "scanner":
        return { bg: "bg-primary/10", border: "border-primary/30", icon: Radio, iconColor: "text-primary" };
      default:
        return { bg: "bg-muted", border: "border-border", icon: Info, iconColor: "text-muted-foreground" };
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Ora";
    if (diffMins < 60) return `${diffMins} min fa`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h fa`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}g fa`;
    return date.toLocaleDateString("it-IT");
  };

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-3 sm:px-6 gap-2 sm:gap-4">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <SidebarTrigger />
        <div className="min-w-0 flex-1 sm:flex-initial">
          <GroupSwitcher />
        </div>
        <div className="relative w-64 max-w-md hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca prodotti, dispense..." className="pl-10" />
        </div>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" data-notification-bell>
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] flex items-center justify-center p-0 px-1 bg-destructive text-destructive-foreground text-xs">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96 bg-popover p-0" sideOffset={8}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold">Notifiche</h3>
              {notifications.length > 0 && (
                <Button variant="ghost-destructive" size="sm" className="text-xs text-muted-foreground" onClick={(e) => { e.preventDefault(); clearAll(); }}>
                  <Trash2 className="h-3 w-3 mr-1" />Elimina tutte
                </Button>
              )}
            </div>
            
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nessuna notifica</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="divide-y">
                  {notifications.map((notification) => {
                    const styles = getTypeStyles(notification.type);
                    const IconComponent = styles.icon;
                    return (
                      <div key={notification.id} className={cn("relative px-4 py-3 hover:bg-muted/50 transition-colors group", !notification.read && "bg-primary/5")}>
                        <div className="flex gap-3">
                          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center border shrink-0", styles.bg, styles.border)}>
                            <IconComponent className={cn("h-4 w-4", styles.iconColor)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-sm truncate">{notification.title}</p>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteNotification(notification.id); }}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">{formatTime(notification.created_at)}</p>
                          </div>
                        </div>
                        {!notification.read && <div className="absolute top-4 right-12 h-2 w-2 rounded-full bg-primary" />}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
