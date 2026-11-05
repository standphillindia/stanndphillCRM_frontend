// src/components/dashboard/TeamReports.tsx
//
// The other five reports: who is working what, whether follow-ups are
// actually happening, how quotations land, which sources are worth the
// money, and what the money itself looks like per service.
//
// Same scope rule as the pipeline reports — the API decides what this
// user may see, so there is no role handling here.
//
// Most of these panels carry several numbers per row, so they are plain
// tables rather than bars: a bar encodes one magnitude, and five columns
// of bars would be five charts pretending to be one. The single place a
// bar earns its keep is revenue, where each row is one number.
//
// Two panels ignore the range selector on purpose, and say so on screen:
// follow-up discipline is the state of the desk today, and the
// outstanding column in revenue is what is owed now, not what was owed
// during the window.

import { useCallback, useEffect, useState } from "react";
import api from "../../api/axios";

interface PersonPerformance {
  person: string;
  received: number;
  worked: number;
  proposals: number;
  won: number;
  lost: number;
  openLeads: number;
  quotedValue: number;
  conversionPercent: number;
}

interface FollowUpDiscipline {
  person: string;
  openLeads: number;
  newLeads: number;
  noDate: number;
  overdue: number;
  dueToday: number;
  upcoming: number;
  untouched: number;
}

interface QuotationPerformance {
  type: string;
  label: string;
  total: number;
  draft: number;
  sent: number;
  accepted: number;
  rejected: number;
  expired: number;
  awaiting: number;
  sentValue: number;
  acceptedValue: number;
  winRatePercent: number;
}

interface SourceQuality {
  source: string;
  leads: number;
  worked: number;
  proposals: number;
  won: number;
  lost: number;
  quotedValue: number;
  conversionPercent: number;
}

interface ServiceRevenue {
  service: string;
  label: string;
  received: number;
  paymentsCount: number;
  outstanding: number;
}

const RANGES: { label: string; days: number | null }[] = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "12 months", days: 365 },
  { label: "All time", days: null },
];

const BLUE = "#256abf";
const ORANGE = "#eb6834";
const ALL_TIME_FROM = "2000-01-01";

const money = (v: number) =>
  v >= 100000
    ? `₹${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L`
    : `₹${Math.round(v).toLocaleString("en-IN")}`;

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const prettyDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
};

/** Source codes as the team says them. */
const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: "Website",
  JUSTDIAL: "JustDial",
  INSTAMART: "IndiaMART",
  WHATSAPP: "WhatsApp",
  META_ADS: "Meta Ads",
  MANUAL: "Added by hand",
  REFERENCE_ABHISHEK_SIR: "Reference — Abhishek Sir",
  REFERENCE_MAYANK_SIR: "Reference — Mayank Sir",
  GOOGLE_ADS: "Google Ads",
  SOCIAL_MEDIA_ORGANIC: "Social Media Organic",
  EMAIL: "Email",
};

