export const USER_ROLES = [
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "ENGINEER", label: "Engineer" },
  { value: "SALES", label: "Sales" },
  { value: "SUPPORT", label: "Support" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "FINANCE", label: "Finance" },
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
  { value: "Management", label: "Management" },
  { value: "Finance", label: "Finance" },
  { value: "Marketing", label: "Marketing" },
  { value: "Operations", label: "Operations" },
  { value: "Finance Team", label: "Finance Team" },
] as const;

// Must match department names that already exist in the backend
// (departmentRepository.findByName lookup fails otherwise).
export const USER_DEPARTMENTS = [
  { value: "Operations", label: "Operations" },
  { value: "Finance", label: "Finance" },
  { value: "AMC", label: "AMC" },
  { value: "Sales", label: "Sales" },
  { value: "Management", label: "Management" },
] as const;

export type UserDepartment = (typeof USER_DEPARTMENTS)[number]["value"];