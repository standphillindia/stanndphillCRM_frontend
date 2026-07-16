// src/hooks/useToastNotification.ts
// ✅ Toast notification hook - FIXED VERSION
// Easy-to-use hook for showing toast notifications

import { useMemo } from "react";
import { useToast } from "../context/ToastContext";

export function useToastNotification() {
  const { addToast } = useToast();

  // Memoized so the returned object keeps a STABLE reference across renders
  // (as long as `addToast` itself doesn't change, which it doesn't — it's
  // already wrapped in useCallback in ToastContext). Without this, every
  // render produced a brand-new object here, which fed into
  // NotificationBell's pollNotifications useCallback → useEffect dependency
  // chain, causing an infinite render → poll → setState → render loop.
  return useMemo(
    () => ({
      success: (title: string, message: string, duration?: number) =>
        addToast({
          title,
          message,
          type: "success",
          duration: duration,
        }),

      error: (title: string, message: string, duration?: number) =>
        addToast({
          title,
          message,
          type: "error",
          duration: duration,
        }),

      warning: (title: string, message: string, duration?: number) =>
        addToast({
          title,
          message,
          type: "warning",
          duration: duration,
        }),

      info: (title: string, message: string, duration?: number) =>
        addToast({
          title,
          message,
          type: "info",
          duration: duration,
        }),
    }),
    [addToast]
  );
}