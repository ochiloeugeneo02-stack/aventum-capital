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
import InviteAccept from "@/pages/InviteAccept";
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

      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/groups">
        <ProtectedRoute>
          <Groups />
        </ProtectedRoute>
      </Route>

      <Route path="/groups/:id">
        <ProtectedRoute>
          <GroupDetail />
        </ProtectedRoute>
      </Route>

      <Route path="/contributions">
        <ProtectedRoute>
          <Contributions />
        </ProtectedRoute>
      </Route>

      <Route path="/payouts">
        <ProtectedRoute>
          <Payouts />
        </ProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/group">
        <ProtectedRoute roles={["group_admin", "super_admin"]}>
          <AdminGroup />
        </ProtectedRoute>
      </Route>

      <Route path="/org">
        <ProtectedRoute roles={["org_admin", "super_admin"]}>
          <Organization />
        </ProtectedRoute>
      </Route>

      <Route path="/admin">
        <ProtectedRoute roles={["super_admin"]}>
          <SuperAdmin />
        </ProtectedRoute>
      </Route>

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
