// ─── src/services/authService.ts ─────────────────────────────────────────────
//
// WHAT CHANGED FROM YOUR ORIGINAL FILE:
//   1. loginUser() now reads accessToken + refreshToken from the response
//      (old backend returned { token }, new backend returns
//       { accessToken, refreshToken, tokenType, expiresIn })
//   2. loginUser() now saves BOTH tokens to localStorage
//   3. Added logoutUser()  → calls POST /api/auth/logout (new endpoint)
//   4. Added refreshToken() → calls POST /api/auth/refresh (new endpoint)
//   5. Added getStoredUser() → reads stored user info from localStorage
//   6. Full TypeScript types added (no more `any`)
//
// WHY IT WAS NEEDED:
//   Old AuthResponse had only `token`.
//   New AuthResponse has `accessToken`, `refreshToken`, `tokenType`, `expiresIn`.
//   If you still read `response.data.token` it would be `undefined` and the
//   axios interceptor in axios.ts would send a blank Authorization header,
//   causing 401 on every subsequent request.
//
// ─────────────────────────────────────────────────────────────────────────────

import api from "../api/axios";

// ── Types matching the new backend DTOs exactly ───────────────────────────────

// Matches: LoginRequest.java  (email + password, both required)
export interface LoginRequest {
  email: string;
  password: string;
}

// Matches: AuthResponse.java record  (4 fields in the new backend)
// Old backend had only { token: string } — that type is now gone.
export interface AuthResponse {
  accessToken: string;   // JWT access token  (expires in 15 min / 900000ms)
  refreshToken: string;  // JWT refresh token (expires in 7 days)
  tokenType: string;     // always "Bearer"
  expiresIn: number;     // 900000 (ms) — access token lifetime
}

// Matches: LogoutRequest.java
export interface LogoutRequest {
  refreshToken: string;
}

// Matches: RefreshTokenRequest.java
export interface RefreshTokenRequest {
  refreshToken: string;
}

// ── localStorage keys ─────────────────────────────────────────────────────────
// Centralise the key strings so you can't typo them in different files.
// The axios.ts interceptor reads "accessToken" — keep it in sync here.
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

// ── loginUser ─────────────────────────────────────────────────────────────────
// Calls POST /api/auth/login
// On success: saves both tokens to localStorage and returns the full response.
// The axios interceptor in axios.ts will then use localStorage("accessToken")
// automatically for every subsequent request.
//
// Usage in a login form:
//   const data = await loginUser({ email, password });
//   navigate("/dashboard");
export const loginUser = async (data: LoginRequest): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>("/auth/login", data);

  const { accessToken, refreshToken } = response.data;

  // Save both tokens — axios.ts interceptor reads accessToken on every request
  // logoutUser() will send refreshToken to the backend to revoke it
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);

  return response.data;
};

// ── logoutUser ────────────────────────────────────────────────────────────────
// Calls POST /api/auth/logout (NEW endpoint — didn't exist in old backend)
// Sends the refresh token to the backend so it gets marked as revoked
// in the refresh_tokens table. Then clears localStorage.
//
// Even if the API call fails (e.g. network error), we still clear
// localStorage so the user is logged out on the frontend.
//
// Usage:
//   await logoutUser();
//   navigate("/login");
export const logoutUser = async (): Promise<void> => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  if (refreshToken) {
    try {
      // Tell the backend to revoke this refresh token
      await api.post("/auth/logout", { refreshToken } as LogoutRequest);
    } catch {
      // Ignore errors — we always clear local storage regardless
    }
  }

  // Clear all stored auth data from the browser
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem("userEmail");
};

// ── refreshAccessToken ────────────────────────────────────────────────────────
// Calls POST /api/auth/refresh (NEW endpoint — didn't exist in old backend)
// Normally you don't call this manually — the axios.ts response interceptor
// calls it automatically when it receives a 401.
// Exposed here in case you need it elsewhere (e.g. proactive refresh on mount).
//
// Returns the new AuthResponse with a fresh accessToken.
export const refreshAccessToken = async (): Promise<AuthResponse> => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  const response = await api.post<AuthResponse>("/auth/refresh", {
    refreshToken,
  } as RefreshTokenRequest);

  // Update the stored access token with the new one
  localStorage.setItem(ACCESS_TOKEN_KEY, response.data.accessToken);

  return response.data;
};

// ── isLoggedIn ────────────────────────────────────────────────────────────────
// Quick check used by ProtectedRoute (to be built later) to decide whether
// to show a page or redirect to /login.
// Does NOT validate the token with the backend — just checks it exists.
export const isLoggedIn = (): boolean => {
  return !!localStorage.getItem(ACCESS_TOKEN_KEY);
};

// ── getAccessToken ────────────────────────────────────────────────────────────
// Returns the raw access token string, or null if not logged in.
// Useful when you need the token outside of an axios call.
export const getAccessToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};