// src/utils/jwt.ts
//
// Minimal client-side JWT decode — just enough to read the "role" claim
// the backend embeds (see JwtService.claim("role", ...)). Doesn't verify
// the signature (the backend already did that); this is purely for UI
// decisions like "should this nav item / card be visible at all".

export interface DecodedToken {
  role?: string;
  sub?: string;
  type?: string;
  exp?: number;
  [key: string]: unknown;
}

export const decodeJwt = (token: string | null | undefined): DecodedToken | null => {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    // JWT uses base64url — swap the two characters that differ from
    // standard base64 before atob() can decode it.
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const getRoleFromToken = (token: string | null | undefined): string | null => {
  return decodeJwt(token)?.role ?? null;
};