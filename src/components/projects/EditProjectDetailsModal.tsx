// src/components/projects/EditProjectDetailsModal.tsx
//
// Edit a project's name and client details after it was created — e.g. a
// website enquiry won as "BIS - Website Lead" before the real company name
// was known. Admin and the Operations team. Stages, payments and the team
// are not touched.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  fetchProjectDetails,
  updateProjectDetails,
  type ProjectDetails,
} from "../../services/projectService";
import { getApiErrorMessage } from "../../utils/apiError";

interface Props {
  projectId: string;
  onClose: () => void;
  onSaved: (details: ProjectDetails) => void;
}

type FormKey =
  | "projectName" | "companyName" | "contactName" | "email" | "phone"
  | "gstNumber" | "customerPanNo" | "billingAddress" | "city" | "state" | "pincode";

const FIELDS: { key: FormKey; label: string; wide?: boolean; textarea?: boolean }[] = [
  { key: "companyName", label: "Company name", wide: true },
  { key: "contactName", label: "Contact person" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email", wide: true },
  { key: "gstNumber", label: "GST number" },
  { key: "customerPanNo", label: "PAN" },
  { key: "billingAddress", label: "Address", wide: true, textarea: true },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pincode", label: "Pincode" },
];

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

/** "BIS - Website Lead" + "ABC Pvt Ltd" → "BIS - ABC Pvt Ltd". */
const suggestName = (current: string, company: string) => {
  const idx = current.indexOf(" - ");
  const prefix = idx > 0 ? current.slice(0, idx) : current.trim();
  return prefix ? `${prefix} - ${company.trim()}` : company.trim();
};

export default function EditProjectDetailsModal({ projectId, onClose, onSaved }: Props) {
  const [original, setOriginal] = useState<ProjectDetails | null>(null);
  const [form, setForm] = useState<Record<FormKey, string> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProjectDetails(projectId)
      .then((d) => {
        if (cancelled) return;
        setOriginal(d);
        setForm({
          projectName: d.projectName ?? "",
          companyName: d.companyName ?? "",
          contactName: d.contactName ?? "",
          email: d.email ?? "",
          phone: d.phone ?? "",
          gstNumber: d.gstNumber ?? "",
          customerPanNo: d.customerPanNo ?? "",
          billingAddress: d.billingAddress ?? "",
          city: d.city ?? "",
          state: d.state ?? "",
          pincode: d.pincode ?? "",
        });
      })
      .catch((e) => { if (!cancelled) setLoadError(getApiErrorMessage(e, "Could not load the project details.")); });
    return () => { cancelled = true; };
  }, [projectId]);

  const set = (key: FormKey, value: string) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    if (!form || !original) return;
    if (!form.projectName.trim()) return setError("Project name can't be empty.");
    // Send only what changed.
    const changes: Partial<Record<FormKey, string>> = {};
    (Object.keys(form) as FormKey[]).forEach((k) => {
      if (form[k].trim() !== ((original[k] as string | null) ?? "").trim()) changes[k] = form[k].trim();
    });
    if (Object.keys(changes).length === 0) return onClose();
    setSaving(true);
    setError(null);
    try {
      onSaved(await updateProjectDetails(projectId, changes));
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not save the changes. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const suggested = form && form.companyName.trim() ? suggestName(form.projectName, form.companyName) : null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Edit project details</h2>
            <p className="text-sm text-gray-500 truncate">{original?.projectName ?? "Loading…"}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {loadError && <p className="px-5 py-4 text-sm text-red-600">{loadError}</p>}
        {!form && !loadError && <p className="px-5 py-4 text-sm text-gray-400">Loading…</p>}

        {form && (
          <>
            <div className="overflow-y-auto px-5 py-4 space-y-4">
              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">Project name *</span>
                <input
                  value={form.projectName}
                  onChange={(e) => set("projectName", e.target.value)}
                  maxLength={255}
                  className={inputCls}
                />
                {suggested && suggested !== form.projectName.trim() && (
                  <button
                    type="button"
                    onClick={() => set("projectName", suggested)}
                    className="mt-1 text-xs text-blue-600 hover:underline"
                  >
                    Use “{suggested}”
                  </button>
                )}
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <label key={f.key} className={`block ${f.wide ? "sm:col-span-2" : ""}`}>
                    <span className="block text-xs font-medium text-gray-600 mb-1">{f.label}</span>
                    {f.textarea ? (
                      <textarea value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} rows={2} className={inputCls} />
                    ) : (
                      <input value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />
                    )}
                  </label>
                ))}
              </div>

              <p className="text-xs text-gray-500">
                Only the name and client details change — stages, payments, notes and the team stay as they are.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t">
              {error && <p className="mr-auto text-sm text-red-600">{error}</p>}
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}