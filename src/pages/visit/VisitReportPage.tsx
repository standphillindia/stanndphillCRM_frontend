// src/pages/visit/VisitReportPage.tsx
//
// Opens right after the engineer logs the factory visit (photo uploaded),
// before the visit expense:
//   Step 1 — Basic Information Form. Nothing is mandatory for now.
//   Step 2 — BIS document checklist: every document Yes / No / Not applicable.
//            Admin is notified; the "No" documents blink red for Admin.
// After step 2 the engineer goes to /visit-expenses?project=<id>.
// Admin and the engineer can come back to it later to update it.

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, MapPin, Plus, Trash2 } from "lucide-react";
import {
  CHECKLIST_STATUS_LABEL,
  emptyPackaging,
  emptyQcPerson,
  getVisitReport,
  parseBasicInfo,
  saveVisitBasicInfo,
  saveVisitChecklist,
  type BasicInfo,
  type ChecklistStatus,
  type VisitReport,
} from "../../services/visitReportService";
import { useToast } from "../../context/ToastContext";
import { getApiErrorMessage } from "../../utils/apiError";

type Answer = { status: ChecklistStatus | null; remark: string };

const STATUS_STYLE: Record<ChecklistStatus, string> = {
  YES: "bg-green-600 text-white border-green-600",
  NO: "bg-red-600 text-white border-red-600",
  NA: "bg-gray-600 text-white border-gray-600",
};

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border p-4 sm:p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {children}
    </section>
  );
}

