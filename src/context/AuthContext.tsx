import React, { createContext, useContext, useState, useEffect } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  login: (accessToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Check auth on mount (covers hard refresh / direct URL load)
    const accessToken = localStorage.getItem("accessToken");
    setToken(accessToken);
    setIsAuthenticated(!!accessToken);
    setIsLoading(false);
  }, []);

  // Call this right after a successful login so the context (and every
  // component reading it, e.g. ProtectedRoute) updates immediately —
  // without this, isAuthenticated stays stale until a full page reload,
  // which is why login worked only when the URL was retyped manually.
  const login = (accessToken: string) => {
    setToken(accessToken);
    setIsAuthenticated(true);
  };

  // Call this right after logout so ProtectedRoute stops treating the
  // user as authenticated without needing a full page reload.
  const logout = () => {
    setToken(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};