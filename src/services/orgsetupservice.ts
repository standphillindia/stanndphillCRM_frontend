// src/services/orgSetupService.ts
//
// Fetches the REAL Department / Team / Role lists from the backend
// (backed by the `departments`, `teams`, `roles` DB tables), so dropdowns
// like "Add User" always reflect what's actually configured in the org —
// instead of a hardcoded frontend list that can drift out of sync with the
// database (e.g. showing a team that was renamed/deleted, or missing one
// that was just added).
//
// Endpoints (see OrgSetupController.java):
//   GET /api/org/setup/departments
//   GET /api/org/setup/teams
//   GET /api/org/setup/roles
//
// If any of these tables is empty, the corresponding array below will just
// be empty — callers (e.g. UsersPage.tsx) are expected to show a
// "No department found" / "No team found" state instead of a dropdown,
// rather than falling back to fake options.

import api from "../api/axios";

export interface OrgSetupOption {
  id: string;
  name: string;
}

// Backend returns the full Department/Role entities (id, name, createdAt,
// updatedAt, ...) — we only care about id + name here.
interface RawOrgEntity {
  id: string;
  name: string;
}

export const fetchDepartments = async (): Promise<OrgSetupOption[]> => {
  const res = await api.get<RawOrgEntity[]>("/org/setup/departments");
  return res.data.map((d) => ({ id: d.id, name: d.name }));
};

export const fetchTeams = async (): Promise<OrgSetupOption[]> => {
  // TeamResponse DTO already returns { id, name } directly.
  const res = await api.get<OrgSetupOption[]>("/org/setup/teams");
  return res.data;
};

export const fetchRoles = async (): Promise<OrgSetupOption[]> => {
  const res = await api.get<RawOrgEntity[]>("/org/setup/roles");
  return res.data.map((r) => ({ id: r.id, name: r.name }));
};