// src/components/ErrorBoundary.tsx
//
// Catches any uncaught JavaScript error thrown while rendering the app
// (a bad prop, a null reference, a third-party library bug, etc.) and
// shows a friendly full-page fallback instead of the blank white screen
// React would otherwise leave behind. This is a *different* class of
// error from API/server errors (which src/api/axios.ts already
// normalizes into friendly messages) — this one is specifically for
// crashes in the UI's own rendering code.
//
// The real error + component stack is logged to the console for
// developers; the user only ever sees the friendly card below.

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Visible only in DevTools Console — never shown to the user.
    console.error("[UI crash]", error, info.componentStack);
  }

  handleReload = () => {
    window.location.href = "/dashboard";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f5f7fb] px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-100 p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px] text-red-600">error</span>
            </div>
            <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
            <p className="text-sm text-slate-500 mt-2">
              This page ran into a problem. Your data is safe — try going back to the dashboard,
              and contact support if this keeps happening.
            </p>
            <button
              onClick={this.handleReload}
              className="mt-6 w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}