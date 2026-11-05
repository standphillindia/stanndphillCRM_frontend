// src/components/dashboard/PipelineReports.tsx
//
// Two reports the dashboard counters could never answer: where the pipeline
// stalls, and why deals are lost.
//
// Both read from /api/dashboard/reports/*, which scopes itself — an admin
// sees the whole book, anyone else sees their own leads — so there is no
// role handling here.
//
// No chart library. Each row is a labelled bar: the length carries the
// count, the number is printed beside it, and the money sits on the right.
// A single hue per panel, because bar length already encodes magnitude —
// varying colour would imply a second meaning that isn't there.
//
// The two panels count on DIFFERENT dates, and that is deliberate:
//   • the pipeline counts leads by the date they came in (created_at)
//   • the loss panel counts leads by the date they were closed (lost_at)
// A lead that arrived in June and was lost last week belongs in this
// week's losses but not in this week's intake. That made the numbers look
// contradictory, so each panel now prints the exact window and the date it
// counts on, right under its title.

import { useCallback, useEffect, useState } from "react";
import api from "../../api/axios";

interface FunnelStage {
  stage: string;
  label: string;
  leadCount: number;
  quotedValue: number;
}

interface StageDuration {
  stage: string;
  label: string;
  movedOn: number;
  avgDays: number;
  longestDays: number;
  stillHere: number;
  waitingDays: number;
}

interface LostReason {
  reason: string;
  leadCount: number;
  quotedValue: number;
  sharePercent: number;
}

/**
 * Stages in pipeline order. Lost is an exit, not a stage — it has its own
 * panel. FOLLOW_UP is in here because it is where most of the book sits;
 * leaving it out dropped those leads from the funnel entirely.
 */
const PIPELINE = [
  "NEW", "CONTACTED", "FOLLOW_UP", "QUALIFIED", "PROPOSAL",
  "NEGOTIATION", "PI_RAISED", "PAYMENT_RECEIVED", "READY_TO_WON", "WON",
];

/**
 * days = null means all time. With only a few months of history in the
 * CRM, "90 days" and "12 months" can differ for reasons that look like a
 * bug — All time is the range that answers "is anything being hidden?".
 */
const RANGES: { label: string; days: number | null }[] = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "12 months", days: 365 },
  { label: "All time", days: null },
];

const BLUE = "#256abf";   // validated against the light chart surface
const ORANGE = "#eb6834";

/** Far enough back to mean "everything", without a second API shape. */
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

