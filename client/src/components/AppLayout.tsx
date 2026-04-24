import { useApp, type ActiveUser } from "@/App";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";
import {
  LayoutDashboard, Calendar, ClipboardList, MessageSquare,
  Image, Archive, User, Bell, Sun, Moon, ChevronDown,
  Heart, Menu, X, Users, Shield, Eye, Mic
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/schedule", label: "Schedule", icon: Calendar },
  { path: "/activity", label: "Activity Log", icon: ClipboardList },
  { path: "/messages", label: "Messages", icon: MessageSquare },
  { path: "/media", label: "Photos & Videos", icon: Image },
  { path: "/archive", label: "Archive", icon: Archive },
  { path: "/portal", label: "Client Profile", icon: User },
];

const ROLE_LABELS: Record<string, string> = {
  caregiver: "Caregiver",
  primary_family: "Primary Family",
  secondary_family: "Family Member",
};

const ROLE_ICONS: Record<string, typeof Shield> = {
  caregiver: Shield,
  primary_family: Users,
  secondary_family: Eye,
};

function PriorityBadge({ priority }: { priority: string }) {
  const colors = {
    red: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
    yellow: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
    green: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
  };
  const labels = { red: "Urgent", yellow: "Important", green: "Routine" };
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", colors[priority as keyof typeof colors] || colors.green)}>
      {labels[priority as keyof typeof labels] || "Routine"}
    </span>
  );
}

export { PriorityBadge };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { activeUser, setActiveUser, demoUsers, selectedClientId, setSelectedClientId, theme, toggleTheme } = useApp();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/users", activeUser.id, "notifications"],
    queryFn: () => apiRequest("GET", `/api/users/${activeUser.id}/notifications`).then(r => r.json()),
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const RoleIcon = ROLE_ICONS[activeUser.role] || Shield;

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="flex-shrink-0">
          <svg aria-label="Care Net Portal" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="hsl(175, 55%, 28%)"/>
            <path d="M16 8a5 5 0 0 1 5 5c0 4-5 11-5 11S11 17 11 13a5 5 0 0 1 5-5z" fill="white"/>
            <circle cx="16" cy="13" r="2" fill="hsl(175, 55%, 28%)"/>
          </svg>
        </div>
        <div>
          <div className="font-bold text-sm text-sidebar-foreground leading-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Care Net</div>
          <div className="text-xs text-sidebar-foreground/50">Portal</div>
        </div>
      </div>

      {/* Client Selector (caregiver only) */}
      {activeUser.role === "caregiver" && (
        <div className="px-3 py-3 border-b border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/40 uppercase tracking-wider mb-2 px-2">Active Client</div>
          <div className="flex gap-2">
            <button
              data-testid="client-selector-1"
              onClick={() => setSelectedClientId(1)}
              className={cn("flex-1 text-xs py-2 px-3 rounded-md transition-all", selectedClientId === 1 ? "bg-sidebar-primary/20 text-sidebar-primary border border-sidebar-primary/30" : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground")}
            >
              Robert J.
            </button>
            <button
              data-testid="client-selector-2"
              onClick={() => setSelectedClientId(2)}
              className={cn("flex-1 text-xs py-2 px-3 rounded-md transition-all", selectedClientId === 2 ? "bg-sidebar-primary/20 text-sidebar-primary border border-sidebar-primary/30" : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground")}
            >
              Eleanor W.
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const isActive = path === "/" ? location === "/" : location.startsWith(path);
          return (
            <Link key={path} href={path} onClick={() => setMobileOpen(false)}>
              <a className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-primary/20 text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )} data-testid={`nav-${label.toLowerCase().replace(/ /g, '-')}`}>
                <Icon size={18} className="flex-shrink-0" />
                {label}
                {path === "/messages" && unreadCount > 0 && (
                  <span className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Voice hint */}
      <div className="px-4 py-3 mx-3 mb-3 rounded-lg bg-sidebar-accent/60 border border-sidebar-border">
        <div className="flex items-center gap-2 text-sidebar-foreground/60 text-xs">
          <Mic size={13} />
          <span>Voice logging available on all screens</span>
        </div>
      </div>

      {/* User Profile */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sidebar-accent transition-colors text-left" data-testid="user-menu-trigger">
              <div className="w-8 h-8 rounded-full bg-sidebar-primary/30 flex items-center justify-center text-sidebar-primary text-xs font-bold flex-shrink-0">
                {activeUser.avatarInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-sidebar-foreground truncate">{activeUser.name}</div>
                <div className="text-xs text-sidebar-foreground/50">{ROLE_LABELS[activeUser.role]}</div>
              </div>
              <ChevronDown size={14} className="text-sidebar-foreground/40 flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel>Switch Role (Demo)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {demoUsers.map(user => {
              const Icon = ROLE_ICONS[user.role] || Shield;
              return (
                <DropdownMenuItem
                  key={user.id}
                  onClick={() => setActiveUser(user)}
                  className="cursor-pointer"
                  data-testid={`role-switch-${user.id}`}
                >
                  <Icon size={14} className="mr-2 flex-shrink-0" />
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</div>
                  </div>
                  {activeUser.id === user.id && (
                    <span className="ml-auto text-primary text-xs">●</span>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-60 flex-shrink-0 border-r border-border">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 flex flex-col">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm flex-shrink-0">
          <button
            className="md:hidden p-2 rounded-lg hover:bg-muted"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="mobile-menu-toggle"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Role indicator pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
            <RoleIcon size={12} />
            <span>{ROLE_LABELS[activeUser.role]} View</span>
          </div>

          <div className="flex-1" />

          {/* Notification Bell */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative p-2 rounded-lg hover:bg-muted transition-colors" data-testid="notifications-bell">
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                {unreadCount > 0 && <span className="text-xs text-muted-foreground">{unreadCount} unread</span>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
              ) : (
                notifications.slice(0, 6).map(n => (
                  <DropdownMenuItem key={n.id} className={cn("flex flex-col items-start gap-1 py-3 cursor-pointer", !n.isRead && "bg-accent/30")}>
                    <div className="flex items-center gap-2 w-full">
                      <PriorityBadge priority={n.priority || "green"} />
                      {!n.isRead && <span className="ml-auto w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="text-xs text-muted-foreground">{n.body}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Toggle theme"
            data-testid="theme-toggle"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
