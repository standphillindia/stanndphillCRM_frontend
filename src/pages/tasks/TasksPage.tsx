import { useEffect, useState } from "react";
import {
  fetchTasks,
  type TaskResponse,
} from "../../services/taskService";
import CreateTaskModal from "../../components/tasks/CreateTaskModal";

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const loadTasks = async () => {
    try {
      const res = await fetchTasks({
        page: 0,
        size: 100,
      });

      setTasks(res.content);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);


  if (loading) {
    return <div className="p-6">Loading Tasks...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Tasks
          </h1>

          <p className="text-gray-500">
            Engineer Assigned Tasks
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
              <th className="p-3 text-left">
                Task Name
              </th>

              <th className="p-3 text-left">
                Engineer
              </th>

              <th className="p-3 text-left">
                Status
              </th>

              <th className="p-3 text-left">
                Due Date
              </th>

              <th className="p-3 text-left">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {tasks.map((task) => (
              <tr
                key={task.id}
                className="border-b"
              >
                <td className="p-3">
                  {task.taskName}
                </td>

                <td className="p-3">
                  {task.assignedToEmail}
                </td>

                <td className="p-3">
                  {task.status}
                </td>

                <td className="p-3">
                  {task.dueDate}
                </td>

                <td className="p-3">
                  {task.status === "DONE" ? (
                    <span className="text-green-600 font-semibold">
                       Completed
                    </span>
                  ) : task.status === "BLOCKED" ? (
                    <span className="text-red-600 font-semibold">
                      Overdue
                    </span>
                  ) : (
                    <span className="text-gray-400 italic text-xs">
                      Update via Project's "Move Next"
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}