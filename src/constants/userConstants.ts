// Must match role names that already exist in the backend `roles` table
// (roleRepository.findByName lookup fails otherwise — same reasoning as
// USER_DEPARTMENTS below).
export const USER_ROLES = [
  { value: "ADMIN", label: "Admin" },
  { value: "ENGINEER", label: "Engineer" },
  { value: "SALES", label: "Sales" },
  { value: "FINANCE", label: "Finance" },
  { value: "OPERATIONS", label: "Operations" },
] as const;

export type UserRole = (typeof USER_ROLES)[number]["value"];

export const USER_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "INVITED", label: "Invited" },
] as const;

export type UserStatus = (typeof USER_STATUSES)[number]["value"];

export const USER_TEAMS = [
  { value: "OpsA", label: "OpsA" },
  { value: "OpsB", label: "OpsB" },
  { value: "Sales", label: "Sales" },
  { value: "Finance", label: "Finance" },
  { value: "Management", label: "Management" },
  { value: "Engineering", label: "Engineering" },
  { value: "AMC", label: "AMC" },
] as const;

// Must match department names that already exist in the backend
// (departmentRepository.findByName lookup fails otherwise).
export const USER_DEPARTMENTS = [
  { value: "Operations", label: "Operations" },
  { value: "Engineering", label: "Engineering" },
  { value: "Finance", label: "Finance" },
  { value: "Sales", label: "Sales" },
  { value: "Management", label: "Management" },
  { value: "AMC", label: "AMC" },
] as const;

export type UserDepartment = (typeof USER_DEPARTMENTS)[number]["value"];