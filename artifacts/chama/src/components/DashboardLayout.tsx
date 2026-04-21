import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { RegionSelector } from "@/components/RegionSelector";
import { useRegion } from "@/contexts/RegionContext";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Groups", href: "/groups", icon: Users },
  { label: "Contributions", href: "/contributions", icon: CreditCard },
  { label: "Payouts", href: "/payouts", icon: DollarSign },
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

  const filteredNav = NAV_ITEMS.filter(item =>
    !item.roles || (user && item.roles.includes(user.role))
  );

  const initials = user?.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  return (
    <div className="min-h-screen flex bg-background isolate">
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
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-60" />}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary text-sm font-semibold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate capitalize">{user?.role.replace("_", " ")}</p>
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
          <div className="text-sm text-muted-foreground capitalize hidden sm:block">
            {user?.role.replace("_", " ")}
          </div>
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
