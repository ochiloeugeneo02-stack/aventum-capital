import { type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { RegionProvider } from "@/contexts/RegionContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import Groups from "@/pages/Groups";
import GroupDetail from "@/pages/GroupDetail";
import Contributions from "@/pages/Contributions";
import Payouts from "@/pages/Payouts";
import Settings from "@/pages/Settings";
import AdminGroup from "@/pages/AdminGroup";
import Organization from "@/pages/Organization";
import SuperAdmin from "@/pages/SuperAdmin";
import StaffPortal from "@/pages/StaffPortal";
import InviteAccept from "@/pages/InviteAccept";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import SetupTwoFactor from "@/pages/SetupTwoFactor";
import Support from "@/pages/Support";
import Security from "@/pages/Security";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401 || error?.response?.status === 403) return false;
        return failureCount < 2;
      },
    },
  },
});

function PageWrapper({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <div key={location} className="page-enter">
      {children}
    </div>
  );
}

function Router() {
  return (
    <PageWrapper>
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/invite/:token" component={InviteAccept} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/setup-2fa">
        <ProtectedRoute>
          <SetupTwoFactor />
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute memberOnly>
          <Dashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/groups">
        <ProtectedRoute memberOnly>
          <Groups />
        </ProtectedRoute>
      </Route>

      <Route path="/groups/:id">
        <ProtectedRoute memberOnly>
          <GroupDetail />
        </ProtectedRoute>
      </Route>

      <Route path="/contributions">
        <ProtectedRoute memberOnly>
          <Contributions />
        </ProtectedRoute>
      </Route>

      <Route path="/payouts">
        <ProtectedRoute memberOnly>
          <Payouts />
        </ProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute memberOnly>
          <Settings />
        </ProtectedRoute>
      </Route>

      <Route path="/support">
        <ProtectedRoute memberOnly>
          <Support />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/group">
        <ProtectedRoute roles={["group_admin"]} memberOnly>
          <AdminGroup />
        </ProtectedRoute>
      </Route>

      <Route path="/org">
        <ProtectedRoute roles={["org_admin"]} memberOnly>
          <Organization />
        </ProtectedRoute>
      </Route>

      <Route path="/admin">
        <ProtectedRoute roles={["super_admin"]}>
          <SuperAdmin />
        </ProtectedRoute>
      </Route>

      <Route path="/security" component={Security} />

      {/* Dedicated staff portal — handles its own auth state */}
      <Route path="/staff" component={StaffPortal} />

      <Route component={NotFound} />
    </Switch>
    </PageWrapper>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RegionProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </RegionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
