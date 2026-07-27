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

const friendlyMessageFor = (error: any): string => {
  // No response at all — request never reached the server (backend down,
  // CORS block, DNS/timeout, offline). Never show the browser's raw
  // "Network Error" string.
  if (!error?.response) {
    return "We couldn't reach the server. Please check your internet connection and try again.";
  }

  const status: number = error.response.status;
  const backendMessage: unknown = error.response.data?.message;

  // The backend's GlobalExceptionHandler already writes safe, specific,
  // human-readable messages (validation errors, business-rule messages,
  // "An unexpected error occurred..." for true 500s) — trust it when present.
  if (typeof backendMessage === "string" && backendMessage.trim().length > 0) {
    return backendMessage;
  }

  if (status >= 500) {
    return "Something went wrong on our end. Please try again, and contact support if this keeps happening.";
  }

  return STATUS_MESSAGES[status] ?? "Something went wrong. Please try again.";
};

const normalizeError = (error: any) => {
  const friendly = friendlyMessageFor(error);

  // Keep the original for developers — visible in the console, never in the UI.
  if (error && typeof error === "object" && error.message !== friendly) {
    error.technicalMessage = error.message;
    console.warn("[API error]", error.technicalMessage, error.response?.data ?? error);
    error.message = friendly;
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
        window.location.href = "/login";
        return Promise.reject(normalizeError(refreshError));
      }
    }

    return Promise.reject(normalizeError(error));
  }
);

export default api;