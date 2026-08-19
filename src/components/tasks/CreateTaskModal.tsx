import { useEffect, useRef, useState } from "react";
import { X, Search } from "lucide-react";
import { createTask } from "../../services/taskService";
import { fetchProjects, type ProjectResponse } from "../../services/projectService";
import { fetchUsers, type UserResponse } from "../../services/userService";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateTaskModalProps) {
  // ── Project search (type-ahead) ──────────────────────────────
  const [projectQuery, setProjectQuery] = useState("");
  const [projectResults, setProjectResults] = useState<ProjectResponse[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectResponse | null>(null);
  const [searchingProjects, setSearchingProjects] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Assigned-to dropdown ──────────────────────────────────────
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [assignedToEmail, setAssignedToEmail] = useState("");

  // ── Rest of the form ──────────────────────────────────────────
  const [taskName, setTaskName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load assignable users (Engineer + Operations — the people who'd
  // actually go check a client's project/profile issue) once, on open.
  useEffect(() => {
    if (!isOpen) return;
    fetchUsers()
      .then((all) =>
        setUsers(
          all.filter(
            (u) =>
              (u.role === "ENGINEER" || u.role === "OPERATIONS") &&
              u.status === "ACTIVE"
          )
        )
      )
      .catch(() => setUsers([]));
  }, [isOpen]);

  // Debounced project search — searches by project name (client/company
  // name is usually part of it). Only fires once 2+ characters are typed.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (projectQuery.trim().length < 2) {
      setProjectResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearchingProjects(true);
      try {
        const res = await fetchProjects({ search: projectQuery.trim(), size: 8 });
        setProjectResults(res.content);
      } catch {
        setProjectResults([]);
      } finally {
        setSearchingProjects(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [projectQuery]);

  const resetForm = () => {
    setProjectQuery("");
    setProjectResults([]);
    setSelectedProject(null);
    setAssignedToEmail("");
    setTaskName("");
    setDueDate("");
    setRemarks("");
    setError(null);
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProject) {
      setError("Please search and select the client's project first");
      return;
    }
    if (!taskName.trim()) {
      setError("Task name is required");
      return;
    }
    if (!assignedToEmail) {
      setError("Please select who this task should be assigned to");
      return;
    }
    if (!dueDate) {
      setError("Please set a due date");
      return;
    }

    setLoading(true);
    try {
      await createTask({
        taskName: taskName.trim(),
        dueDate,
        remarks: remarks.trim(),
        projectId: selectedProject.id,
        assignedToEmail,
      });

      resetForm();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create task";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="border-b border-slate-200 px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Create Task</h2>
            <p className="text-xs text-slate-500 mt-1">
              e.g. client called about an issue with their profile — assign
              someone to check it
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Project search */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Client / Project <span className="text-red-500">*</span>
            </label>

            {selectedProject ? (
              <div className="flex items-center justify-between px-3 py-2 border border-slate-300 rounded bg-slate-50 text-sm">
                <div>
                  <div className="font-medium text-slate-900">
                    {selectedProject.projectName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {selectedProject.certificationType}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProject(null);
                    setProjectQuery("");
                  }}
                  disabled={loading}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={projectQuery}
                  onChange={(e) => setProjectQuery(e.target.value)}
                  disabled={loading}
                  placeholder="Search by company / project name…"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />

                {(projectResults.length > 0 || searchingProjects) && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded shadow-lg max-h-48 overflow-y-auto">
                    {searchingProjects ? (
                      <div className="px-3 py-2 text-sm text-slate-400">
                        Searching…
                      </div>
                    ) : (
                      projectResults.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => {
                            setSelectedProject(p);
                            setProjectResults([]);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                        >
                          <div className="font-medium text-slate-900">
                            {p.projectName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {p.certificationType} ·{" "}
                            {p.currentStageDisplayName ?? p.stage}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Task name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Task Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              disabled={loading}
              placeholder="e.g. Check profile issue raised by client"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            />
          </div>

          {/* Assigned to */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Assign To <span className="text-red-500">*</span>
            </label>
            <select
              value={assignedToEmail}
              onChange={(e) => setAssignedToEmail(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            >
              <option value="">Select engineer / operations…</option>
              {users.map((u) => (
                <option key={u.id} value={u.email}>
                  {u.fullName} ({u.role}) — {u.email}
                </option>
              ))}
            </select>
          </div>

          {/* Due date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Due Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              min={today}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Remarks / Client Details
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={loading}
              rows={3}
              placeholder="What did the client say? Any details the assignee needs…"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 resize-none"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 rounded text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-blue-400"
            >
              {loading ? "Creating…" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}