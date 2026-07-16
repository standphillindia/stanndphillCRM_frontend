// src/services/orgService.ts
//
// Small helper service for org-structure dropdowns (departments) used by
// the "Mark Lead as Won" form and anywhere else that needs to pick a
// department. Engineers are fetched via userService.fetchUsers({ role:
// "ENGINEER" }) instead — no separate endpoint needed for that, it's
// already real and working.

import api from "../api/axios";

export interface DepartmentResponse {
  id: string;
  name: string;
}

// GET /api/org/setup/departments
export const fetchDepartments = async (): Promise<DepartmentResponse[]> => {
  const res = await api.get<DepartmentResponse[]>("/org/setup/departments");
  return res.data;
};