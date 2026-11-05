import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

console.log(import.meta.env.VITE_API_BASE_URL);

// ── Friendly error normalization ────────────────────────────────────
// Problem this solves: ~100 places across the app do things like
//   setError(err instanceof Error ? err.message : "Failed to load leads")
// or
//   setError(err?.response?.data?.message ?? err.message ?? "...")
// Axios errors are always `instanceof Error` and always have a `.message`
// (Axios's own generated text, e.g. "Request failed with status code 404"
// or "Network Error"), so in practice those calls ALWAYS show Axios's raw
// technical string to the user — the friendly hardcoded fallback strings
// are dead code, and the backend's own carefully-written ApiErrorResponse
// message often never gets read at all.
//
// Rather than rewrite every one of those call sites, we normalize the
// error ONCE, here, for every request the app makes: after this runs,
// `error.message` itself is always a message safe to show a non-technical
// user. Existing (and future) `err.message` / `err instanceof Error`
// code across the app is fixed automatically, with zero per-page changes.
//
// The original technical detail is preserved on `error.technicalMessage`
// and logged to the console, so nothing is lost for debugging — open
// DevTools Console to see the real cause; the UI only ever shows the
// friendly version.
const STATUS_MESSAGES: Record<number, string> = {
  400: "That request couldn't be processed. Please check the details and try again.",
  401: "Your session has expired. Please log in again.",
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for. It may have been moved or deleted.",
  405: "That action isn't supported here.",
  409: "This conflicts with existing data — please refresh the page and try again.",
  413: "That file is too large to upload.",
  422: "Some of the details provided aren't valid. Please check and try again.",
  429: "Too many requests — please wait a moment and try again.",
};

// Who has to act on an error — so the screen can say it plainly, instead
// of one vague "contact support" for everything:
//   NETWORK - the server couldn't be reached (internet, or server starting);
//   SESSION - login expired;
//   ACCESS  - the user's role isn't allowed to do this (ask the admin);
//   USER    - something in what was entered, or a record that's gone;
//   SYSTEM  - a problem in the CRM itself (code / server / database).
//             Comes with an error code (e.g. E-7K3P9Q) to send to the tech
//             team; the same code is in the server log with the details.
export type ApiErrorKind = "NETWORK" | "SESSION" | "ACCESS" | "USER" | "SYSTEM";

const NETWORK_MESSAGE =
  "Can't reach the CRM server. Please check your internet connection. " +
  "If your internet is working, the server may be restarting — wait a minute and try again. " +
  "If it still doesn't work, inform the tech team.";

const SYSTEM_SUFFIX = " This is a problem in the CRM, not something you did.";

// Old backend builds sent this for every 500 — not useful to anyone.
const OLD_GENERIC_500 = "An unexpected error occurred";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const errorKindFor = (error: any): ApiErrorKind => {
  if (!error?.response) return "NETWORK";
  const status: number = error.response.status;
  const source: unknown = error.response.data?.source;
  if (source === "SYSTEM") return "SYSTEM";
  if (status === 401) return "SESSION";
  if (status === 403) return "ACCESS";
  if (source === "USER") return "USER";
  return status >= 500 ? "SYSTEM" : "USER";
};

// A short time stamp so a code-less SYSTEM error can still be matched to
// the server log (e.g. "500 at 30-Oct 14:32").
const whenNow = () =>
  new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

const friendlyMessageFor = (error: any): string => {
  const kind = errorKindFor(error);

  // No response at all — request never reached the server (backend down,
  // restarting, CORS block, DNS/timeout, offline). Never show the
  // browser's raw "Network Error" string.
  if (kind === "NETWORK") return NETWORK_MESSAGE;

  const status: number = error.response.status;
  const rawMessage: unknown = error.response.data?.message;
  const backendMessage = typeof rawMessage === "string" ? rawMessage.trim() : "";
  const errorId: unknown = error.response.data?.errorId;

  if (kind === "SYSTEM") {
    // New backend: the message already says "not something you did" and
    // carries the error code — show it as it is.
    if (typeof errorId === "string" && errorId) return backendMessage || `Something went wrong inside the CRM.${SYSTEM_SUFFIX} Please send this error code to the tech team: ${errorId}`;
    // Older backend / no code: say whose problem it is, and give the
    // status + time so the developer can find it in the server log.
    const what =
      backendMessage && !backendMessage.startsWith(OLD_GENERIC_500)
        ? backendMessage.replace(/[.\s]*$/, ".")
        : "Something went wrong inside the CRM.";
    return `${what}${SYSTEM_SUFFIX} Please inform the tech team (error ${status} at ${whenNow()}).`;
  }

  if (kind === "ACCESS") {
    return (backendMessage || "You don't have permission to do that.") +
      " If you need this access, ask your admin.";
  }

  // USER / SESSION: the backend's own message says exactly what to fix.
  if (backendMessage) return backendMessage;
  return STATUS_MESSAGES[status] ?? "That couldn't be done. Please check the details and try again.";
};

export const normalizeError = (error: any) => {
  // Already done (e.g. a request retried after a token refresh).
  if (error && typeof error === "object" && error.errorKind) return error;

  const friendly = friendlyMessageFor(error);

  // Keep the original for developers — visible in the console, never in the UI.
  if (error && typeof error === "object") {
    error.errorKind = errorKindFor(error);
    error.errorId = error.response?.data?.errorId;
    if (error.message !== friendly) {
      error.technicalMessage = error.message;
      console.warn(
        `[API error] ${error.errorKind}${error.errorId ? " " + error.errorId : ""}:`,
        error.technicalMessage,
        error.config ? `${(error.config.method || "").toUpperCase()} ${error.config.url}` : "",
        error.response?.data ?? error
      );
      error.message = friendly;
    }
  }
  return error;
};

// ── REQUEST interceptor ───────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Login Time report: tells the backend whether the CRM tab is on
    // screen right now ("active") or just open in the background.
    if (typeof document !== "undefined") {
      config.headers["X-CRM-Visible"] = document.visibilityState === "visible" ? "1" : "0";
    }
    return config;
  },
  (error) => Promise.reject(normalizeError(error))
);

// ── RESPONSE interceptor ─────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (
      (error.response?.status === 401 || error.response?.status === 403) &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(normalizeError(err)));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("refreshToken");

      if (!refreshToken) {
        localStorage.clear();
        isRefreshing = false;
        window.location.href = "/login";
        return Promise.reject(normalizeError(error));
      }

      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
          { refreshToken }
        );

        const newAccessToken = data.accessToken;
        localStorage.setItem("accessToken", newAccessToken);

        api.defaults.headers.common["Authorization"] = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);
        isRefreshing = false;
        return api(originalRequest);

      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.clear();
        isRefreshing = false;
        // Login session over (9 hours) — the login page says so.
        window.location.href = "/login?expired=1";
        return Promise.reject(normalizeError(refreshError));
      }
    }

    return Promise.reject(normalizeError(error));
  }
);

export default api;