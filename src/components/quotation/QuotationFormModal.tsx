// src/components/quotation/QuotationFormModal.tsx
//
// Create / edit form.
//
// Picking a certification type on a new quotation auto-fills the content
// blocks from the most recent quotation of that type — scope, terms,
// documents, pricing tables, payment terms. Most quotations of one type
// repeat all of that, so retyping it every time was the bulk of the work.
// The checkbox beside the type turns this off for the times a blank form
// is wanted.
//
// The client block is never copied. Carrying the last client's name onto a
// new client's quotation is the mistake the original Canva files kept
// making, and it is the one error that has already reached a client.

import { useEffect, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import {
  createQuotation,
  updateQuotation,
  isOfferNumberAvailable,
  getLatestQuotationByType,
  type CreateQuotationRequest,
  type FunctionalScopeRow,
  type PaymentTermRow,
  type QuotationDetailsResponse,
  type QuotationLineItemRequest,
} from "../../services/quotationService";
import { SIGNATORIES } from "../../config/signatories";
import LeadPicker from "./LeadPicker";
import { fetchLeadById, type LeadResponse } from "../../services/leadService";
import { fetchAMCLeadById } from "../../services/amcLeadService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (q: QuotationDetailsResponse) => void;

  /** Present when editing or when a Duplicate has just been created. */
  existing?: QuotationDetailsResponse | null;

  /** Prefills when raising a quotation straight off a lead. */
  prefill?: Partial<CreateQuotationRequest>;
}

/**
 * The only thing this list drives is the offer-number prefix —
 * SI/EPR/2026/0001 vs SI/ISI/2026/0001. It fills in no content: every
 * block on this form is typed by hand.
 *
 * Numbering is the one thing worth automating. The quotations this
 * replaces used three different styles at once (SI/EPR/2026/102,
 * EPR/2026/311, SI/FMCS/99), so nobody could tell how many had gone out.
 *
 * Held here rather than fetched from the server: it changes about once a
 * year, and a network round-trip just to populate eight options meant an
 * empty dropdown whenever the call failed. Values must match the
 * CertificationType enum on the backend.
 */
const CERTIFICATION_TYPES = [
  { value: "EPR_PLASTIC", label: "EPR — Plastic Waste" },
  { value: "EPR_BATTERY", label: "EPR — Battery Waste" },
  { value: "EPR_EWASTE",  label: "EPR — E-Waste" },
  { value: "ISI",         label: "BIS — ISI Mark" },
  { value: "CRS",         label: "BIS — CRS Registration" },
  { value: "CRS_FOREIGN", label: "BIS — CRS (Foreign Manufacturer)" },
  { value: "FMCS",        label: "BIS — FMCS (Foreign Manufacturer)" },
  { value: "WPC",         label: "WPC — ETA Certification" },
  { value: "RENEWAL",     label: "BIS — Licence Renewal" },
  { value: "AMC",         label: "BIS — AMC (Annual Maintenance)" },
  { value: "LMPC",        label: "LMPC — Legal Metrology Registration" },
  { value: "BEE",         label: "BEE — Star Labelling Registration" },
  { value: "AIFL",        label: "BIS — All India First Licence (ISI)" },
  { value: "OTHER",       label: "Other" },
];

/** One priced table inside the Commercial Scope. */
interface CommercialSection {
  title: string;
  /**
   * Priced columns. A single unnamed column is the ordinary case; naming
   * them turns the table into a side-by-side comparison, which is how the
   * multi-product BIS quotations are laid out.
   */
  columns: string[];
  rows: {
    category: string;
    description: string;
    remarks: string;
    isGovernmentFee: boolean;
    /** One amount per column, in the same order as `columns`. */
    amounts: (number | undefined)[];
    amountUsd?: number;
    /**
     * Per column: true when that cell holds text ("As per the company")
     * instead of a number. Chosen per cell, so one column can be priced
     * while the one beside it says "At actuals". Text cells are left out of
     * the total.
     */
    textCells?: boolean[];
    /** One text per column, used where textCells is true. */
    amountTexts?: string[];
  }[];
}

const blankSection = (): CommercialSection => ({
  title: "",
  columns: [""],
  rows: [{ category: "", description: "", remarks: "", isGovernmentFee: false, amounts: [0] }],
});

/** Sections -> the flat row list the API stores. */
const flattenSections = (sections: CommercialSection[]): QuotationLineItemRequest[] => {
  const out: QuotationLineItemRequest[] = [];

  sections.forEach((section, sectionIndex) => {
    // Numbered after dropping blank rows, so saved positions have no gaps.
    let rowIndex = 0;
    section.rows.forEach((row) => {
      if (!row.category.trim() && !row.description.trim()) return;
      const thisRow = rowIndex++;

      section.columns.forEach((col, ci) => {
        out.push({
          rowIndex: thisRow,
          columnIndex: ci,
          // Position in the list is the table's identity. The heading is
          // just what gets printed above it, so leaving it blank — or
          // repeating it — no longer collapses two tables into one.
          sectionIndex,
          sectionTitle: section.title.trim() || undefined,
          columnLabel: col.trim() || undefined,
          category: row.category,
          description: row.description,
          amountInr: row.textCells?.[ci] ? 0 : row.amounts[ci] ?? 0,
          amountText: row.textCells?.[ci] ? row.amountTexts?.[ci]?.trim() || undefined : undefined,
          // USD belongs to the row, not a column — only the FMCS
          // quotations price in both, and those have a single column.
          amountUsd: ci === 0 ? row.amountUsd : undefined,
          remarks: row.remarks,
          isGovernmentFee: row.isGovernmentFee,
        });
      });
    });
  });

  return out;
};