export default function PipelineReports() {
  const [days, setDays] = useState<number | null>(90);

  // On a phone the money column is what overflows — long reason names plus
  // a count, a share and a rupee figure don't fit in 420px. The figure is
  // the least urgent of the four and stays in the bar's tooltip.
  const [narrow, setNarrow] = useState(
    typeof window !== "undefined" && window.matchMedia("(max-width: 620px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 620px)");
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [lost, setLost] = useState<LostReason[]>([]);
  const [durations, setDurations] = useState<StageDuration[]>([]);
  const [loading, setLoading] = useState(true);

  // Which panels failed, by name. One report going down must not take the
  // others with it: before this, a single 404 rejected the whole
  // Promise.all and all three panels showed "no data for this period",
  // which is a lie — the data was there, the request wasn't.
  const [failed, setFailed] = useState({ funnel: false, lost: false, durations: false });

  const from = days === null ? ALL_TIME_FROM : isoDaysAgo(days);
  const to = new Date().toISOString().slice(0, 10);

  /** "1 Jul 2026 – 29 Sep 2026", or "all time" — printed on both panels. */
  const window_ = days === null
    ? "all time"
    : `${prettyDate(from)} – ${prettyDate(to)}`;

  const load = useCallback(async () => {
    setLoading(true);
    const params = { from, to };

    // allSettled, not all: each panel stands or falls on its own request.
    const [f, l, d] = await Promise.allSettled([
      api.get<FunnelStage[]>("/dashboard/reports/funnel", { params }),
      api.get<LostReason[]>("/dashboard/reports/lost-reasons", { params }),
      api.get<StageDuration[]>("/dashboard/reports/stage-durations", { params }),
    ]);

    setFunnel(f.status === "fulfilled" ? f.value.data ?? [] : []);
    setLost(l.status === "fulfilled" ? l.value.data ?? [] : []);
    setDurations(d.status === "fulfilled" ? d.value.data ?? [] : []);
    setFailed({
      funnel: f.status === "rejected",
      lost: l.status === "rejected",
      durations: d.status === "rejected",
    });
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  // ── From "where leads sit" to "how far leads got" ────────────────
  // The API returns leads by the stage they are at right now. Read as a
  // funnel that lies: the 74 at Contacted are not the survivors of the 128
  // at New — they are a different 74, and the drop between the two rows
  // would be meaningless.
  //
  // A lead sitting at Proposal did pass Contacted and Qualified, though.
  // So each row here is "reached at least this stage" — every lead at this
  // stage or beyond it — which is a real funnel, and the drop between two
  // rows is a real conversion rate.
  //
  // Lost leads are left out: nothing records how far they got before they
  // died, and guessing would put fake numbers in a report about honesty.
  const raw = funnel.filter((s) => PIPELINE.includes(s.stage));
  const stages = raw.map((s, i) => {
    const rest = raw.slice(i);
    return {
      ...s,
      leadCount: rest.reduce((sum, x) => sum + x.leadCount, 0),
      quotedValue: rest.reduce((sum, x) => sum + x.quotedValue, 0),
      atThisStage: s.leadCount,
    };
  });
  const maxCount = Math.max(1, ...stages.map((s) => s.leadCount));
  const maxLost = Math.max(1, ...lost.map((r) => r.leadCount));

  // Stage durations arrive in whatever order the query grouped them.
  // Reordered into the pipeline's own order, because "how long does each
  // step take" only reads as a story top to bottom.
  const durationRows = PIPELINE
    .map((stage) => durations.find((d) => d.stage === stage))
    .filter((d): d is StageDuration => d !== undefined);
  const maxDays = Math.max(1, ...durationRows.map((d) => d.avgDays));
  const lostTotal = lost.reduce((sum, r) => sum + r.leadCount, 0);
  const lostValue = lost.reduce((sum, r) => sum + r.quotedValue, 0);

  // The funnel's top row is every lead received in the window that is not
  // lost. Adding the lost ones back gives the intake figure, which is what
  // the Leads page shows — printed here so the panel ties back to it
  // instead of having to be added up by hand.
  const notLost = stages.length > 0 ? stages[0].leadCount : 0;
  const lostOfIntake = funnel.find((s) => s.stage === "LOST")?.leadCount ?? 0;
  const received = notLost + lostOfIntake;

  return (
    <section style={S.section}>
      <div style={S.head}>
        <div>
          <h2 style={S.title}>Pipeline &amp; Losses</h2>
          <p style={S.subtitle}>
            How far leads get, and why the closed ones were lost
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

      {failed.funnel && failed.lost && failed.durations && (
        <div style={S.error}>
          Couldn't load these reports. The server may still be starting —
          try again in a moment.
        </div>
      )}

      <div style={S.grid}>
        {/* ── Funnel ─────────────────────────────────────────────── */}
        <div style={S.panel}>
          <h3 style={S.panelTitle}>Lead pipeline</h3>
          <p style={S.panelNote}>
            Leads <strong>received</strong> {window_}
            {received > 0
              ? ` · ${received} in total${lostOfIntake > 0 ? `, ${lostOfIntake} of them later lost` : ""}`
              : ""}
          </p>

          {loading ? (
            <p style={S.muted}>Loading…</p>
          ) : failed.funnel ? (
            <p style={S.failed}>This report didn't load.</p>
          ) : stages.every((s) => s.leadCount === 0) ? (
            <p style={S.muted}>No leads received in this period.</p>
          ) : (
            <div className="overflow-x-auto">
            <table style={S.table}>
              <tbody>
                {stages.map((s, i) => {
                  // Drop-off against the stage above — the number that says
                  // where deals are actually dying.
                  const prev = i > 0 ? stages[i - 1].leadCount : null;
                  const drop =
                    prev && prev > 0 && s.leadCount < prev
                      ? Math.round(((prev - s.leadCount) / prev) * 100)
                      : null;

                  return (
                    <tr key={s.stage}>
                      <td style={S.rowLabel}>{s.label}</td>
                      <td style={S.rowBar}>
                        <div
                          title={`Reached ${s.label}: ${s.leadCount} leads (${s.atThisStage} sitting here now) · ${money(s.quotedValue)} quoted`}
                          style={{
                            ...S.bar,
                            width: `${Math.max(2, (s.leadCount / maxCount) * 100)}%`,
                            background: BLUE,
                          }}
                        />
                      </td>
                      <td style={S.rowCount}>{s.leadCount}</td>
                      <td style={S.rowDrop}>{drop !== null ? `−${drop}%` : ""}</td>
                      {!narrow && (
                        <td style={S.rowValue}>{s.quotedValue > 0 ? money(s.quotedValue) : "—"}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
</div>
          )}
          <p style={S.footnote}>
            Counted by the date the lead came in. Each row counts leads that
            reached that stage or went past it, so the percentage beside it is
            the real drop from the stage above. Lost leads are not included —
            nothing records how far they got. Value is our own fee on the
            quotation attached to each lead — the accepted one, or the
            latest sent. Rows ticked as a government or lab fee are left
            out, because that money goes to BIS, not to us.
          </p>
        </div>

        {/* ── Lost reasons ───────────────────────────────────────── */}
        <div style={S.panel}>
          <h3 style={S.panelTitle}>Why we lost</h3>
          <p style={S.panelNote}>
            Leads <strong>closed as Lost</strong> {window_}
            {lostTotal > 0 ? ` · ${lostTotal} lost · ${money(lostValue)} quoted` : ""}
          </p>

          {loading ? (
            <p style={S.muted}>Loading…</p>
          ) : failed.lost ? (
            <p style={S.failed}>This report didn't load.</p>
          ) : lost.length === 0 ? (
            <p style={S.muted}>Nothing was marked Lost in this period.</p>
          ) : (
            <div className="overflow-x-auto">
            <table style={S.table}>
              <tbody>
                {lost.map((r) => (
                  <tr key={r.reason}>
                    <td style={S.rowLabel}>{r.reason}</td>
                    <td style={S.rowBar}>
                      <div
                        title={`${r.reason}: ${r.leadCount} leads · ${r.sharePercent}% of losses · ${money(r.quotedValue)}`}
                        style={{
                          ...S.bar,
                          width: `${Math.max(2, (r.leadCount / maxLost) * 100)}%`,
                          background: ORANGE,
                        }}
                      />
                    </td>
                    <td style={S.rowCount}>{r.leadCount}</td>
                    <td style={S.rowDrop}>{r.sharePercent}%</td>
                    {!narrow && (
                      <td style={S.rowValue}>{r.quotedValue > 0 ? money(r.quotedValue) : "—"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
</div>
          )}
          <p style={S.footnote}>
            Counted by the date the lead was closed, not the date it came in —
            so a lead that arrived months ago and was lost this week counts
            here, and this panel's total will not match the pipeline's.
            "Not recorded" is leads closed before a reason was required.
            ₹0 means no quotation was attached to the lead.
          </p>
        </div>

        {/* ── How long each stage takes ──────────────────────────── */}
        <div style={S.panel}>
          <h3 style={S.panelTitle}>How long each stage takes</h3>
          <p style={S.panelNote}>
            Average days before moving on · grey = how many are sitting
            there now, and for how long
          </p>

          {loading ? (
            <p style={S.muted}>Loading…</p>
          ) : failed.durations ? (
            <p style={S.failed}>
              This report didn't load — the backend may not have the
              stage-durations endpoint yet.
            </p>
          ) : durationRows.length === 0 ? (
            <p style={S.muted}>
              Nothing measurable yet — this fills up as leads move between
              stages from now on.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <table style={S.table}>
              <tbody>
                {durationRows.map((d) => (
                  <tr key={d.stage}>
                    <td style={S.rowLabel}>{d.label}</td>
                    <td style={S.rowBar}>
                      <div
                        title={`${d.label}: ${d.avgDays} days on average across ${d.movedOn} moves · longest ${d.longestDays} days · ${d.stillHere} sitting here now`}
                        style={{
                          ...S.bar,
                          width: `${Math.max(2, (d.avgDays / maxDays) * 100)}%`,
                          background: BLUE,
                        }}
                      />
                    </td>
                    <td style={S.rowCount}>
                      {d.movedOn > 0 ? `${d.avgDays}d` : "—"}
                    </td>
                    {/* The number that matters more than the average: how
                        many are stuck here, and how long they have been. */}
                    <td style={S.rowDrop}>
                      {d.stillHere > 0 ? `${d.stillHere} · ${d.waitingDays}d` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
</div>
          )}
          <p style={S.footnote}>
            Average is over leads that actually moved on from that stage.
            The grey figure beside it is how many are sitting there right
            now and how long they have been waiting, on average — that pair
            is the one worth acting on. Measured from the activity log, so
            it only covers moves made after stage tracking was switched on.
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

  panel: {
    background: "#fcfcfb",
    border: "1px solid #e4e5ef",
    borderRadius: "10px",
    padding: "20px",
  },
  panelTitle: { margin: "0 0 4px 0", fontSize: "15px", fontWeight: 600, color: "#1c1b1b" },
  panelNote: { margin: "0 0 16px 0", fontSize: "12px", color: "#737687" },

  table: { width: "100%", borderCollapse: "collapse" },
  rowLabel: {
    fontSize: "13px",
    color: "#1c1b1b",
    padding: "6px 10px 6px 0",
    // Long reason names ("Requirement postponed or dropped") wrap rather
    // than squeezing the bar out of the panel.
    maxWidth: "190px",
    width: "1%",
  },
  rowBar: { width: "100%", padding: "6px 0" },
  bar: { height: "10px", borderRadius: "0 4px 4px 0", minWidth: "2px" },
  rowCount: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#1c1b1b",
    textAlign: "right",
    padding: "6px 0 6px 12px",
    whiteSpace: "nowrap",
  },
  rowDrop: {
    fontSize: "11px",
    color: "#737687",
    textAlign: "right",
    padding: "6px 0 6px 8px",
    whiteSpace: "nowrap",
    width: "1%",
  },
  rowValue: {
    fontSize: "12px",
    color: "#737687",
    textAlign: "right",
    padding: "6px 0 6px 12px",
    whiteSpace: "nowrap",
    width: "1%",
  },

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