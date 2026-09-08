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
  const isAdmin = getRoleFromToken(token) === "ADMIN";
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

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Urgent Tasks</h1>
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

      <div className="overflow-x-auto rounded-lg border bg-white">
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

            {tasks.map((task) => {
              const canAct = isAdmin || task.assignedToEmail === myEmail;

              return (
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
                  <td className="p-3">
                    {!canAct ? (
                      <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        🔒 Only {task.assignedToEmail?.split("@")[0]} (or Admin) can update this
                      </span>
                    ) : task.status === "OPEN" ? (
                      <button
                        disabled={busyId === task.id}
                        onClick={() => handleTransition(task, "IN_PROGRESS")}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                      >
                        {busyId === task.id ? "Saving…" : "Start"}
                      </button>
                    ) : task.status === "IN_PROGRESS" ? (
                      <div className="flex gap-2">
                        <button
                          disabled={busyId === task.id}
                          onClick={() => handleTransition(task, "DONE")}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                          {busyId === task.id ? "Saving…" : "Mark Done"}
                        </button>
                        <button
                          disabled={busyId === task.id}
                          onClick={() => handleTransition(task, "BLOCKED")}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                        >
                          Blocked
                        </button>
                      </div>
                    ) : task.status === "BLOCKED" ? (
                      <button
                        disabled={busyId === task.id}
                        onClick={() => handleTransition(task, "IN_PROGRESS")}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                      >
                        {busyId === task.id ? "Saving…" : "Resume"}
                      </button>
                    ) : (
                      <span className="text-green-600 font-semibold text-xs">✓ Completed</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}