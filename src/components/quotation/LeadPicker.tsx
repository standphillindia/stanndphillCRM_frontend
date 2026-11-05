// src/components/quotation/LeadPicker.tsx
//
// Search-and-attach control for linking a quotation to a lead.
//
// This link is what makes the quotation visible downstream: Payments →
// Leads and Payments → List both trace back through leadId to show
// Accounts what was quoted before they raise the PI. Without it a
// quotation is a standalone document nobody outside this page sees again.
//
// Attaching also copies the client details across, so the same company
// name and contact follow the deal from quotation to PI to TI instead of
// being retyped three times with three spellings.

import { useEffect, useRef, useState } from "react";
import { Search, X, Link2, ChevronDown } from "lucide-react";
import { fetchLeads, type LeadResponse } from "../../services/leadService";

interface Props {
  /** Currently attached lead id, if any. */
  value?: string;
  /** Label for the attached lead — held by the parent so it survives reopen. */
  attachedLabel?: string;
  /**
   * Fires on attach and on clear. The whole lead is passed through so the
   * form can prefill the client block from it.
   */
  onChange: (lead: LeadResponse | null) => void;
}

/** How many leads to show before the user has typed anything. */
const RECENT_COUNT = 8;

export default function LeadPicker({ value, attachedLabel, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LeadResponse[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);

  // Click-away close. Without it the list stays open over the fields below
  // and swallows clicks meant for them.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Debounced so typing a company name doesn't fire a request per keystroke.
  // An empty query loads the most recent leads rather than showing nothing —
  // most quotations are raised off a lead someone just spoke to, so the
  // right one is usually already at the top.
  useEffect(() => {
    if (!open) return;

    const q = query.trim();
    const timer = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        // The backend scopes this by role — a salesperson searches their
        // own leads, an admin searches all of them.
        const page = await fetchLeads({
          search: q.length >= 2 ? q : undefined,
          page: 0,
          size: RECENT_COUNT,
          sortBy: "createdAt",
          sortDir: "desc",
        });
        setResults(page.content);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load leads");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, q.length >= 2 ? 300 : 0);

    return () => clearTimeout(timer);
  }, [query, open]);

  const attach = (lead: LeadResponse) => {
    onChange(lead);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Link2 size={16} className="text-green-700 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-green-900 truncate">
              {attachedLabel || "Lead attached"}
            </div>
            <div className="text-xs text-green-700">
              Accounts will see this quotation on the Payments pages.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-green-700 hover:text-green-900 shrink-0"
          title="Detach"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-3 text-gray-400" />
        <input
          // Chrome was overlaying its own saved-addresses dropdown on top of
          // this field — the company-name placeholder makes it look like an
          // address line. A random name plus these attributes is what
          // actually suppresses it; autoComplete="off" alone does not.
          name={`lead-search-${Math.random().toString(36).slice(2, 8)}`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Search or pick a lead…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setOpen(true);
            setQuery(e.target.value);
          }}
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="absolute right-2 top-2 p-1 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {searching && (
            <div className="px-3 py-3 text-xs text-gray-500">Loading…</div>
          )}

          {error && <div className="px-3 py-3 text-xs text-red-600">{error}</div>}

          {!searching && !error && results.length === 0 && (
            <div className="px-3 py-3 text-xs text-gray-500">
              {query.trim().length >= 2
                ? "No lead matched. You can still raise the quotation without one."
                : "No leads available."}
            </div>
          )}

          {!searching &&
            results.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => attach(lead)}
                className="w-full text-left px-3 py-2 hover:bg-indigo-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="text-sm font-medium text-gray-900 truncate">
                  {lead.companyName || lead.contactName || "—"}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {lead.contactName && lead.companyName ? `${lead.contactName} · ` : ""}
                  {lead.status?.replace(/_/g, " ")}
                  {lead.product ? ` · ${lead.product}` : ""}
                </div>
              </button>
            ))}

          {query.trim().length < 2 && results.length > 0 && (
            <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
              Showing the most recent leads — type to search further back.
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-1.5">
        Optional, but attaching one is what puts this quotation in front of
        Accounts when they raise the PI.
      </p>
    </div>
  );
}