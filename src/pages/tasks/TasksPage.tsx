// src/pages/tasks/TasksPage.tsx
//
// "Urgent Tasks" — ad-hoc/one-off work items (e.g. "certificate application
// issue for client X", "lab-test problem, needs engineer follow-up") that
// aren't part of a project's fixed 45-day stage timeline. Assign to any
// engineer/ops person, they see it here and mark it done themselves.
//
// This is intentionally separate from "My Tasks" (project stage-tracker,
// src/pages/tasks/MyTasksPage.tsx) — that page tracks fixed project stages;
// this page tracks free-form urgent items anyone can raise.

import { useEffect, useState } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import {
  fetchTasks,
  transitionTask,
  type TaskResponse,
  type TaskStatus,
} from "../../services/taskService";
import CreateTaskModal from "../../components/tasks/CreateTaskModal";
import { useAuth } from "../../context/AuthContext";
import { getRoleFromToken, decodeJwt } from "../../utils/jwt";
import { useToast } from "../../context/ToastContext";

const STATUS_STYLES: Record<TaskStatus, string> = {
  OPEN: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  DONE: "bg-green-100 text-green-700",
  BLOCKED: "bg-red-100 text-red-700",
};

export default function TasksPage() {
  const { addToast } = useToast();
  const showToast = (message: string, type: "success" | "error" = "success") =>
    addToast({ title: type === "error" ? "Error" : "Success", message, type });

  const { token } = useAuth();
  // Update anyone's task: Admin, or "Team overview" with Edit.
  const perms = usePermissions();
  const isAdmin = getRoleFromToken(token) === "ADMIN" || perms.can("TEAM_OVERVIEW", "EDIT");
  const myEmail = decodeJwt(token)?.sub ?? "";

  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadTasks = async () => {
    try {
      const res = await fetchTasks({ page: 0, size: 100 });
      setTasks(res.content);
    } catch (err) {
      console.error(err);
      showToast("Could not load tasks.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleTransition = async (task: TaskResponse, target: TaskStatus) => {
    setBusyId(task.id);
    try {
      await transitionTask(task.id, target);
      await loadTasks();
      showToast(`"${task.taskName}" moved to ${target.replace("_", " ")}`);
    } catch (err: any) {
      // Backend now enforces: only the assigned engineer or an ADMIN can
      // transition a task — anyone else gets a 403 with this message.
      showToast(
        err?.response?.data?.message ?? "Could not update this task.",
        "error"
      );
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="p-6">Loading Urgent Tasks...</div>;
  }

  // Start / Mark Done / Blocked / Resume — the same buttons on the phone
  // cards and the laptop table. `big` = full-width thumb-sized buttons.
  const taskActions = (task: (typeof tasks)[number], big = false) => {
    const canAct = isAdmin || task.assignedToEmail === myEmail;
    const btn = big
      ? "w-full flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
      : "px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50";
    if (!canAct) {
      return (
        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          🔒 Only {task.assignedToEmail?.split("@")[0]} (or Admin) can update this
        </span>
      );
    }
    if (task.status === "OPEN") {
      return (
        <button
          disabled={busyId === task.id}
          onClick={() => handleTransition(task, "IN_PROGRESS")}
          className={`${btn} text-white bg-blue-600 hover:bg-blue-700`}
        >
          {busyId === task.id ? "Saving…" : "Start"}
        </button>
      );
    }
    if (task.status === "IN_PROGRESS") {
      return (
        <div className="flex gap-2">
          <button
            disabled={busyId === task.id}
            onClick={() => handleTransition(task, "DONE")}
            className={`${btn} text-white bg-green-600 hover:bg-green-700`}
          >
            {busyId === task.id ? "Saving…" : "Mark Done"}
          </button>
          <button
            disabled={busyId === task.id}
            onClick={() => handleTransition(task, "BLOCKED")}
            className={`${btn} text-red-700 bg-red-50 hover:bg-red-100`}
          >
            Blocked
          </button>
        </div>
      );
    }
    if (task.status === "BLOCKED") {
      return (
        <button
          disabled={busyId === task.id}
          onClick={() => handleTransition(task, "IN_PROGRESS")}
          className={`${btn} text-white bg-blue-600 hover:bg-blue-700`}
        >
          {busyId === task.id ? "Saving…" : "Resume"}
        </button>
      );
    }
    return <span className="text-green-600 font-semibold text-xs">✓ Completed</span>;
  };

  return (
    <div className="p-0 lg:p-6">
      <div className="mb-4 lg:mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Urgent Tasks</h1>
          <p className="text-gray-500">
            One-off / ad-hoc work items — client issues, lab-test follow-ups, anything
            outside a project's fixed stage timeline. Assign to anyone, they close it out here.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
        >
          + New Task
        </button>
      </div>

      <CreateTaskModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={loadTasks}
      />

      {/* Phone / tablet: one card per task. The table is for laptops. */}
      <div className="lg:hidden space-y-2.5">
        {tasks.length === 0 && (
          <p className="rounded-lg border bg-white p-6 text-center text-gray-400">No urgent tasks right now. 🎉</p>
        )}
        {tasks.map((task) => (
          <div key={task.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-gray-900 break-words">{task.taskName}</span>
              <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[task.status]}`}>
                {task.status.replace("_", " ")}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>👤 {task.assignedToEmail}</span>
              <span>📅 Due {task.dueDate ?? "—"}</span>
            </div>
            <div className="mt-3">{taskActions(task, true)}</div>
          </div>
        ))}
      </div>

      <div className="hidden lg:block overflow-x-auto rounded-lg border bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-100">
              <th className="p-3 text-left">Task Name</th>
              <th className="p-3 text-left">Assigned To</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Due Date</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>

          <tbody>
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  No urgent tasks right now. 🎉
                </td>
              </tr>
            )}

            {tasks.map((task) => (
              <tr key={task.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{task.taskName}</td>
                <td className="p-3 text-gray-600">{task.assignedToEmail}</td>
                <td className="p-3">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_STYLES[task.status]}`}
                  >
                    {task.status.replace("_", " ")}
                  </span>
                </td>
                <td className="p-3">{task.dueDate ?? "—"}</td>
                <td className="p-3">{taskActions(task)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}