export default function VisitReportPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const toast = (message: string, type: "success" | "error" | "warning" = "success") =>
    addToast({ title: type === "error" ? "Error" : type === "warning" ? "Check" : "Saved", message, type });

  const [report, setReport] = useState<VisitReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Step 1 = basic information, step 2 = document checklist.
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);

  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [remarks, setRemarks] = useState("");
  const [factoryRep, setFactoryRep] = useState("");
  const [standphillRep, setStandphillRep] = useState("");
  const [showMissing, setShowMissing] = useState(false);

  const [info, setInfo] = useState<BasicInfo>(() => parseBasicInfo(null));
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    getVisitReport(projectId)
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        const a: Record<number, Answer> = {};
        r.checklist.forEach((row) => { a[row.no] = { status: row.status, remark: row.remark ?? "" }; });
        setAnswers(a);
        setRemarks(r.checklistRemarks ?? "");
        setFactoryRep(r.factoryRepName ?? r.contactName ?? "");
        setStandphillRep(r.standphillRepName ?? "");
        setInfo(parseBasicInfo(r));
        // Basic info already done but the checklist not yet → open the checklist.
        if (r.basicInfoSubmittedAt && !r.checklistSubmittedAt) setStep(2);
      })
      .catch((e) => { if (!cancelled) setLoadError(getApiErrorMessage(e, "Could not load the visit checklist.")); });
    return () => { cancelled = true; };
  }, [projectId]);

  const sections = useMemo(() => {
    const map = new Map<string, VisitReport["checklist"]>();
    report?.checklist.forEach((row) => {
      const list = map.get(row.section) ?? [];
      list.push(row);
      map.set(row.section, list);
    });
    return Array.from(map.entries());
  }, [report]);

  const total = report?.checklist.length ?? 0;
  const answered = Object.values(answers).filter((a) => a.status).length;
  const counts = useMemo(() => {
    const c = { YES: 0, NO: 0, NA: 0 };
    Object.values(answers).forEach((a) => { if (a.status) c[a.status]++; });
    return c;
  }, [answers]);

  const setStatus = (no: number, status: ChecklistStatus) =>
    setAnswers((prev) => ({ ...prev, [no]: { remark: prev[no]?.remark ?? "", status } }));
  const setRemark = (no: number, remark: string) =>
    setAnswers((prev) => ({ ...prev, [no]: { status: prev[no]?.status ?? null, remark } }));
  const markRemaining = (status: ChecklistStatus) =>
    setAnswers((prev) => {
      const next = { ...prev };
      report?.checklist.forEach((row) => {
        if (!next[row.no]?.status) next[row.no] = { remark: next[row.no]?.remark ?? "", status };
      });
      return next;
    });

  const submitChecklist = async () => {
    if (!projectId || !report) return;
    if (answered < total) {
      setShowMissing(true);
      toast(`Mark all ${total} documents — ${total - answered} still not marked (Yes, No or N.A.).`, "warning");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveVisitChecklist(projectId, {
        items: report.checklist.map((row) => ({
          no: row.no,
          status: answers[row.no].status as ChecklistStatus,
          remark: answers[row.no].remark.trim(),
        })),
        remarks: remarks.trim(),
        factoryRepName: factoryRep.trim(),
        standphillRepName: standphillRep.trim(),
      });
      setReport(saved);
      toast(
        saved.checklistNo > 0
          ? `Checklist saved — ${saved.checklistNo} document(s) marked "No". Admin has been informed. Now fill this visit's expense.`
          : "Checklist saved — Admin has been informed. Now fill this visit's expense."
      );
      navigate(`/visit-expenses?project=${projectId}`);
    } catch (e) {
      toast(getApiErrorMessage(e, "Could not save the checklist. Please try again."), "error");
    } finally {
      setSaving(false);
    }
  };

  const submitBasicInfo = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const saved = await saveVisitBasicInfo(projectId, info);
      setReport(saved);
      toast("Basic information saved. Now fill the document checklist.");
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast(getApiErrorMessage(e, "Could not save the form. Please try again."), "error");
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof BasicInfo>(key: K, value: BasicInfo[K]) =>
    setInfo((prev) => ({ ...prev, [key]: value }));

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast("Location is not available on this device.", "error");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInfo((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast("Could not get the location — allow location access, or type it in.", "error");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  if (loadError) {
    return (
      <div className="p-6">
        <p className="text-red-600 text-sm">{loadError}</p>
        <Link to="/my-tasks" className="text-sm text-blue-600 hover:underline">Back to My Tasks</Link>
      </div>
    );
  }
  if (!report) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-start gap-3">
        <Link to={`/projects/${projectId}/stages`} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Back">
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Factory Visit — Documents & Basic Information</h1>
          <p className="text-sm text-gray-500 truncate">{report.projectName ?? report.companyName}</p>
        </div>
      </div>

      {/* Steps — a 3-part progress bar on a phone, labelled chips on wider screens. */}
      <div className="sm:hidden">
        <div className="flex gap-1.5">
          {[1, 2, 3].map((n) => {
            const done = (n === 1 && !!report.basicInfoSubmittedAt) || (n === 2 && !!report.checklistSubmittedAt);
            return (
              <div
                key={n}
                className={`h-1.5 flex-1 rounded-full ${step === n ? "bg-blue-600" : done ? "bg-green-600" : "bg-gray-200"}`}
              />
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-gray-500">
          <span className={step === 1 ? "text-blue-700" : ""}>{report.basicInfoSubmittedAt ? "✓ " : ""}Basic info</span>
          <span className={step === 2 ? "text-blue-700" : ""}>{report.checklistSubmittedAt ? "✓ " : ""}Checklist</span>
          <span>Expense</span>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-2 text-sm">
        {[
          { n: 1, label: "Basic information", done: !!report.basicInfoSubmittedAt },
          { n: 2, label: "Document checklist", done: !!report.checklistSubmittedAt },
          { n: 3, label: "Visit expense", done: false },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            {i > 0 && <span className="w-6 h-px bg-gray-300" />}
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                step === s.n ? "border-blue-600 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 text-gray-500"
              }`}
            >
              {s.done ? <CheckCircle2 size={14} className="text-green-600" /> : <span>{s.n}</span>}
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {step === 2 && (
        <>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Tick every document you checked at the factory — <b>Yes</b> (available), <b>No</b> (not available)
            or <b>N.A.</b> (not needed for this product). Admin is informed of the documents marked No.
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-700">
              Marked <b>{answered}</b> / {total}
            </span>
            <span className="px-2 py-0.5 rounded bg-green-100 text-green-800">Yes {counts.YES}</span>
            <span className="px-2 py-0.5 rounded bg-red-100 text-red-800">No {counts.NO}</span>
            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">N.A. {counts.NA}</span>
            {answered < total && (
              <span className="ml-auto flex gap-2">
                <button onClick={() => markRemaining("YES")} className="px-2 py-1 rounded border text-xs hover:bg-gray-50">
                  Mark remaining Yes
                </button>
                <button onClick={() => markRemaining("NA")} className="px-2 py-1 rounded border text-xs hover:bg-gray-50">
                  Mark remaining N.A.
                </button>
              </span>
            )}
          </div>

          {sections.map(([section, rows]) => (
            <Section key={section} title={section}>
              <ul className="divide-y">
                {rows.map((row) => {
                  const a = answers[row.no] ?? { status: null, remark: "" };
                  const missing = showMissing && !a.status;
                  return (
                    <li
                      key={row.no}
                      className={`py-3 sm:py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center ${
                        missing || a.status === "NO" ? "bg-red-50 -mx-2 px-2 rounded" : ""
                      }`}
                    >
                      <span className="flex-1 min-w-0 text-sm text-gray-800">
                        <span className="text-gray-400 mr-1.5">{row.no}.</span>
                        {row.document}
                        {missing && <span className="ml-2 text-xs text-red-600">Not marked</span>}
                      </span>
                      {/* Big thumb-sized buttons on a phone, compact on a laptop. */}
                      <div className="flex gap-1.5 sm:gap-1 shrink-0" role="radiogroup" aria-label={row.document}>
                        {(["YES", "NO", "NA"] as ChecklistStatus[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            role="radio"
                            aria-checked={a.status === st}
                            onClick={() => setStatus(row.no, st)}
                            className={`flex-1 sm:flex-none px-3 py-2.5 sm:py-1 rounded-lg sm:rounded-md border text-sm sm:text-xs font-semibold sm:font-medium ${
                              a.status === st ? STATUS_STYLE[st] : "border-gray-300 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {CHECKLIST_STATUS_LABEL[st]}
                          </button>
                        ))}
                      </div>
                      <input
                        value={a.remark}
                        onChange={(e) => setRemark(row.no, e.target.value)}
                        maxLength={300}
                        placeholder="Remark (optional)"
                        className="sm:w-48 px-3 py-2 sm:px-2 sm:py-1 rounded-lg sm:rounded border border-gray-300 text-sm sm:text-xs outline-none focus:border-blue-500"
                      />
                    </li>
                  );
                })}
              </ul>
            </Section>
          ))}

          <Section title="Remarks & signatures">
            <Field label="Remarks">
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} maxLength={2000} className={inputCls} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Factory representative name">
                <input value={factoryRep} onChange={(e) => setFactoryRep(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Standphill representative name">
                <input
                  value={standphillRep}
                  onChange={(e) => setStandphillRep(e.target.value)}
                  placeholder="Your name (filled in if left empty)"
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          {/* Always in reach on a phone: pinned above the bottom menu. */}
          <div className="sticky bottom-[calc(52px+env(safe-area-inset-bottom))] lg:bottom-0 z-10 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-white/95 backdrop-blur border-t sm:border-0 sm:bg-transparent sm:static sm:pb-6 flex justify-between gap-2">
            <button onClick={() => setStep(1)} className="px-3 sm:px-4 py-2 rounded-lg text-sm border bg-white hover:bg-gray-50">
              <span className="sm:hidden">Back</span>
              <span className="hidden sm:inline">Back to basic information</span>
            </button>
            <button
              onClick={submitChecklist}
              disabled={saving}
              className="flex-1 sm:flex-none px-5 py-3 sm:py-2 rounded-lg text-sm font-semibold sm:font-medium text-white bg-green-600 sm:bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Submit checklist & go to expense"}
            </button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Basic Information Form for the BIS application. No field is mandatory — fill what you collected at the
            factory and submit. You can update it later.
          </div>

          <Section title="Company & product">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name of the company">
                <input value={info.companyName} onChange={(e) => set("companyName", e.target.value)} className={inputCls} />
              </Field>
              <Field label="IS No. & name of the product">
                <input value={info.productIsNo} onChange={(e) => set("productIsNo", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Factory address">
                <textarea value={info.factoryAddress} onChange={(e) => set("factoryAddress", e.target.value)} rows={2} className={inputCls} />
              </Field>
              <Field label="Office address">
                <textarea value={info.officeAddress} onChange={(e) => set("officeAddress", e.target.value)} rows={2} className={inputCls} />
              </Field>
              <Field label="Email ID & contact no.">
                <input value={info.emailContact} onChange={(e) => set("emailContact", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Weekly off">
                <input value={info.weeklyOff} onChange={(e) => set("weeklyOff", e.target.value)} placeholder="e.g. Sunday" className={inputCls} />
              </Field>
              <Field label="Brand name">
                <input value={info.brandName} onChange={(e) => set("brandName", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Brand registered?">
                <div className="flex gap-2">
                  {(["YES", "NO"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set("brandRegistered", info.brandRegistered === v ? "" : v)}
                      className={`px-4 py-2 rounded-lg border text-sm ${
                        info.brandRegistered === v ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {v === "YES" ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </Section>

          <Section title="Client confirmation for scope">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Scope as per IS">
                <textarea value={info.scopeAsPerIs} onChange={(e) => set("scopeAsPerIs", e.target.value)} rows={3} className={inputCls} />
              </Field>
              <Field label="Scope requested by client">
                <textarea value={info.scopeRequested} onChange={(e) => set("scopeRequested", e.target.value)} rows={3} className={inputCls} />
              </Field>
            </div>
          </Section>

          <Section title="Top management">
            {info.topManagement.map((p, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-4">
                {(["name", "designation", "contact", "email"] as const).map((k) => (
                  <input
                    key={k}
                    value={p[k]}
                    onChange={(e) =>
                      set("topManagement", info.topManagement.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)))
                    }
                    placeholder={{ name: "Name", designation: "Designation", contact: "Contact number", email: "Mail ID" }[k]}
                    inputMode={k === "contact" ? "tel" : k === "email" ? "email" : undefined}
                    className={inputCls}
                  />
                ))}
              </div>
            ))}
          </Section>

          <Section title="Quality control person(s)">
            {info.qcPersons.map((p, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 grid gap-2 sm:grid-cols-3">
                  {(["name", "qualification", "designation", "experience", "contact", "email"] as const).map((k) => (
                    <input
                      key={k}
                      value={p[k]}
                      onChange={(e) =>
                        set("qcPersons", info.qcPersons.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)))
                      }
                      placeholder={{
                        name: "Name", qualification: "Qualification", designation: "Designation",
                        experience: "Experience", contact: "Contact number", email: "Mail ID",
                      }[k]}
                      inputMode={k === "contact" ? "tel" : k === "email" ? "email" : undefined}
                      className={inputCls}
                    />
                  ))}
                </div>
                {info.qcPersons.length > 1 && (
                  <button
                    onClick={() => set("qcPersons", info.qcPersons.filter((_, j) => j !== i))}
                    className="p-2 rounded hover:bg-red-50 text-red-600"
                    aria-label="Remove QC person"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => set("qcPersons", [...info.qcPersons, emptyQcPerson()])}
              className="flex items-center gap-1 text-sm text-blue-700 hover:underline"
            >
              <Plus size={14} /> Add QC person
            </button>
          </Section>

          <Section title="Authorised signatory">
            <div className="grid gap-2 sm:grid-cols-4">
              {(["name", "designation", "contact", "email"] as const).map((k) => (
                <input
                  key={k}
                  value={info.signatory[k]}
                  onChange={(e) => set("signatory", { ...info.signatory, [k]: e.target.value })}
                  placeholder={{ name: "Name", designation: "Designation", contact: "Contact number", email: "Mail ID" }[k]}
                    inputMode={k === "contact" ? "tel" : k === "email" ? "email" : undefined}
                  className={inputCls}
                />
              ))}
            </div>
          </Section>

          <Section title="Factory location">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
              <Field label="Latitude">
                <input value={info.latitude} onChange={(e) => set("latitude", e.target.value)} inputMode="decimal" className={inputCls} />
              </Field>
              <Field label="Longitude">
                <input value={info.longitude} onChange={(e) => set("longitude", e.target.value)} inputMode="decimal" className={inputCls} />
              </Field>
              <button
                onClick={useMyLocation}
                disabled={locating}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <MapPin size={15} /> {locating ? "Locating…" : "Use my current location"}
              </button>
            </div>
          </Section>

          <Section title="Packaging & marking">
            {info.packaging.map((p, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 grid gap-2 sm:grid-cols-5">
                  {(["material", "description", "quantity", "marking", "batchCode"] as const).map((k) => (
                    <input
                      key={k}
                      value={p[k]}
                      onChange={(e) =>
                        set("packaging", info.packaging.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)))
                      }
                      placeholder={{
                        material: "Packing material", description: "Description on pack",
                        quantity: "Qty per package", marking: "Method of marking", batchCode: "Batch / code / serial no.",
                      }[k]}
                      className={inputCls}
                    />
                  ))}
                </div>
                {info.packaging.length > 1 && (
                  <button
                    onClick={() => set("packaging", info.packaging.filter((_, j) => j !== i))}
                    className="p-2 rounded hover:bg-red-50 text-red-600"
                    aria-label="Remove packaging row"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => set("packaging", [...info.packaging, emptyPackaging()])}
              className="flex items-center gap-1 text-sm text-blue-700 hover:underline"
            >
              <Plus size={14} /> Add packaging row
            </button>
          </Section>

          <Section title="Production">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Total installed capacity (per month)">
                <input value={info.installedCapacity} onChange={(e) => set("installedCapacity", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Quantity produced last year">
                <input value={info.producedLastYear} onChange={(e) => set("producedLastYear", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Value of quantity produced last year (INR)">
                <input value={info.valueLastYear} onChange={(e) => set("valueLastYear", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Cost per unit (INR)">
                <input value={info.costPerUnit} onChange={(e) => set("costPerUnit", e.target.value)} className={inputCls} />
              </Field>
            </div>
          </Section>

          <div className="sticky bottom-[calc(52px+env(safe-area-inset-bottom))] lg:bottom-0 z-10 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-white/95 backdrop-blur border-t sm:border-0 sm:bg-transparent sm:static sm:pb-6 flex justify-end gap-2">
            {report.basicInfoSubmittedAt && (
              <button onClick={() => setStep(2)} className="px-3 sm:px-4 py-2 rounded-lg text-sm border bg-white hover:bg-gray-50">
                <span className="sm:hidden">Skip</span>
                <span className="hidden sm:inline">Skip to document checklist</span>
              </button>
            )}
            <button
              onClick={submitBasicInfo}
              disabled={saving}
              className="flex-1 sm:flex-none px-5 py-3 sm:py-2 rounded-lg text-sm font-semibold sm:font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Submit & continue to checklist"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}