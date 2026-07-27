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

// Must match team names that already exist in the backend `teams` table
// (teamRepository.findByName lookup fails otherwise).
export const USER_TEAMS = [
  { value: "AMC", label: "AMC" },
  { value: "Engineer", label: "Engineer" },
  { value: "Finance", label: "Finance" },
  { value: "Operations", label: "Operations" },
  { value: "Sales", label: "Sales" },
] as const;

// Must match department names that already exist in the backend
// (departmentRepository.findByName lookup fails otherwise).
export const USER_DEPARTMENTS = [
  { value: "AMC", label: "AMC" },
  { value: "Engineer", label: "Engineer" },
  { value: "Finance", label: "Finance" },
  { value: "Operations", label: "Operations" },
  { value: "Sales", label: "Sales" },
] as const;

export type UserDepartment = (typeof USER_DEPARTMENTS)[number]["value"];