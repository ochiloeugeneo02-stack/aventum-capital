import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetCurrentUser, useLogoutUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  organizationId: number | null;
  phoneNumber: string | null;
  isActive: boolean;
  avatar?: string | null;
  departmentId?: number | null;
  createdAt: string;
  requiresPasswordReset?: boolean;
  securityQuestionsSet?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  setUser: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const { data, error, isLoading: queryLoading } = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      retry: false,
    },
  });

  useEffect(() => {
    if (!queryLoading) {
      if (data && !error) {
        setUser(data as unknown as User);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    }
  }, [data, error, queryLoading]);

  const logoutMutation = useLogoutUser();

  const logout = useCallback(() => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setUser(null);
        queryClient.clear();
      },
      onError: () => {
        setUser(null);
        queryClient.clear();
      },
    });
  }, [logoutMutation, queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        setUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
