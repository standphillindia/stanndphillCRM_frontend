// src/pages/users/components/UserProfileDrawer.tsx
// Slide-over panel showing a user's full profile — opened by clicking a table row.

import { useEffect, useState } from "react";
import {
  fetchUserActivity,
  fetchUserAssignedCounts,
  type UserResponse,
  type UserActivityEntry,
  type UserAssignedCounts,
} from "../../../services/userService";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  ENGINEER: "Engineer",
  SALES: "Sales",
  SUPPORT: "Support",
};

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:   "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  INACTIVE: "bg-error/10 text-error border-error/20",
  INVITED:  "bg-surface-container-highest/60 text-secondary border-outline-variant/30",
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("");
}

interface UserProfileDrawerProps {
  user: UserResponse;
  onClose: () => void;
  onEdit: (user: UserResponse) => void;
}

export default function UserProfileDrawer({ user, onClose, onEdit }: UserProfileDrawerProps) {
  const [activity, setActivity] = useState<UserActivityEntry[]>([]);
  const [counts, setCounts]     = useState<UserAssignedCounts | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchUserActivity(user.id), fetchUserAssignedCounts(user.id)])
      .then(([a, c]) => {
        if (cancelled) return;
        setActivity(a);
        setCounts(c);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [user.id]);

  const joined = new Date(user.createdAt).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
  const lastLogin = user.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Never";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-card h-full w-full max-w-md bg-surface-container-lowest shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant/10 flex items-start justify-between">
          <h2 className="text-headline-md font-semibold text-on-surface">User Profile</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container-high text-secondary transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Identity block */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/15 text-primary flex items-center justify-center text-headline-md font-bold shrink-0">
              {initials(user.fullName)}
            </div>
            <div className="min-w-0">
              <p className="text-body-lg font-semibold text-on-surface truncate">{user.fullName}</p>
              <p className="text-body-sm text-secondary truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-tight border bg-primary/10 text-primary border-primary/20">
                  {ROLE_LABEL[user.role] ?? user.role}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-tight border ${STATUS_STYLE[user.status]}`}>
                  {user.status}
                </span>
              </div>
            </div>
          </div>

          {/* Contact + meta grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-surface-container-low rounded-lg">
              <p className="text-label-caps text-outline uppercase mb-1">Phone</p>
              <p className="text-body-md text-on-surface">{user.phone || "—"}</p>
            </div>
            <div className="p-3 bg-surface-container-low rounded-lg">
              <p className="text-label-caps text-outline uppercase mb-1">Team</p>
              <p className="text-body-md text-on-surface">{user.team || "—"}</p>
            </div>
            <div className="p-3 bg-surface-container-low rounded-lg">
              <p className="text-label-caps text-outline uppercase mb-1">Joined</p>
              <p className="text-body-md text-on-surface">{joined}</p>
            </div>
            <div className="p-3 bg-surface-container-low rounded-lg">
              <p className="text-label-caps text-outline uppercase mb-1">Last Login</p>
              <p className="text-body-md text-on-surface">{lastLogin}</p>
            </div>
          </div>

          {/* Assigned counts */}
          <div>
            <p className="text-label-caps text-outline uppercase mb-2">Assigned</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Leads",    value: counts?.leads },
                { label: "Deals",    value: counts?.deals },
                { label: "Projects", value: counts?.projects },
              ].map((s) => (
                <div key={s.label} className="glass-card rounded-lg p-3 text-center">
                  <p className="text-headline-md font-bold text-primary">
                    {loading ? "—" : s.value}
                  </p>
                  <p className="text-body-sm text-secondary mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Activity log */}
          <div>
            <p className="text-label-caps text-outline uppercase mb-2">Recent Activity</p>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-secondary-fixed/40 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <p className="text-body-sm text-secondary">No activity yet.</p>
            ) : (
              <div className="space-y-1">
                {activity.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 py-2 border-b border-outline-variant/10 last:border-0">
                    <span className="material-symbols-outlined text-[16px] text-outline mt-0.5">history</span>
                    <div className="min-w-0">
                      <p className="text-body-sm text-on-surface">
                        {a.action}
                        {a.target !== "—" && <span className="text-secondary"> — {a.target}</span>}
                      </p>
                      <p className="text-[11px] text-outline mt-0.5">
                        {new Date(a.timestamp).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => onEdit(user)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary
                rounded-lg text-body-md font-semibold hover:opacity-90 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              Edit User
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant
                text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}