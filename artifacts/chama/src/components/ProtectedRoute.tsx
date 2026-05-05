import { useAuth } from "@/contexts/AuthContext";
import { Redirect, useLocation } from "wouter";
import { STAFF_ROLES } from "@/pages/StaffPortal";

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
    if (location === "/admin") return <Redirect to="/staff" />;
    return <Redirect to="/login" />;
  }

  const isStaff = user && STAFF_ROLES.includes(user.role);

  if (roles && user && !roles.includes(user.role)) {
    if (isStaff) return <Redirect to="/staff" />;
    return <Redirect to="/dashboard" />;
  }

  if (memberOnly && isStaff) {
    return <Redirect to="/staff" />;
  }

  return <>{children}</>;
}