/** The flat row list -> sections, for editing and duplicating. */
const rebuildSections = (
  items: { sectionIndex?: number; rowIndex?: number; columnIndex?: number; amountText?: string;
           sectionTitle?: string; columnLabel?: string;
           category?: string; description?: string; amountInr?: number;
           amountUsd?: number; remarks?: string; isGovernmentFee?: boolean }[]
): CommercialSection[] => {
  if (!items || items.length === 0) return [];

  const order: number[] = [];
  const grouped = new Map<number, typeof items>();

  items.forEach((i) => {
    const key = i.sectionIndex ?? 0;
    if (!grouped.has(key)) {
      grouped.set(key, []);
      order.push(key);
    }
    grouped.get(key)!.push(i);
  });

  order.sort((a, b) => a - b);

  return order.map((idx) => {
    const rowsIn = grouped.get(idx)!;
    const title = rowsIn.find((r) => r.sectionTitle?.trim())?.sectionTitle?.trim() || "";


    // ── Rows ──
    // By rowIndex when saved; older rows fall back to their fee name.
    const rowKeys: string[] = [];
    const byRow = new Map<string, typeof items>();
    rowsIn.forEach((i) => {
      const key = i.rowIndex != null ? `r${i.rowIndex}` : `t:${i.category ?? ""}|${i.description ?? ""}`;
      if (!byRow.has(key)) {
        byRow.set(key, []);
        rowKeys.push(key);
      }
      byRow.get(key)!.push(i);
    });

    // ── Columns ──
    // By columnIndex when saved. Older rows have none, so each amount's
    // position within its row is used instead — the order it was typed in.
    // That keeps quotations saved before the fix showing every column,
    // including ones with no label.
    const colOf = new Map<(typeof items)[number], number>();
    let columnCount = 0;
    rowKeys.forEach((key) => {
      byRow.get(key)!.forEach((item, pos) => {
        const c = item.columnIndex != null ? item.columnIndex : pos;
        colOf.set(item, c);
        columnCount = Math.max(columnCount, c + 1);
      });
    });

    const columns: string[] = Array.from({ length: columnCount }, (_, c) => {
      const labelled = rowsIn.find((i) => colOf.get(i) === c && i.columnLabel?.trim());
      return labelled?.columnLabel?.trim() || "";
    });

    return {
      title,
      columns,
      rows: rowKeys.map((key) => {
        const group = byRow.get(key)!;
        const first = group[0];
        return {
          category: first.category ?? "",
          description: first.description ?? "",
          remarks: group.find((g) => g.remarks?.trim())?.remarks ?? "",
          isGovernmentFee: Boolean(first.isGovernmentFee),
          amounts: columns.map((_, c) => group.find((g) => colOf.get(g) === c)?.amountInr),
          textCells: columns.map(
            (_, c) => Boolean(group.find((g) => colOf.get(g) === c)?.amountText?.trim())
          ),
          amountTexts: columns.map(
            (_, c) => group.find((g) => colOf.get(g) === c)?.amountText ?? ""
          ),
          amountUsd: group.find((g) => g.amountUsd != null)?.amountUsd,
        };
      }),
    };
  });
};

const emptyForm: CreateQuotationRequest = {
  certificationType: "",
  offerNumber: "",
  offerDate: new Date().toISOString().split("T")[0],
  validUntil: "",
  clientName: "",
  clientCompany: "",
  clientEmail: "",
  clientMobile: "",
  kindAttention: "",
  introNote: "",
  introParagraph: "",
  projectDescription: "",
  functionalScope: [],
  totalTimeline: "",
  basicAspects: [],
  basicRequirements: [],
  basicRequirementsNote: "",
  sampleRequirements: [],
  sampleRemark: "",
  sampleGuidelines: [],
  workScope: [],
  terms: [],
  paymentRatio: [],
  showCurrencyColumn: false,
  closingNote: "",
  signatoryName: "",
  signatoryTitle: "",
  remarks: "",
  lineItems: [],
};

/**
 * The content blocks of an earlier quotation, in the shape the form keeps
 * them — used when the form opens with a type already chosen (AMC Leads →
 * + Quotation), the same copy the type dropdown does by hand. Client block,
 * links, number and dates are never copied.
 */
const contentOf = (src: QuotationDetailsResponse) => ({
  form: {
    introNote: src.introNote ?? "",
    introParagraph: src.introParagraph ?? "",
    projectDescription: src.projectDescription ?? "",
    totalTimeline: src.totalTimeline ?? "",
    basicAspects: src.basicAspects ?? [],
    basicRequirements: src.basicRequirements ?? [],
    basicRequirementsNote: src.basicRequirementsNote ?? "",
    sampleRequirements: src.sampleRequirements ?? [],
    sampleRemark: src.sampleRemark ?? "",
    sampleGuidelines: src.sampleGuidelines ?? [],
    workScope: src.workScope ?? [],
    terms: src.terms ?? [],
    showCurrencyColumn: src.showCurrencyColumn ?? false,
    closingNote: src.closingNote ?? "",
    signatoryName: src.signatoryName ?? "",
    signatoryTitle: src.signatoryTitle ?? "",
  },
  scope: src.functionalScope ?? [],
  payment: src.paymentRatio ?? [],
  sections: src.lineItems && src.lineItems.length > 0 ? rebuildSections(src.lineItems) : [blankSection()],
});

/** Multi-line blocks are edited as one textarea, one bullet per line. */
const toText = (list?: string[]) => (list ?? []).join("\n");
const toList = (text: string) =>
  text.split("\n").map((l) => l.trim()).filter(Boolean);

