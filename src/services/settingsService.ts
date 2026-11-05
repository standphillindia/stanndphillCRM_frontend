// src/services/settingsService.ts
//
// The CRM's own switches — features the team can turn on and off without
// a deploy.
//
// Reading is open to any signed-in user because pages have to know what
// to draw; only an Admin can change anything.

import api from "../api/axios";

export interface AccessLockSetting {
  enabled: boolean;
  updatedByEmail: string | null;
  updatedAt: string | null;
  /** How many locks switching it off just released. 0 on a plain read. */
  releasedLocks: number;
}

/** Is the late-work access lock currently switched on? */
export const fetchAccessLockSetting = async (): Promise<AccessLockSetting> => {
  const res = await api.get<AccessLockSetting>("/settings/access-lock");
  return res.data;
};

/** Admin only. Returns the setting as it stands after the change. */
export const setAccessLockSetting = async (enabled: boolean): Promise<AccessLockSetting> => {
  const res = await api.put<AccessLockSetting>("/admin/settings/access-lock", { enabled });
  return res.data;
};

// ── Lead PI/TI lock — its own switch, separate from the project stage lock ──

/** Is the lead PI/TI lock currently switched on? */
export const fetchLeadFinanceLockSetting = async (): Promise<AccessLockSetting> => {
  const res = await api.get<AccessLockSetting>("/settings/lead-finance-lock");
  return res.data;
};

/** Admin only. Returns the setting as it stands after the change. */
export const setLeadFinanceLockSetting = async (enabled: boolean): Promise<AccessLockSetting> => {
  const res = await api.put<AccessLockSetting>("/admin/settings/lead-finance-lock", { enabled });
  return res.data;
};