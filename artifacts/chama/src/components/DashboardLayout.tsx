import { useState, useEffect, useCallback } from "react";
import { AutoSignOut } from "@/components/AutoSignOut";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  DollarSign,
  Settings,
  Shield,
  Building,
  LogOut,
  Menu,
  X,
  ChevronRight,
  MessageCircle,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { RegionSelector } from "@/components/RegionSelector";
import { useRegion } from "@/contexts/RegionContext";
import { UserAvatar } from "@/components/UserAvatar";
import { apiRequest } from "@/lib/api";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  badge?: number;
}

const BASE_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Groups", href: "/groups", icon: Users },
  { label: "Contributions", href: "/contributions", icon: CreditCard },
  { label: "Payouts", href: "/payouts", icon: DollarSign },
  { label: "Messages", href: "/messages", icon: MessageSquare },
  { label: "Support", href: "/support", icon: MessageCircle },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Group Admin", href: "/admin/group", icon: Shield, roles: ["group_admin"] },
  { label: "Organization", href: "/org", icon: Building, roles: ["org_admin"] },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { region } = useRegion();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadDms, setUnreadDms] = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const data = await apiRequest<{ count: number }>("/api/dm/unread-count");
      setUnreadDms(data.count ?? 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 15000);
    return () => clearInterval(interval);
  }, [loadUnread]);

  const navItems: NavItem[] = BASE_NAV.map(item =>
    item.href === "/messages" ? { ...item, badge: unreadDms } : item
  );

  const filteredNav = navItems.filter(item =>
    !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <div className="min-h-screen flex bg-background isolate">
      <AutoSignOut />
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-auto lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border">
          <Logo variant="white" />
          <button
            className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground shrink-0"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
            {filteredNav.map(item => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  ) : isActive ? (
                    <ChevronRight className="w-4 h-4 ml-auto opacity-60" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <UserAvatar
              name={user?.name ?? ""}
              avatar={user?.avatar}
              size="md"
              sidebarStyle
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border h-14 flex items-center px-4 gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1" />
          <RegionSelector />
        </header>

        {/* Page content — key forces re-render on region/location change and triggers entrance animation */}
        <main className="flex-1 overflow-auto">
          <div key={`${location}-${region.code}`} className="p-4 sm:p-6 page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
