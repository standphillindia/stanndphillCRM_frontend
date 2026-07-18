// src/pages/auth/LoginPage.tsx

import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/brandlogo.png.png";   // ✅


export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await loginUser({ email, password });
      localStorage.setItem("userEmail", email);
      login(data.accessToken); // updates AuthContext state right away
      navigate("/dashboard");
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { message?: string }; status?: number };
        message?: string;
      };

      if (!ax.response) {
        // No response object means the browser blocked/couldn't complete
        // the request itself — CORS preflight rejection, backend down/
        // unreachable, wrong VITE_API_BASE_URL, or DNS/timeout. This is
        // NOT a wrong-password case, so don't say "Invalid email or password".
        setError(
          "Server se connect nahi ho pa raha (network/CORS issue). Kripya thodi der baad try karein ya IT team ko batayein."
        );
      } else if (ax.response.status === 401) {
        setError("Email ya password galat hai.");
      } else if (ax.response.status === 403) {
        setError("Aapko is system tak access nahi hai. Administrator se sampark karein.");
      } else {
        setError(
          ax.response?.data?.message ?? ax.message ?? "Kuch galat ho gaya. Dubara try karein."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f7fb] px-4">

      {/* ── Soft background blobs ───────────────────────────────────── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-52 -right-52 w-[700px] h-[700px] rounded-full bg-indigo-200 opacity-30 blur-3xl" />
        <div className="absolute -bottom-52 -left-52 w-[600px] h-[600px] rounded-full bg-sky-200 opacity-25 blur-3xl" />
      </div>

      <div className="w-full max-w-[420px]">

        {/* ── Card ────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200 border border-slate-100 px-7 py-7">

          {/* Brand */}
          <div className="mb-6 text-center">
            <div className="flex justify-center mb-3">
              <img
              src={logo}
               alt="Standphill India"
               className="w-28 h-auto object-contain"
                 />
              </div>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">
              Sign in to your account
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Enter your credentials to access the dashboard.
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <svg className="flex-shrink-0 mt-0.5 text-red-500" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-700 leading-snug">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-3">

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="admin@standphill.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400
                  shadow-sm outline-none transition
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20
                  disabled:bg-slate-50 disabled:opacity-70"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                  tabIndex={-1}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-11 text-sm text-slate-900 placeholder:text-slate-400
                    shadow-sm outline-none transition
                    focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20
                    disabled:bg-slate-50 disabled:opacity-70"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPw ? (
                    /* eye-off */
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    /* eye */
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5
                text-sm font-semibold text-white shadow-sm
                hover:bg-indigo-700 active:bg-indigo-800
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-150"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-slate-400">
            Need access?{" "}
            <span className="text-indigo-600 hover:underline cursor-pointer font-medium">
              Contact your administrator
            </span>
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          © {new Date().getFullYear()} Standphill. All rights reserved.
        </p>
      </div>
    </div>
  );
}