// src/components/AdminRoute.tsx
//
// Wraps ProtectedRoute for pages that must be Admin-only (currently just
// /admin — Admin Panel). ProtectedRoute already handles "not logged in"
// → /login; this adds "logged in but not ADMIN" → /dashboard, with a
// toast so it doesn't look like the page silently vanished.
//
// Note: this is a UI convenience, not the real security boundary — the
// actual admin-only backend endpoints are gated server-side with
// @PreAuthorize("hasRole('ADMIN')"), which is what actually stops a
// non-admin from reading/editing admin data even if they hit the API
// directly. This component just keeps non-admins from landing on a page
// full of buttons that would all 403 anyway.

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getRoleFromToken } from "../utils/jwt";
import { useToast } from "../context/ToastContext";
import { useEffect, useRef } from "react";

interface Props {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: Props) {
  const { token, isAuthenticated, isLoading } = useAuth();
  const { addToast } = useToast();
  const warnedRef = useRef(false);

  const isAdmin = getRoleFromToken(token) === "ADMIN";

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAdmin && !warnedRef.current) {
      warnedRef.current = true;
      addToast({ title: "Access denied", message: "This page is Admin-only.", type: "error" });
    }
  }, [isLoading, isAuthenticated, isAdmin, addToast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}