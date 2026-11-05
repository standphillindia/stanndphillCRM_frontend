// src/components/projects/AssignProjectsModal.tsx
//
// Assign one or many projects to an Operations person and/or an engineer.
// Ops stages of the day-wise tracker then show in that Ops person's
// My Tasks, Engineer stages in the engineer's. Leaving a box on
// "Keep as it is" doesn't change that side.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  assignProject,
  assignProjectsBulk,
  type ProjectResponse,
} from "../../services/projectService";
import { fetchUserDirectory, type UserResponse } from "../../services/userService";
import { getApiErrorMessage } from "../../utils/apiError";

const inputCls =
  "w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";
const labelCls = "block text-xs font-medium text-gray-600 mb-1";

const isActive = (u: UserResponse) => u.status === "ACTIVE";
const inDept = (u: UserResponse, ...names: string[]) =>
  names.some((n) => (u.department ?? "").toLowerCase().startsWith(n));

interface Props {
  projects: ProjectResponse[];
  onClose: () => void;
  onAssigned: (count: number) => void;
}

export default function AssignProjectsModal({ projects, onClose, onAssigned }: Props) {
  const single = projects.length === 1 ? projects[0] : null;

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [opsEmail, setOpsEmail] = useState(single?.opsPersonEmail ?? "");
  const [engineerEmail, setEngineerEmail] = useState(single?.engineerEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserDirectory()
      .then(setUsers)
      .catch((e) => setUsersError(getApiErrorMessage(e, "Could not load users.")));
  }, []);

  const opsUsers = users.filter(
    (u) => isActive(u) && (u.role === "OPERATIONS" || inDept(u, "operation", "ops"))
  );
  const engineers = users.filter(
    (u) => isActive(u) && (u.role === "ENGINEER" || inDept(u, "engineer"))
  );

  const unchanged =
    (opsEmail || "") === (single?.opsPersonEmail ?? "") &&
    (engineerEmail || "") === (single?.engineerEmail ?? "");
  const nothingPicked = !opsEmail && !engineerEmail;

  const save = async () => {
    if (nothingPicked) return setError("Pick an Ops person or an engineer.");
    setSaving(true);
    setError(null);
    const req = {
      opsPersonEmail: opsEmail || undefined,
      engineerEmail: engineerEmail || undefined,
    };
    try {
      if (single) await assignProject(single.id, req);
      else await assignProjectsBulk(projects.map((p) => p.id), req);
      onAssigned(projects.length);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not assign. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const label = (u: UserResponse) => `${u.fullName} (${u.email})`;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {single ? "Assign project" : `Assign ${projects.length} projects`}
            </h2>
            <p className="text-sm text-gray-500">
              Their stages will show in the person's My Tasks.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
            {projects.map((p) => (
              <div key={p.id} className="truncate">• {p.projectName}</div>
            ))}
          </div>

          {usersError && <p className="text-sm text-red-600">{usersError}</p>}

          <div>
            <label className={labelCls}>Ops person (Operations team)</label>
            <select value={opsEmail} onChange={(e) => setOpsEmail(e.target.value)} className={inputCls}>
              <option value="">— Keep as it is —</option>
              {opsUsers.map((u) => (
                <option key={u.id} value={u.email}>{label(u)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Engineer</label>
            <select value={engineerEmail} onChange={(e) => setEngineerEmail(e.target.value)} className={inputCls}>
              <option value="">— Keep as it is —</option>
              {engineers.map((u) => (
                <option key={u.id} value={u.email}>{label(u)}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || nothingPicked || (single != null && unchanged)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Assign"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}