export default function QuotationFormModal({
  isOpen,
  onClose,
  onSaved,
  existing,
  prefill,
}: Props) {
  const [form, setForm] = useState<CreateQuotationRequest>(emptyForm);
  const [scope, setScope] = useState<FunctionalScopeRow[]>([]);
  const [payment, setPayment] = useState<PaymentTermRow[]>([]);
  /**
   * Commercial scope is edited as tables, not as one flat list.
   *
   * A multi-product BIS application prices each product family separately —
   * "Work chairs & General Purposes chairs", "Table desk & storage unit",
   * "Beds & Bunk beds" — and within a family two products sit side by side
   * sharing one set of fee rows. With a single flat table the only way to
   * send that was three separate quotations for one job.
   *
   * Storage stays flat (one row per cell); this shape is flattened on save
   * and rebuilt on load, so nothing about the API or the document changes
   * for quotations that only ever needed one table.
   */
  const [sections, setSections] = useState<CommercialSection[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live duplicate check on the Offer No. field. One number, one quotation.
  const [offerTaken, setOfferTaken] = useState(false);
  const [offerChecking, setOfferChecking] = useState(false);

  useEffect(() => {
    const n = form.offerNumber?.trim() ?? "";
    // Blank = auto-generated; the quotation's own number is always fine.
    if (!isOpen || !n || n === existing?.offerNumber) {
      setOfferTaken(false);
      setOfferChecking(false);
      return;
    }
    let cancelled = false;
    setOfferChecking(true);
    const t = setTimeout(async () => {
      try {
        const free = await isOfferNumberAvailable(n, existing?.id);
        if (!cancelled) setOfferTaken(!free);
      } catch {
        // A failed check shouldn't block saving — the server checks again.
        if (!cancelled) setOfferTaken(false);
      } finally {
        if (!cancelled) setOfferChecking(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.offerNumber, isOpen, existing?.id, existing?.offerNumber]);

  // Auto-fill from the last quotation of the chosen type. On by default for
  // a new quotation; never runs when editing, where the content is already
  // the quotation's own.
  const [autoFill, setAutoFill] = useState(true);
  const [autoFilling, setAutoFilling] = useState(false);
  /** Which quotation the current content came from — null if typed by hand. */
  const [autoFilledFrom, setAutoFilledFrom] = useState<{
    offerNumber: string;
    offerDate: string;
  } | null>(null);
  /** Shown when there was nothing to fill from, or the lookup failed. */
  const [autoFillNote, setAutoFillNote] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (existing) {
      setForm({
        certificationType: existing.certificationType,
        offerNumber: existing.offerNumber,
        offerDate: existing.offerDate,
        validUntil: existing.validUntil,
        leadId: existing.leadId,
        independentProjectId: existing.independentProjectId,
        amcLeadId: existing.amcLeadId,
        clientName: existing.clientName ?? "",
        clientCompany: existing.clientCompany ?? "",
        clientEmail: existing.clientEmail ?? "",
        clientMobile: existing.clientMobile ?? "",
        kindAttention: existing.kindAttention ?? "",
        introNote: existing.introNote ?? "",
        introParagraph: existing.introParagraph ?? "",
        projectDescription: existing.projectDescription ?? "",
        totalTimeline: existing.totalTimeline ?? "",
        basicAspects: existing.basicAspects ?? [],
        basicRequirements: existing.basicRequirements ?? [],
        basicRequirementsNote: existing.basicRequirementsNote ?? "",
        sampleRequirements: existing.sampleRequirements ?? [],
        sampleRemark: existing.sampleRemark ?? "",
        sampleGuidelines: existing.sampleGuidelines ?? [],
        workScope: existing.workScope ?? [],
        terms: existing.terms ?? [],
        showCurrencyColumn: existing.showCurrencyColumn ?? false,
        closingNote: existing.closingNote ?? "",
        signatoryName: existing.signatoryName ?? "",
        signatoryTitle: existing.signatoryTitle ?? "",
        remarks: existing.remarks ?? "",
      });
      setScope(existing.functionalScope ?? []);
      setPayment(existing.paymentRatio ?? []);
      setSections(rebuildSections(existing.lineItems ?? []));
    } else {
      setForm({ ...emptyForm, ...prefill });
      setScope([]);
      setPayment([]);
      setSections([blankSection()]);
    }
    setError(null);
    setAutoFill(true);
    setAutoFilling(false);
    setAutoFilledFrom(null);
    setAutoFillNote(null);
    setLeadLabel("");
  }, [isOpen, existing, prefill]);

  // Opened with a type already chosen (AMC Leads → + Quotation): fill the
  // content from the last quotation of that type, as picking it would.
  useEffect(() => {
    if (!isOpen || existing || !prefill?.certificationType) return;
    const type = prefill.certificationType;
    let cancelled = false;
    getLatestQuotationByType(type)
      .then((latest) => {
        if (cancelled) return;
        if (latest) {
          const c = contentOf(latest);
          setForm((p) => ({ ...p, ...c.form }));
          setScope(c.scope);
          setPayment(c.payment);
          setSections(c.sections);
          setAutoFilledFrom({ offerNumber: latest.offerNumber, offerDate: latest.offerDate });
        } else {
          const label = CERTIFICATION_TYPES.find((t) => t.value === type)?.label ?? "this type";
          setAutoFillNote(`No earlier ${label} quotation yet — start from blank. The next one will fill from this.`);
        }
      })
      .catch(() => {
        if (!cancelled) setAutoFillNote("Couldn't load the last quotation — fill the content by hand.");
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, existing, prefill]);

  // AMC lead this quotation belongs to — shown above the client block.
  const [amcLeadLabel, setAmcLeadLabel] = useState("");
  useEffect(() => {
    if (!isOpen || !form.amcLeadId) return;
    let cancelled = false;
    fetchAMCLeadById(form.amcLeadId)
      .then((l) => {
        if (!cancelled) setAmcLeadLabel([l.companyName, l.contactName].filter(Boolean).join(" · "));
      })
      .catch(() => {
        if (!cancelled) setAmcLeadLabel("AMC lead attached");
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, form.amcLeadId]);

  // Name of the attached lead, for the green "linked" box. Looked up when a
  // quotation opens already linked (edit, or opened from the Leads page).
  const [leadLabel, setLeadLabel] = useState("");
  useEffect(() => {
    if (!isOpen || !form.leadId || leadLabel) return;
    let cancelled = false;
    fetchLeadById(form.leadId)
      .then((l) => {
        if (!cancelled) setLeadLabel([l.companyName, l.contactName].filter(Boolean).join(" · "));
      })
      .catch(() => {
        if (!cancelled) setLeadLabel("Lead attached");
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, form.leadId, leadLabel]);

  /**
   * Attach or detach a lead. Attaching fills any client field still blank
   * from the lead, so the same company name follows the deal to the PI.
   * Fields already typed are left alone.
   */
  const handleLeadChange = (lead: LeadResponse | null) => {
    if (!lead) {
      setForm((p) => ({ ...p, leadId: undefined }));
      setLeadLabel("");
      return;
    }
    setLeadLabel([lead.companyName, lead.contactName].filter(Boolean).join(" · "));
    setForm((p) => ({
      ...p,
      leadId: lead.id,
      clientCompany: p.clientCompany?.trim() ? p.clientCompany : lead.companyName ?? "",
      clientName: p.clientName?.trim() ? p.clientName : lead.contactName ?? "",
      kindAttention: p.kindAttention?.trim() ? p.kindAttention : lead.contactName ?? "",
      clientEmail: p.clientEmail?.trim() ? p.clientEmail : lead.email ?? "",
      clientMobile: p.clientMobile?.trim() ? p.clientMobile : lead.phone ?? "",
    }));
  };

  if (!isOpen) return null;

  const set = (k: keyof CreateQuotationRequest, v: unknown) =>
    setForm((p) => ({ ...p, [k]: v }));

  /** Replaces one commercial row in place. */
  const patchRow = (
    si: number,
    ri: number,
    fn: (row: CommercialSection["rows"][number], columnCount: number) => CommercialSection["rows"][number]
  ) =>
    setSections((p) =>
      p.map((x, i) =>
        i === si
          ? { ...x, rows: x.rows.map((r, j) => (j === ri ? fn(r, x.columns.length) : r)) }
          : x
      )
    );

  /**
   * Copies the content blocks of an earlier quotation into the form.
   *
   * Deliberately left alone: the client block, the linked lead, the offer
   * number and dates, and internal remarks. Those belong to this quotation,
   * not to the one being copied.
   */
  const applyContent = (src: QuotationDetailsResponse) => {
    setForm((p) => ({
      ...p,
      introNote: src.introNote ?? "",
      introParagraph: src.introParagraph ?? "",
      projectDescription: src.projectDescription ?? "",
      totalTimeline: src.totalTimeline ?? "",
      basicAspects: src.basicAspects ?? [],
      basicRequirements: src.basicRequirements ?? [],
      basicRequirementsNote: src.basicRequirementsNote ?? "",
      sampleRequirements: src.sampleRequirements ?? [],
      sampleRemark: src.sampleRemark ?? "",
      sampleGuidelines: src.sampleGuidelines ?? [],
      workScope: src.workScope ?? [],
      terms: src.terms ?? [],
      showCurrencyColumn: src.showCurrencyColumn ?? false,
      closingNote: src.closingNote ?? "",
      signatoryName: src.signatoryName ?? "",
      signatoryTitle: src.signatoryTitle ?? "",
    }));
    setScope(src.functionalScope ?? []);
    setPayment(src.paymentRatio ?? []);
    setSections(
      src.lineItems && src.lineItems.length > 0
        ? rebuildSections(src.lineItems)
        : [blankSection()]
    );
  };

  /** Empties every content block — the "I want it blank" path. */
  const clearContent = () => {
    setForm((p) => ({
      ...p,
      introNote: "",
      introParagraph: "",
      projectDescription: "",
      totalTimeline: "",
      basicAspects: [],
      basicRequirements: [],
      basicRequirementsNote: "",
      sampleRequirements: [],
      sampleRemark: "",
      sampleGuidelines: [],
      workScope: [],
      terms: [],
      showCurrencyColumn: false,
      closingNote: "",
      signatoryName: "",
      signatoryTitle: "",
    }));
    setScope([]);
    setPayment([]);
    setSections([blankSection()]);
  };

  /**
   * True when someone has typed content by hand. Auto-fill asks before
   * replacing that — switching the type dropdown shouldn't silently wipe
   * ten minutes of work.
   */
  const hasHandTypedContent = () => {
    if (autoFilledFrom) return false;
    const filled = (v?: string) => Boolean(v && v.trim());
    const listed = (v?: unknown[]) => Array.isArray(v) && v.length > 0;
    return (
      filled(form.introNote) ||
      filled(form.introParagraph) ||
      filled(form.projectDescription) ||
      filled(form.totalTimeline) ||
      filled(form.closingNote) ||
      listed(form.basicAspects) ||
      listed(form.basicRequirements) ||
      listed(form.sampleRequirements) ||
      listed(form.sampleGuidelines) ||
      listed(form.workScope) ||
      listed(form.terms) ||
      scope.length > 0 ||
      payment.length > 0 ||
      sections.some((sec) =>
        sec.rows.some((r) => r.category.trim() || r.description.trim())
      )
    );
  };

  const runAutoFill = async (type: string) => {
    if (!type || existing) return;

    if (
      hasHandTypedContent() &&
      !window.confirm(
        "Replace what you've typed with the content of the last quotation of this type?"
      )
    ) {
      return;
    }

    setAutoFilling(true);
    setAutoFillNote(null);
    try {
      const latest = await getLatestQuotationByType(type);
      if (latest) {
        applyContent(latest);
        setAutoFilledFrom({ offerNumber: latest.offerNumber, offerDate: latest.offerDate });
      } else {
        // Content left over from a previous auto-fill belongs to a
        // different type — clear it rather than let it pass as this one.
        if (autoFilledFrom) clearContent();
        setAutoFilledFrom(null);
        const label =
          CERTIFICATION_TYPES.find((t) => t.value === type)?.label ?? "this type";
        setAutoFillNote(
          `No earlier ${label} quotation yet — start from blank. The next one will fill from this.`
        );
      }
    } catch (err) {
      setAutoFillNote(
        err instanceof Error
          ? `Couldn't load the last quotation: ${err.message}`
          : "Couldn't load the last quotation."
      );
    } finally {
      setAutoFilling(false);
    }
  };

  const handleTypeChange = (type: string) => {
    set("certificationType", type);
    if (type === "AMC" && form.leadId) {
      // AMC quotations never sit on a sales lead.
      setForm((p) => ({ ...p, certificationType: type, leadId: undefined }));
      setLeadLabel("");
    }
    if (!existing && autoFill && type) runAutoFill(type);
  };

  const handleAutoFillToggle = (checked: boolean) => {
    setAutoFill(checked);
    setAutoFillNote(null);

    if (checked) {
      if (form.certificationType) runAutoFill(form.certificationType);
    } else if (autoFilledFrom) {
      // Unticking is the "I want it blank" switch, so the copied content
      // goes. Anything typed by hand before auto-fill ran was already
      // replaced (after asking), so nothing of the user's is lost here.
      clearContent();
      setAutoFilledFrom(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.certificationType) return setError("Pick a certification type");
    if (!form.kindAttention?.trim())
      return setError("Kind Attention is required — it's the name printed on the document");
    if (offerTaken)
      return setError(`Offer number ${form.offerNumber?.trim()} is already used. Use a different number.`);

    setSaving(true);
    setError(null);

    const payload: CreateQuotationRequest = {
      ...form,
      functionalScope: scope.filter((r) => r.stepLabel?.trim() || r.description?.trim()),
      paymentRatio: payment.filter((r) => r.label?.trim()),
      sampleRequirements: (form.sampleRequirements ?? []).filter(
        (r) => r.productName?.trim() || r.quantity?.trim()
      ),
      lineItems: flattenSections(sections),
    };

    try {
      const saved = existing
        ? await updateQuotation(existing.id, payload)
        : await createQuotation(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the quotation");
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const label = "block text-sm font-medium text-gray-700 mb-1";
  // LMPC prints as the team's letter (offer SI/LMPC/583), not the Part 1 /
  // Part 2 quotation — the form shows only the boxes that letter uses.
  const isLmpc = form.certificationType === "LMPC";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-5 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold">
            {existing ? `Edit Quotation — ${existing.offerNumber}` : "New Quotation"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/20">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* ── Identity ────────────────────────────────────────────── */}
          <section className="border-b pb-4">
            <h3 className="font-semibold text-gray-700 mb-3">Offer Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className={label}>Certification Type *</label>
                <select
                  className={input}
                  value={form.certificationType}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {CERTIFICATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {existing ? (
                  <p className="text-xs text-gray-500 mt-1">
                    Sets the offer-number prefix.
                  </p>
                ) : (
                  <label className="flex items-start gap-2 mt-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={autoFill}
                      onChange={(e) => handleAutoFillToggle(e.target.checked)}
                    />
                    <span>
                      Auto-fill from the last quotation of this type
                      <span className="block text-gray-500">
                        Untick for a blank form.
                      </span>
                    </span>
                  </label>
                )}
              </div>
              <div>
                <label className={label}>Offer No.</label>
                <input
                  className={`${input} ${offerTaken ? "border-red-500 focus:ring-red-500 bg-red-50" : ""}`}
                  value={form.offerNumber ?? ""}
                  onChange={(e) => set("offerNumber", e.target.value)}
                  placeholder="Auto-generated"
                />
                {offerTaken ? (
                  <p className="text-xs text-red-600 mt-1">
                    Already used by another quotation.
                  </p>
                ) : offerChecking ? (
                  <p className="text-xs text-gray-400 mt-1">Checking…</p>
                ) : null}
              </div>
              <div>
                <label className={label}>Offer Date</label>
                <input
                  type="date"
                  className={input}
                  value={form.offerDate ?? ""}
                  onChange={(e) => set("offerDate", e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Valid Until</label>
                <input
                  type="date"
                  className={input}
                  value={form.validUntil ?? ""}
                  onChange={(e) => set("validUntil", e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Blank = 30 days.</p>
              </div>
            </div>
          </section>

          {/* Where the content came from, and what still needs checking —
              the amounts are the likeliest thing to differ from the last
              client's quotation. */}
          {!existing && (autoFilling || autoFilledFrom || autoFillNote) && (
            <div
              className={`rounded-lg px-4 py-3 text-sm border ${
                autoFilledFrom
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-gray-50 border-gray-200 text-gray-700"
              }`}
            >
              {autoFilling && "Loading the last quotation of this type…"}
              {!autoFilling && autoFilledFrom && (
                <>
                  Filled from <strong>{autoFilledFrom.offerNumber}</strong>
                  {autoFilledFrom.offerDate &&
                    ` (${new Date(autoFilledFrom.offerDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })})`}
                  . Client details are left blank — fill those in, and check the
                  amounts before saving.
                </>
              )}
              {!autoFilling && !autoFilledFrom && autoFillNote}
            </div>
          )}

          {/* ── Client ──────────────────────────────────────────────── */}
          <section className="border-b pb-4">
            <h3 className="font-semibold text-gray-700 mb-3">Client</h3>

            {/* Linking to a lead is what shows this quotation's amount to
                Accounts on the Payments pages when they raise the PI. */}
            {form.amcLeadId && (
              <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                AMC lead: <b>{amcLeadLabel || "…"}</b>
                <span className="block text-xs text-green-700">
                  This quotation shows under that lead on the AMC Leads page.
                </span>
              </div>
            )}

            {/* Sales leads only. An AMC quotation belongs to its AMC lead and
                is never attached to a sales lead. */}
            {form.certificationType !== "AMC" && !form.amcLeadId && (
              <div className="mb-4">
                <label className={label}>Lead</label>
                <LeadPicker
                  value={form.leadId}
                  attachedLabel={leadLabel}
                  onChange={handleLeadChange}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={label}>Kind Attention *</label>
                <input
                  className={input}
                  value={form.kindAttention ?? ""}
                  onChange={(e) => set("kindAttention", e.target.value)}
                  placeholder="Mr. Sanket Mundhe"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Printed as the addressee. Check this one carefully when duplicating.
                </p>
              </div>
              <div>
                <label className={label}>Company Name</label>
                <input
                  className={input}
                  value={form.clientCompany ?? ""}
                  onChange={(e) => set("clientCompany", e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Contact Person</label>
                <input
                  className={input}
                  value={form.clientName ?? ""}
                  onChange={(e) => set("clientName", e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Email</label>
                <input
                  className={input}
                  value={form.clientEmail ?? ""}
                  onChange={(e) => set("clientEmail", e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Mobile</label>
                <input
                  className={input}
                  value={form.clientMobile ?? ""}
                  onChange={(e) => set("clientMobile", e.target.value)}
                />
              </div>
            </div>
          </section>

          {isLmpc && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <b>LMPC prints as a letter</b> (like offer SI/LMPC/583): Dear Sir → your opening paragraphs →
              documents → timeline → fees → sign-off. Only the boxes below are used — check the result with
              <b> Preview</b>.
            </div>
          )}

          {/* ── Project + intros ────────────────────────────────────── */}
          <section className="border-b pb-4">
            <h3 className="font-semibold text-gray-700 mb-3">{isLmpc ? "Letter" : "Project"}</h3>
            {!isLmpc && (
              <>
            <label className={label}>Project Name &amp; Description</label>
            <textarea
              className={input}
              rows={3}
              value={form.projectDescription ?? ""}
              onChange={(e) => set("projectDescription", e.target.value)}
            />

            <label className={`${label} mt-4`}>Introductory Note (optional, full page)</label>
            <textarea
              className={input}
              rows={4}
              value={form.introNote ?? ""}
              onChange={(e) => set("introNote", e.target.value)}
              placeholder="Leave blank to skip the covering-letter page."
            />
              </>
            )}

            <label className={`${label} ${isLmpc ? "" : "mt-4"}`}>
              {isLmpc ? "Opening paragraphs (printed after \"Greetings from Standphill India,\")" : "Intro Paragraph (optional)"}
            </label>
            <textarea
              className={input}
              rows={3}
              value={form.introParagraph ?? ""}
              onChange={(e) => set("introParagraph", e.target.value)}
              placeholder={isLmpc
                ? "We are pleased to assist you with the LMPC (Legal Metrology Packaged Commodity) Registration…"
                : "Used instead of a scope table — the WPC style."}
            />

            {isLmpc && (
              <>
                <label className={`${label} mt-4`}>Timeline</label>
                <input
                  className={input}
                  value={form.totalTimeline ?? ""}
                  onChange={(e) => set("totalTimeline", e.target.value)}
                  placeholder="The registration process will be completed within 7 working days…"
                />
              </>
            )}
          </section>

          {/* ── Functional scope ────────────────────────────────────── */}
          {!isLmpc && (
          <section className="border-b pb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-700">Functional Scope</h3>
              <button
                type="button"
                onClick={() =>
                  setScope((p) => [...p, { stepLabel: "", description: "", timeDuration: "" }])
                }
                className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                <Plus size={15} /> Add Step
              </button>
            </div>
            {scope.length === 0 && (
              <p className="text-sm text-gray-500 mb-2">
                No steps — the scope table won't appear on the document.
              </p>
            )}
            {scope.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 mb-2">
                <input
                  className={`${input} col-span-2`}
                  placeholder="Step 1"
                  value={row.stepLabel}
                  onChange={(e) =>
                    setScope((p) =>
                      p.map((r, i) => (i === idx ? { ...r, stepLabel: e.target.value } : r))
                    )
                  }
                />
                <input
                  className={`${input} col-span-6`}
                  placeholder="Documentation prior to submission"
                  value={row.description}
                  onChange={(e) =>
                    setScope((p) =>
                      p.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r))
                    )
                  }
                />
                <input
                  className={`${input} col-span-3`}
                  placeholder="5-7 Working days"
                  value={row.timeDuration}
                  onChange={(e) =>
                    setScope((p) =>
                      p.map((r, i) => (i === idx ? { ...r, timeDuration: e.target.value } : r))
                    )
                  }
                />
                <button
                  type="button"
                  className="col-span-1 text-red-600 hover:text-red-800"
                  onClick={() => setScope((p) => p.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <p className="text-xs text-gray-500 mt-1">
              Leave Time Duration blank to merge that step with the row above.
            </p>

            <label className={`${label} mt-4`}>Total Timeline</label>
            <input
              className={input}
              value={form.totalTimeline ?? ""}
              onChange={(e) => set("totalTimeline", e.target.value)}
              placeholder="30 - 40 Working days"
            />
          </section>
          )}

          {/* ── Text blocks ─────────────────────────────────────────── */}
          <section className="border-b pb-4">
            <h3 className="font-semibold text-gray-700 mb-3">Text Blocks</h3>
            <p className="text-sm text-gray-500 mb-3">
              One bullet per line. Leave a block empty and it won't appear on the document.
            </p>

            {!isLmpc && (
              <>
            <label className={label}>
              {form.certificationType === "AMC" ? "Documentation Support (Part 1 of the AMC quotation)" : "Basic Aspects"}
            </label>
            <textarea
              className={input}
              rows={4}
              value={toText(form.basicAspects)}
              onChange={(e) => set("basicAspects", toList(e.target.value))}
            />

            {/* Part 3 extras — product sample table + guidelines (BEE and
                other schemes where the product goes to a lab). Leave empty
                and Part 3 shows only the documents list, as before. */}
            <div className="mt-4 flex justify-between items-center">
              <label className={label}>Product Sample Required (optional)</label>
              <button
                type="button"
                onClick={() =>
                  set("sampleRequirements", [
                    ...(form.sampleRequirements ?? []),
                    { productName: "", quantity: "" },
                  ])
                }
                className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                <Plus size={15} /> Add Product
              </button>
            </div>
            {(form.sampleRequirements ?? []).map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 mb-2">
                <input
                  className={`${input} col-span-6`}
                  placeholder="Oil Immersed Transformers"
                  value={row.productName}
                  onChange={(e) =>
                    set(
                      "sampleRequirements",
                      (form.sampleRequirements ?? []).map((r, i) =>
                        i === idx ? { ...r, productName: e.target.value } : r
                      )
                    )
                  }
                />
                <input
                  className={`${input} col-span-5`}
                  placeholder="1 (For one model)"
                  value={row.quantity}
                  onChange={(e) =>
                    set(
                      "sampleRequirements",
                      (form.sampleRequirements ?? []).map((r, i) =>
                        i === idx ? { ...r, quantity: e.target.value } : r
                      )
                    )
                  }
                />
                <button
                  type="button"
                  className="col-span-1 text-red-600 hover:text-red-800"
                  onClick={() =>
                    set(
                      "sampleRequirements",
                      (form.sampleRequirements ?? []).filter((_, i) => i !== idx)
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {(form.sampleRequirements ?? []).length > 0 && (
              <input
                className={`${input} mt-1`}
                value={form.sampleRemark ?? ""}
                onChange={(e) => set("sampleRemark", e.target.value)}
                placeholder="Remark under the sample table (e.g. Remark: Transformers)"
              />
            )}

            <label className={`${label} mt-4`}>Product Sample Guidelines (optional)</label>
            <textarea
              className={input}
              rows={4}
              value={toText(form.sampleGuidelines)}
              onChange={(e) => set("sampleGuidelines", toList(e.target.value))}
            />
              </>
            )}

            <label className={`${label} ${isLmpc ? "" : "mt-4"}`}>
              {isLmpc ? "Documents required" : "Basic Requirements (documents)"}
            </label>
            {isLmpc && (
              <p className="text-xs text-gray-500 mb-1">
                One per line. A line ending with <b>:</b> is a heading (e.g. "Authorized Signatory Details:"),
                a line starting with <b>~</b> prints without a bullet, every other line is a bullet.
              </p>
            )}
            <textarea
              className={input}
              rows={isLmpc ? 12 : 6}
              value={toText(form.basicRequirements)}
              onChange={(e) => set("basicRequirements", toList(e.target.value))}
            />

            <label className={`${label} mt-2`}>Requirements Note</label>
            <input
              className={input}
              value={form.basicRequirementsNote ?? ""}
              onChange={(e) => set("basicRequirementsNote", e.target.value)}
              placeholder="Note: These are the basic documents list only…"
            />

            {!isLmpc && (
              <>
            <label className={`${label} mt-4`}>
              {form.certificationType === "AMC" ? "AMC Scope of Work (Part 1 of the AMC quotation)" : "Work Scope"}
            </label>
            <textarea
              className={input}
              rows={6}
              value={toText(form.workScope)}
              onChange={(e) => set("workScope", toList(e.target.value))}
            />
              </>
            )}

            <label className={`${label} mt-4`}>
              {isLmpc ? "Extra paragraphs after the fees (optional)" : "Terms & Conditions"}
            </label>
            <textarea
              className={input}
              rows={6}
              value={toText(form.terms)}
              onChange={(e) => set("terms", toList(e.target.value))}
            />

            <label className={`${label} mt-4`}>Closing Note</label>
            <textarea
              className={input}
              rows={2}
              value={form.closingNote ?? ""}
              onChange={(e) => set("closingNote", e.target.value)}
              placeholder="We hope you will find the same in order & oblige…"
            />
          </section>

          {/* ── Commercial ──────────────────────────────────────────── */}
          <section className="border-b pb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-700">{isLmpc ? "Fees" : "Commercial Scope"}</h3>
              <div className="flex items-center gap-4">
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.showCurrencyColumn ?? false}
                    onChange={(e) => set("showCurrencyColumn", e.target.checked)}
                  />
                  Show USD column
                </label>
                <button
                  type="button"
                  onClick={() => setSections((p) => [...p, blankSection()])}
                  className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                >
                  <Plus size={15} /> Add Table
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-3">
              One table per product family — add as many as the quotation needs.
              Leave the heading blank if the whole quotation is a single price list.
              {sections.length > 1 && (
                <span className="ml-1 font-medium text-indigo-700">
                  ({sections.length} tables)
                </span>
              )}
            </p>

            {sections.map((section, si) => (
              <div key={si} className="border border-gray-200 rounded-lg p-3 mb-4 bg-gray-50/60">
                <div className="flex items-center gap-2 mb-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    {si + 1}
                  </span>
                  <input
                    className={`${input} font-medium`}
                    placeholder="Table heading — e.g. Work chairs & General Purpose chairs"
                    value={section.title}
                    onChange={(e) =>
                      setSections((p) =>
                        p.map((x, i) => (i === si ? { ...x, title: e.target.value } : x))
                      )
                    }
                  />
                  {sections.length > 1 && (
                    <button
                      type="button"
                      title="Remove this table"
                      onClick={() => setSections((p) => p.filter((_, i) => i !== si))}
                      className="text-red-600 hover:text-red-800 shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Column headings. One unnamed column is the ordinary case;
                    adding more turns the table into a side-by-side price
                    comparison across products in the same family. */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-gray-600">Columns:</span>
                  {section.columns.map((col, ci) => (
                    <div key={ci} className="flex items-center gap-1">
                      <input
                        className="px-2 py-1 border border-gray-300 rounded text-xs w-44"
                        placeholder={`Column ${ci + 1} (optional)`}
                        value={col}
                        onChange={(e) =>
                          setSections((p) =>
                            p.map((x, i) =>
                              i === si
                                ? {
                                    ...x,
                                    columns: x.columns.map((c, j) =>
                                      j === ci ? e.target.value : c
                                    ),
                                  }
                                : x
                            )
                          )
                        }
                      />
                      {section.columns.length > 1 && (
                        <button
                          type="button"
                          title="Remove column"
                          onClick={() =>
                            setSections((p) =>
                              p.map((x, i) =>
                                i === si
                                  ? {
                                      ...x,
                                      columns: x.columns.filter((_, j) => j !== ci),
                                      rows: x.rows.map((r) => ({
                                        ...r,
                                        amounts: r.amounts.filter((_, j) => j !== ci),
                                        amountTexts: r.amountTexts?.filter((_, j) => j !== ci),
                                        textCells: r.textCells?.filter((_, j) => j !== ci),
                                      })),
                                    }
                                  : x
                              )
                            )
                          }
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setSections((p) =>
                        p.map((x, i) =>
                          i === si
                            ? {
                                ...x,
                                columns: [...x.columns, ""],
                                rows: x.rows.map((r) => ({
                                  ...r,
                                  amounts: [...r.amounts, 0],
                                  amountTexts: r.amountTexts ? [...r.amountTexts, ""] : undefined,
                                  textCells: r.textCells ? [...r.textCells, false] : undefined,
                                })),
                              }
                            : x
                        )
                      )
                    }
                    className="px-2 py-1 border border-indigo-300 text-indigo-700 rounded text-xs hover:bg-indigo-50"
                  >
                    + Column
                  </button>
                </div>

                {section.rows.map((row, ri) => (
                  <div key={ri} className="flex flex-wrap items-center gap-2 mb-2">
                    <input
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm w-48"
                      placeholder="BIS: Application Fee"
                      value={row.category}
                      onChange={(e) =>
                        setSections((p) =>
                          p.map((x, i) =>
                            i === si
                              ? {
                                  ...x,
                                  rows: x.rows.map((r, j) =>
                                    j === ri ? { ...r, category: e.target.value } : r
                                  ),
                                }
                              : x
                          )
                        )
                      }
                    />

                    {/* Each cell chooses ₹ or Text on its own, so one
                        column can carry a price while the next says "As per
                        the company". Text cells are left out of the total. */}
                    {section.columns.map((_, ci) => {
                      const isText = Boolean(row.textCells?.[ci]);
                      return (
                        <div key={ci} className="flex items-center">
                          <select
                            value={isText ? "text" : "amount"}
                            title="Amount or text"
                            onChange={(e) =>
                              patchRow(si, ri, (r, n) => {
                                const flags = Array.from({ length: n }, (__, k) => Boolean(r.textCells?.[k]));
                                flags[ci] = e.target.value === "text";
                                return {
                                  ...r,
                                  textCells: flags,
                                  amountTexts: r.amountTexts ?? Array.from({ length: n }, () => ""),
                                };
                              })
                            }
                            className="px-1 py-1.5 border border-r-0 border-gray-300 rounded-l text-xs bg-gray-50"
                          >
                            <option value="amount">₹</option>
                            <option value="text">Text</option>
                          </select>

                          {isText ? (
                            <input
                              type="text"
                              className="px-2 py-1.5 border border-indigo-300 rounded-r text-sm w-40 bg-indigo-50/40"
                              placeholder="As per the company"
                              value={row.amountTexts?.[ci] ?? ""}
                              onChange={(e) =>
                                patchRow(si, ri, (r, n) => ({
                                  ...r,
                                  amountTexts: Array.from({ length: n }, (__, k) =>
                                    k === ci ? e.target.value : r.amountTexts?.[k] ?? ""
                                  ),
                                }))
                              }
                            />
                          ) : (
                            <input
                              type="number"
                              className="px-2 py-1.5 border border-gray-300 rounded-r text-sm w-28 text-right"
                              placeholder="INR"
                              value={row.amounts[ci] ?? 0}
                              onChange={(e) =>
                                patchRow(si, ri, (r) => ({
                                  ...r,
                                  amounts: r.amounts.map((a, k) =>
                                    k === ci ? parseFloat(e.target.value) || 0 : a
                                  ),
                                }))
                              }
                            />
                          )}
                        </div>
                      );
                    })}

                    {form.showCurrencyColumn && (
                      <input
                        type="number"
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm w-24 text-right"
                        placeholder="USD"
                        value={row.amountUsd ?? ""}
                        onChange={(e) =>
                          setSections((p) =>
                            p.map((x, i) =>
                              i === si
                                ? {
                                    ...x,
                                    rows: x.rows.map((r, j) =>
                                      j === ri
                                        ? {
                                            ...r,
                                            amountUsd: e.target.value
                                              ? parseFloat(e.target.value)
                                              : undefined,
                                          }
                                        : r
                                    ),
                                  }
                                : x
                            )
                          )
                        }
                      />
                    )}

                    <input
                      className="px-2 py-1.5 border border-gray-300 rounded text-sm flex-1 min-w-[150px]"
                      placeholder="PAY DIRECTLY TO BIS"
                      value={row.remarks}
                      onChange={(e) =>
                        setSections((p) =>
                          p.map((x, i) =>
                            i === si
                              ? {
                                  ...x,
                                  rows: x.rows.map((r, j) =>
                                    j === ri ? { ...r, remarks: e.target.value } : r
                                  ),
                                }
                              : x
                          )
                        )
                      }
                    />

                    <label
                      className="text-xs flex items-center gap-1 shrink-0"
                      title="Government fee — excluded when this becomes a PI"
                    >
                      <input
                        type="checkbox"
                        checked={row.isGovernmentFee}
                        onChange={(e) =>
                          setSections((p) =>
                            p.map((x, i) =>
                              i === si
                                ? {
                                    ...x,
                                    rows: x.rows.map((r, j) =>
                                      j === ri
                                        ? { ...r, isGovernmentFee: e.target.checked }
                                        : r
                                    ),
                                  }
                                : x
                            )
                          )
                        }
                      />
                      Govt
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setSections((p) =>
                          p.map((x, i) =>
                            i === si
                              ? { ...x, rows: x.rows.filter((_, j) => j !== ri) }
                              : x
                          )
                        )
                      }
                      className="text-red-600 hover:text-red-800 shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setSections((p) =>
                      p.map((x, i) =>
                        i === si
                          ? {
                              ...x,
                              rows: [
                                ...x.rows,
                                {
                                  category: "",
                                  description: "",
                                  remarks: "",
                                  isGovernmentFee: false,
                                  amounts: x.columns.map(() => 0),
                                },
                              ],
                            }
                          : x
                      )
                    )
                  }
                  className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                >
                  <Plus size={14} /> Add Row
                </button>
              </div>
            ))}

            {/* Repeated at the bottom on purpose. By the time a second table
                is needed the user is well below the header button, and the
                natural place to look is next to the table they just
                finished — the same reason Add Row sits inside each table. */}
            <button
              type="button"
              onClick={() => setSections((p) => [...p, blankSection()])}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-indigo-300 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50 hover:border-indigo-400"
            >
              <Plus size={16} />
              {sections.length === 0
                ? "Add a pricing table"
                : "Add another pricing table"}
            </button>

            <p className="text-xs text-gray-500 mt-2">
              Tick <strong>Govt</strong> for fees paid straight to CPCB/BIS/the lab — those rows are
              left out when an accepted quotation is turned into a Proforma Invoice.
            </p>

            <div className="text-right font-semibold text-gray-800 mt-3">
              Total: ₹
              {flattenSections(sections)
                .reduce((sum, i) => sum + (i.amountInr || 0), 0)
                .toLocaleString("en-IN")}
            </div>
          </section>

          {isLmpc && (
            <p className="text-xs text-gray-500 -mt-2">
              LMPC fees: the table heading prints as "Fees: …"; each row prints as "Particulars: INR amount/-"
              with its Remarks below — separate Remarks with <b>|</b> to print them as bullets.
            </p>
          )}

          {/* ── Payment terms ───────────────────────────────────────── */}
          {!isLmpc && (
          <section className="border-b pb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-700">Payment Terms</h3>
              <button
                type="button"
                onClick={() => setPayment((p) => [...p, { label: "", value: "" }])}
                className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                <Plus size={15} /> Add Row
              </button>
            </div>
            {payment.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 mb-2">
                <input
                  className={`${input} col-span-5`}
                  placeholder="Advance Payment"
                  value={row.label}
                  onChange={(e) =>
                    setPayment((p) =>
                      p.map((r, i) => (i === idx ? { ...r, label: e.target.value } : r))
                    )
                  }
                />
                <input
                  className={`${input} col-span-6`}
                  placeholder="25%"
                  value={row.value}
                  onChange={(e) =>
                    setPayment((p) =>
                      p.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r))
                    )
                  }
                />
                <button
                  type="button"
                  className="col-span-1 text-red-600 hover:text-red-800"
                  onClick={() => setPayment((p) => p.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </section>
          )}

          {/* ── Signature ───────────────────────────────────────────── */}
          <section>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={label}>{isLmpc ? "Sender name (Best regards)" : "Signatory"}</label>
                {isLmpc ? (
                  // The LMPC letter is signed by whoever sends it (e.g. Tanvi),
                  // not one of the signature images.
                  <input
                    className={input}
                    value={form.signatoryName ?? ""}
                    onChange={(e) => set("signatoryName", e.target.value)}
                    placeholder="Tanvi"
                  />
                ) : (
                <select
                  className={input}
                  value={form.signatoryName ?? ""}
                  onChange={(e) => set("signatoryName", e.target.value)}
                >
                  <option value="">No signature</option>
                  {SIGNATORIES.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
                )}
              </div>
              <div>
                <label className={label}>Signatory Title</label>
                <input
                  className={input}
                  value={form.signatoryTitle ?? ""}
                  onChange={(e) => set("signatoryTitle", e.target.value)}
                  placeholder={isLmpc ? "Marketing Executive | 9958048941" : "Principal Consultant"}
                />
              </div>
            </div>

            <label className={`${label} mt-4`}>Internal Remarks (not printed)</label>
            <textarea
              className={input}
              rows={2}
              value={form.remarks ?? ""}
              onChange={(e) => set("remarks", e.target.value)}
            />
          </section>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={saving || offerTaken || offerChecking}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white py-2 rounded-lg font-medium"
            >
              {saving ? "Saving…" : existing ? "Save Changes" : "Create Quotation"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}