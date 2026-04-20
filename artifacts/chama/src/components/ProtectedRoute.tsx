import { useAuth } from "@/contexts/AuthContext";
import { Redirect, useLocation } from "wouter";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
  memberOnly?: boolean;
}

export function ProtectedRoute({ children, roles, memberOnly }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-3 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Staff portal routes redirect to the staff login
    if (location === "/admin") return <Redirect to="/staff" />;
    return <Redirect to="/login" />;
  }

  if (roles && user && !roles.includes(user.role)) {
    // Super admins trying to hit a role-gated member route → staff portal
    if (user.role === "super_admin") return <Redirect to="/staff" />;
    return <Redirect to="/dashboard" />;
  }

  if (memberOnly && user?.role === "super_admin") {
    return <Redirect to="/staff" />;
  }

  return <>{children}</>;
}