export default function TeamReports() {
  const [days, setDays] = useState<number | null>(90);

  const [narrow, setNarrow] = useState(
    typeof window !== "undefined" && window.matchMedia("(max-width: 620px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 620px)");
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const [people, setPeople] = useState<PersonPerformance[]>([]);
  const [discipline, setDiscipline] = useState<FollowUpDiscipline[]>([]);
  const [quotations, setQuotations] = useState<QuotationPerformance[]>([]);
  const [sources, setSources] = useState<SourceQuality[]>([]);
  const [revenue, setRevenue] = useState<ServiceRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-panel failure, so one missing endpoint doesn't blank the other
  // four with a "no data in this period" that isn't true.
  const [failed, setFailed] = useState({
    people: false, discipline: false, quotations: false,
    sources: false, revenue: false,
  });

  const from = days === null ? ALL_TIME_FROM : isoDaysAgo(days);
  const to = new Date().toISOString().slice(0, 10);
  const window_ = days === null ? "all time" : `${prettyDate(from)} – ${prettyDate(to)}`;

  const load = useCallback(async () => {
    setLoading(true);
    const params = { from, to };

    const [p, d, q, s, r] = await Promise.allSettled([
      api.get<PersonPerformance[]>("/dashboard/reports/people", { params }),
      api.get<FollowUpDiscipline[]>("/dashboard/reports/follow-up"),
      api.get<QuotationPerformance[]>("/dashboard/reports/quotations", { params }),
      api.get<SourceQuality[]>("/dashboard/reports/source-quality", { params }),
      api.get<ServiceRevenue[]>("/dashboard/reports/revenue", { params }),
    ]);

    setPeople(p.status === "fulfilled" ? p.value.data ?? [] : []);
    setDiscipline(d.status === "fulfilled" ? d.value.data ?? [] : []);
    setQuotations(q.status === "fulfilled" ? q.value.data ?? [] : []);
    setSources(s.status === "fulfilled" ? s.value.data ?? [] : []);
    setRevenue(r.status === "fulfilled" ? r.value.data ?? [] : []);
    setFailed({
      people: p.status === "rejected",
      discipline: d.status === "rejected",
      quotations: q.status === "rejected",
      sources: s.status === "rejected",
      revenue: r.status === "rejected",
    });
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const maxReceived = Math.max(1, ...revenue.map((r) => r.received));

  const disciplineTotals = discipline.reduce(
    (acc, d) => ({
      openLeads: acc.openLeads + d.openLeads,
      newLeads: acc.newLeads + d.newLeads,
      noDate: acc.noDate + d.noDate,
      overdue: acc.overdue + d.overdue,
      untouched: acc.untouched + d.untouched,
    }),
    { openLeads: 0, newLeads: 0, noDate: 0, overdue: 0, untouched: 0 }
  );

  const revenueTotal = revenue.reduce((sum, r) => sum + r.received, 0);
  const outstandingTotal = revenue.reduce((sum, r) => sum + r.outstanding, 0);

  return (
    <section style={S.section}>
      <div style={S.head}>
        <div>
          <h2 style={S.title}>Team &amp; Revenue</h2>
          <p style={S.subtitle}>
            Who is working what, how quotations land, and where the money comes from
          </p>
        </div>
        <div style={S.ranges}>
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setDays(r.days)}
              style={{ ...S.rangeBtn, ...(days === r.days ? S.rangeBtnActive : null) }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {failed.people && failed.discipline && failed.quotations
        && failed.sources && failed.revenue && (
        <div style={S.error}>
          Couldn't load these reports. The server may still be starting —
          try again in a moment.
        </div>
      )}

      <div style={S.grid}>
        {/* ── iii · Per-person performance ────────────────────────── */}
        <div style={{ ...S.panel, ...S.wide }}>
          <h3 style={S.panelTitle}>Who is closing what</h3>
          <p style={S.panelNote}>Leads received {window_}, and where they stand today</p>

          {loading ? (
            <p style={S.muted}>Loading…</p>
          ) : failed.people ? (
            <p style={S.failed}>This report didn't load.</p>
          ) : people.length === 0 ? (
            <p style={S.muted}>No leads came in during this period.</p>
          ) : (
            <div className="overflow-x-auto">
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Person</th>
                  <th style={S.thNum}>Received</th>
                  {!narrow && <th style={S.thNum}>Worked</th>}
                  <th style={S.thNum}>Quoted</th>
                  <th style={S.thNum}>Won</th>
                  <th style={S.thNum}>Lost</th>
                  {!narrow && <th style={S.thNum}>Open</th>}
                  <th style={S.thNum}>Conv.</th>
                  {!narrow && <th style={S.thNum}>Value</th>}
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.person}>
                    <td style={S.td}>{p.person}</td>
                    <td style={S.tdNum}>{p.received}</td>
                    {!narrow && <td style={S.tdNum}>{p.worked}</td>}
                    <td style={S.tdNum}>{p.proposals}</td>
                    <td style={S.tdNum}>{p.won}</td>
                    <td style={S.tdNum}>{p.lost}</td>
                    {!narrow && <td style={S.tdNum}>{p.openLeads}</td>}
                    <td style={S.tdStrong}>{p.conversionPercent}%</td>
                    {!narrow && (
                      <td style={S.tdMoney}>{p.quotedValue > 0 ? money(p.quotedValue) : "—"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
</div>
          )}
          <p style={S.footnote}>
            Counted by the date a lead came in, not the date it closed — so
            this row is "of what you were given, this is what happened".
            Worked = moved past New. Quoted = reached Proposal or beyond.
            Conversion is Won ÷ Received, so it stays low while leads are
            still open. Value is our own fee on the attached quotation —
            government and lab fees are excluded, since that money never
            reaches us.
          </p>
        </div>

        {/* ── iv · Follow-up discipline ───────────────────────────── */}
        <div style={S.panel}>
          <h3 style={S.panelTitle}>Follow-up discipline</h3>
          <p style={S.panelNote}>
            As of today, not {window_} · {disciplineTotals.openLeads} open leads
          </p>

          {loading ? (
            <p style={S.muted}>Loading…</p>
          ) : failed.discipline ? (
            <p style={S.failed}>This report didn't load.</p>
          ) : discipline.length === 0 ? (
            <p style={S.muted}>No open leads.</p>
          ) : (
            <div className="overflow-x-auto">
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Person</th>
                  <th style={S.thNum}>Open</th>
                  <th style={S.thNum}>Uncalled</th>
                  <th style={S.thNum}>No date</th>
                  <th style={S.thNum}>Overdue</th>
                  <th style={S.thNum}>Quiet</th>
                </tr>
              </thead>
              <tbody>
                {discipline.map((d) => (
                  <tr key={d.person}>
                    <td style={S.td}>{d.person}</td>
                    <td style={S.tdNum}>{d.openLeads}</td>
                    <td style={S.tdNum}>{d.newLeads}</td>
                    <td style={{ ...S.tdNum, ...(d.noDate > 0 ? S.warn : null) }}>{d.noDate}</td>
                    <td style={{ ...S.tdNum, ...(d.overdue > 0 ? S.warn : null) }}>{d.overdue}</td>
                    <td style={{ ...S.tdNum, ...(d.untouched > 0 ? S.warn : null) }}>
                      {d.untouched}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={S.tdTotal}>Total</td>
                  <td style={S.tdTotalNum}>{disciplineTotals.openLeads}</td>
                  <td style={S.tdTotalNum}>{disciplineTotals.newLeads}</td>
                  <td style={S.tdTotalNum}>{disciplineTotals.noDate}</td>
                  <td style={S.tdTotalNum}>{disciplineTotals.overdue}</td>
                  <td style={S.tdTotalNum}>{disciplineTotals.untouched}</td>
                </tr>
              </tbody>
            </table>
</div>
          )}
          <p style={S.footnote}>
            Uncalled = still New, nobody has spoken to them yet. No date =
            a lead between Contacted and PI Raised carrying no next date —
            the stages where the CRM demands one, so this is a call that
            happened with no next step set. Leads at Payment Received or
            Ready to Won are not counted: the CRM clears their date on
            purpose. Overdue = the date has passed. Quiet = nobody has
            touched it in 14 days, whatever its date says.
          </p>
        </div>

        {/* ── v · Quotation performance ───────────────────────────── */}
        <div style={S.panel}>
          <h3 style={S.panelTitle}>Quotation performance</h3>
          <p style={S.panelNote}>Quotations dated {window_}</p>

          {loading ? (
            <p style={S.muted}>Loading…</p>
          ) : failed.quotations ? (
            <p style={S.failed}>This report didn't load.</p>
          ) : quotations.length === 0 ? (
            <p style={S.muted}>No quotations were raised in this period.</p>
          ) : (
            <div className="overflow-x-auto">
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Type</th>
                  <th style={S.thNum}>Sent</th>
                  <th style={S.thNum}>Won</th>
                  <th style={S.thNum}>Waiting</th>
                  <th style={S.thNum}>Win rate</th>
                  {!narrow && <th style={S.thNum}>Won value</th>}
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q.type}>
                    <td style={S.td}>{q.label}</td>
                    <td style={S.tdNum}>{q.sent}</td>
                    <td style={S.tdNum}>{q.accepted}</td>
                    <td style={S.tdNum}>{q.awaiting}</td>
                    <td style={S.tdStrong}>
                      {q.accepted + q.rejected + q.expired > 0 ? `${q.winRatePercent}%` : "—"}
                    </td>
                    {!narrow && (
                      <td style={S.tdMoney}>
                        {q.acceptedValue > 0 ? money(q.acceptedValue) : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
</div>
          )}
          <p style={S.footnote}>
            Sent counts every quotation that left the building; drafts are
            excluded from all of it. Value is our fee only — rows ticked as
            a government or lab fee are left out. Win rate is accepted ÷ decided, where
            decided means accepted, rejected or expired — the ones still
            waiting for an answer are not counted as losses. A "—" means
            nothing has been decided yet.
          </p>
        </div>

        {/* ── vi · Source quality ─────────────────────────────────── */}
        <div style={S.panel}>
          <h3 style={S.panelTitle}>Source quality</h3>
          <p style={S.panelNote}>Leads received {window_}, by where they came from</p>

          {loading ? (
            <p style={S.muted}>Loading…</p>
          ) : failed.sources ? (
            <p style={S.failed}>This report didn't load.</p>
          ) : sources.length === 0 ? (
            <p style={S.muted}>No leads came in during this period.</p>
          ) : (
            <div className="overflow-x-auto">
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Source</th>
                  <th style={S.thNum}>Leads</th>
                  <th style={S.thNum}>Quoted</th>
                  <th style={S.thNum}>Won</th>
                  <th style={S.thNum}>Lost</th>
                  {!narrow && <th style={S.thNum}>Value</th>}
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source}>
                    <td style={S.td}>{SOURCE_LABELS[s.source] ?? s.source}</td>
                    <td style={S.tdNum}>{s.leads}</td>
                    <td style={S.tdStrong}>{s.proposals}</td>
                    <td style={S.tdNum}>{s.won}</td>
                    <td style={S.tdNum}>{s.lost}</td>
                    {!narrow && (
                      <td style={S.tdMoney}>{s.quotedValue > 0 ? money(s.quotedValue) : "—"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
</div>
          )}
          <p style={S.footnote}>
            The Leads column ranks sources by noise. The Quoted column —
            leads that reached Proposal or beyond — ranks them by what they
            are actually worth, which is the comparison worth spending
            money on.
          </p>
        </div>

        {/* ── vii · Revenue by service ────────────────────────────── */}
        <div style={{ ...S.panel, ...S.wide }}>
          <h3 style={S.panelTitle}>Revenue by service</h3>
          <p style={S.panelNote}>
            Received {window_}
            {revenueTotal > 0 ? ` · ${money(revenueTotal)} collected` : ""}
            {outstandingTotal > 0 ? ` · ${money(outstandingTotal)} still out` : ""}
          </p>

          {loading ? (
            <p style={S.muted}>Loading…</p>
          ) : failed.revenue ? (
            <p style={S.failed}>This report didn't load.</p>
          ) : revenue.length === 0 ? (
            <p style={S.muted}>No payments recorded in this period.</p>
          ) : (
            <div className="overflow-x-auto">
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Service</th>
                  <th style={S.thBar}></th>
                  <th style={S.thNum}>Received</th>
                  {!narrow && <th style={S.thNum}>Outstanding</th>}
                </tr>
              </thead>
              <tbody>
                {revenue.map((r) => (
                  <tr key={r.service}>
                    <td style={{ ...S.td, whiteSpace: "nowrap" }}>{r.label}</td>
                    <td style={S.rowBar}>
                      <div
                        title={`${r.label}: ${money(r.received)} received across ${r.paymentsCount} payments · ${money(r.outstanding)} outstanding`}
                        style={{
                          ...S.bar,
                          width: `${Math.max(2, (r.received / maxReceived) * 100)}%`,
                          background: r.received > 0 ? BLUE : "transparent",
                        }}
                      />
                    </td>
                    <td style={S.tdStrong}>{r.received > 0 ? money(r.received) : "—"}</td>
                    {!narrow && (
                      <td style={{ ...S.tdMoney, ...(r.outstanding > 0 ? S.warnMoney : null) }}>
                        {r.outstanding > 0 ? money(r.outstanding) : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
</div>
          )}
          <p style={S.footnote}>
            This is the one report that counts money that actually arrived —
            recorded payments, dated by the day they were received, not
            quotation values. Outstanding is what is owed right now,
            whatever month the invoice was raised in, so it does not move
            when you change the range above.
          </p>
        </div>
      </div>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  section: { marginBottom: "32px" },

  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "20px",
  },
  title: { margin: "0 0 8px 0", fontSize: "20px", fontWeight: 600, color: "#1c1b1b" },
  subtitle: { margin: 0, fontSize: "13px", color: "#737687" },

  ranges: { display: "flex", gap: "6px", flexWrap: "wrap" },
  rangeBtn: {
    padding: "6px 14px",
    background: "rgba(255,255,255,0.7)",
    border: "1px solid #c3c6d8",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
    color: "#1c1b1b",
  },
  rangeBtnActive: { background: "#004ccd", borderColor: "#004ccd", color: "#fff", fontWeight: 600 },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: "16px",
  },
  // The people table has nine columns — it gets the full row.
  wide: { gridColumn: "1 / -1" },

  panel: {
    background: "#fcfcfb",
    border: "1px solid #e4e5ef",
    borderRadius: "10px",
    padding: "20px",
    overflowX: "auto",
  },
  panelTitle: { margin: "0 0 4px 0", fontSize: "15px", fontWeight: 600, color: "#1c1b1b" },
  panelNote: { margin: "0 0 16px 0", fontSize: "12px", color: "#737687" },

  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#737687",
    textAlign: "left",
    padding: "0 10px 8px 0",
    borderBottom: "1px solid #e4e5ef",
    whiteSpace: "nowrap",
  },
  thNum: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#737687",
    textAlign: "right",
    padding: "0 0 8px 12px",
    borderBottom: "1px solid #e4e5ef",
    whiteSpace: "nowrap",
  },
  thBar: { borderBottom: "1px solid #e4e5ef", width: "100%" },

  td: { fontSize: "13px", color: "#1c1b1b", padding: "7px 10px 7px 0", maxWidth: "190px" },
  tdNum: {
    fontSize: "13px",
    color: "#1c1b1b",
    textAlign: "right",
    padding: "7px 0 7px 12px",
    whiteSpace: "nowrap",
  },
  tdStrong: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#1c1b1b",
    textAlign: "right",
    padding: "7px 0 7px 12px",
    whiteSpace: "nowrap",
  },
  tdMoney: {
    fontSize: "12px",
    color: "#737687",
    textAlign: "right",
    padding: "7px 0 7px 12px",
    whiteSpace: "nowrap",
  },
  tdTotal: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#737687",
    padding: "9px 10px 0 0",
    borderTop: "1px solid #e4e5ef",
  },
  tdTotalNum: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#1c1b1b",
    textAlign: "right",
    padding: "9px 0 0 12px",
    borderTop: "1px solid #e4e5ef",
    whiteSpace: "nowrap",
  },

  // A number that wants someone to do something about it.
  warn: { color: ORANGE, fontWeight: 600 },
  warnMoney: { color: ORANGE },

  rowBar: { width: "100%", padding: "7px 0 7px 12px" },
  bar: { height: "10px", borderRadius: "0 4px 4px 0", minWidth: "2px" },

  muted: { fontSize: "13px", color: "#737687", margin: "8px 0" },
  failed: { fontSize: "13px", color: "#b02a2a", margin: "8px 0" },
  footnote: { fontSize: "11px", color: "#9a9cab", margin: "14px 0 0 0", lineHeight: 1.5 },
  error: {
    background: "#fdf0f0",
    border: "1px solid #f3c9c9",
    color: "#b02a2a",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    marginBottom: "12px",
  },
};