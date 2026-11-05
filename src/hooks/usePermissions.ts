// src/hooks/usePermissions.ts
//
// What the logged-in user's role may do, straight from Users → Roles &
// Permissions (GET /api/admin/permissions/mine/actions). Pages use this
// instead of checking `role === "ADMIN"`, so Admin can give any screen to
// any role. Admin always gets everything (the backend says so).
//
// Fetched once per login and shared by every component; a change in the
// matrix shows after the user reloads the page. The backend checks the
// same permission again — hiding a button here is only for a clean screen.

import { useEffect, useState } from "react";
import api from "../api/axios";

export type PermissionAction = "READ" | "WRITE" | "EDIT" | "DELETE";

/** module → "RWED" flags, a dash for a missing tick, e.g. { LEADS_ALL: "R-E-" }. */
type ActionFlags = Record<string, string>;

const POSITION: Record<PermissionAction, number> = { READ: 0, WRITE: 1, EDIT: 2, DELETE: 3 };

let cached: Promise<ActionFlags> | null = null;
let cachedFor: string | null = null;

/** Loads (once per access token) the current role's ticks. Never rejects. */
export const loadMyPermissions = (): Promise<ActionFlags> => {
  let token: string | null;
  try {
    token = localStorage.getItem("accessToken");
  } catch {
    token = null;
  }
  if (!cached || cachedFor !== token) {
    cachedFor = token;
    cached = api
      .get<ActionFlags>("/admin/permissions/mine/actions")
      .then((r) => r.data ?? {})
      .catch(() => {
        cached = null; // try again next time
        return {};
      });
  }
  return cached;
};

export const canDo = (flags: ActionFlags | null, module: string, action: PermissionAction = "READ") => {
  const f = flags?.[module];
  return !!f && f.length === 4 && f[POSITION[action]] !== "-";
};

export function usePermissions() {
  const [flags, setFlags] = useState<ActionFlags | null>(null);

  useEffect(() => {
    let alive = true;
    loadMyPermissions().then((f) => {
      if (alive) setFlags(f);
    });
    return () => {
      alive = false;
    };
  }, []);

  return {
    /** false until the ticks have loaded */
    ready: flags !== null,
    can: (module: string, action: PermissionAction = "READ") => canDo(flags, module, action),
  };
}