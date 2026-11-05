// src/modules/payment/pages/InvoiceReport.tsx
//
// Payments → Invoice Report. The PI / TI register Accounts asked for:
// every invoice between two dates with taxable value, GST, total, TDS,
// amount after TDS, received and balance — plus the PI a TI came from.
// "Download Excel" saves exactly the rows on screen as an .xlsx file.
//
// Data: GET /finance/invoices/report?from=&to=&type= (InvoiceService.report).

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getInvoiceReport, type InvoiceReportRow } from "../../../services/invoiceService";
import { getApiErrorMessage } from "../../../utils/apiError";

type TypeFilter = "ALL" | "PROFORMA" | "TAX";
type Preset = "month" | "lastMonth" | "fy" | "custom";

const istToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

const pad = (n: number) => String(n).padStart(2, "0");

const monthRange = (offset: number) => {
  const [y, m] = istToday().split("-").map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`,
    to: offset === 0 ? istToday() : `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
  };
};

/** Financial year so far: 1 April → today. */
const fyRange = () => {
  const [y, m] = istToday().split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return { from: `${start}-04-01`, to: istToday() };
};

const num = (v: number | null | undefined) => Number(v ?? 0);
const money = (v: number | null | undefined) =>
  v == null ? "—" : num(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const showDate = (d: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "—";
};
const typeLabel = (t: string) => (t === "TAX" ? "TI" : "PI");
const stageLabel = (s: string | null) =>
  s === "SAMPLE_TESTING" ? "Sample Testing" : s === "FINAL" ? "Final" : s === "ADVANCE" ? "Advance" : "";
const tdsLabel = (r: InvoiceReportRow) =>
  r.invoiceType !== "TAX" ? "" : num(r.tdsRate) > 0 ? `${num(r.tdsRate)}%` : "NIL";

const detailPath = (r: InvoiceReportRow) => {
  // The report row doesn't carry the lead/project id, so open the
  // matching list; the invoice is one search away from there.
  switch (r.referenceType) {
    case "LEAD": return "/payments/leads";
    case "AMC": return "/payments/amc";
    case "INDEPENDENT": return "/payments/independent";
    default: return "/payments/list";
  }
};

export default function InvoiceReport() {
  const navigate = useNavigate();
  const initial = monthRange(0);
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [type, setType] = useState<TypeFilter>("ALL");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<InvoiceReportRow[]>([]);
  // Loading = the rows on screen are not for the current filters yet.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const choose = (p: Preset) => {
    setPreset(p);
    const r = p === "month" ? monthRange(0) : p === "lastMonth" ? monthRange(-1) : p === "fy" ? fyRange() : null;
    if (r) { setFrom(r.from); setTo(r.to); }
  };

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    const key = `${from}|${to}|${type}`;
    getInvoiceReport(from, to, type)
      .then((data) => { if (!cancelled) { setRows(data); setError(null); } })
      .catch((e) => { if (!cancelled) setError(getApiErrorMessage(e, "Could not load the invoice report.")); })
      .finally(() => { if (!cancelled) setLoadedKey(key); });
    return () => { cancelled = true; };
  }, [from, to, type]);

  const loading = loadedKey !== `${from}|${to}|${type}`;

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.invoiceNumber, r.clientName, r.clientGst, r.sourcePiNumber]
        .some((v) => (v ?? "").toLowerCase().includes(q))
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    const t = { pi: 0, ti: 0, piValue: 0, taxable: 0, gst: 0, total: 0, tds: 0, afterTds: 0, received: 0, balance: 0 };
    shown.forEach((r) => {
      if (r.invoiceType === "TAX") {
        t.ti += 1;
        t.taxable += num(r.taxableAmount);
        t.gst += num(r.cgstAmount) + num(r.sgstAmount) + num(r.igstAmount);
        t.total += num(r.totalAmount);
        t.tds += num(r.tdsAmount);
        t.afterTds += num(r.amountAfterTds ?? r.totalAmount);
      } else {
        t.pi += 1;
        t.piValue += num(r.totalAmount);
        // Money is recorded against the PI, so received / balance add up from PIs only.
        t.received += num(r.receivedAmount);
        t.balance += num(r.balanceAmount);
      }
    });
    return t;
  }, [shown]);

  const downloadExcel = async () => {
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "Standphill CRM";
      const ws = wb.addWorksheet("Invoice Report", { views: [{ state: "frozen", ySplit: 3 }] });

      const columns: { header: string; key: string; width: number; money?: boolean }[] = [
        { header: "Date", key: "date", width: 12 },
        { header: "Type", key: "type", width: 6 },
        { header: "Invoice No.", key: "no", width: 22 },
        { header: "PI Type", key: "stage", width: 15 },
        { header: "Client", key: "client", width: 34 },
        { header: "GSTIN", key: "gst", width: 18 },
        { header: "Place of Supply", key: "pos", width: 16 },
        { header: "Taxable Value", key: "taxable", width: 15, money: true },
        { header: "CGST", key: "cgst", width: 12, money: true },
        { header: "SGST", key: "sgst", width: 12, money: true },
        { header: "IGST", key: "igst", width: 12, money: true },
        { header: "Total", key: "total", width: 15, money: true },
        { header: "TDS %", key: "tdsRate", width: 8 },
        { header: "TDS Amount", key: "tds", width: 13, money: true },
        { header: "Amount after TDS", key: "afterTds", width: 16, money: true },
        { header: "Received", key: "received", width: 14, money: true },
        { header: "Balance", key: "balance", width: 14, money: true },
        { header: "Proforma Invoice No.", key: "piNo", width: 22 },
        { header: "PI Date", key: "piDate", width: 12 },
        { header: "Status", key: "status", width: 9 },
      ];
      ws.columns = columns.map((c) => ({ key: c.key, width: c.width }));

      ws.mergeCells(1, 1, 1, columns.length);
      ws.getCell(1, 1).value =
        `PI / TI Report — ${showDate(from)} to ${showDate(to)}` + (type === "ALL" ? "" : ` (${typeLabel(type)} only)`);
      ws.getCell(1, 1).font = { bold: true, size: 14 };
      ws.addRow([]);

      const head = ws.addRow(columns.map((c) => c.header));
      head.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
        cell.alignment = { vertical: "middle", wrapText: true };
      });

      shown.forEach((r) => {
        const isTi = r.invoiceType === "TAX";
        ws.addRow({
          date: showDate(r.issueDate),
          type: typeLabel(r.invoiceType),
          no: r.invoiceNumber,
          stage: isTi ? "" : stageLabel(r.piStage),
          client: r.clientName ?? "",
          gst: r.clientGst ?? "",
          pos: r.placeOfSupply ?? "",
          taxable: num(r.taxableAmount),
          cgst: num(r.cgstAmount),
          sgst: num(r.sgstAmount),
          igst: num(r.igstAmount),
          total: num(r.totalAmount),
          tdsRate: tdsLabel(r),
          tds: isTi ? num(r.tdsAmount) : null,
          afterTds: isTi ? num(r.amountAfterTds ?? r.totalAmount) : null,
          received: isTi ? null : r.receivedAmount,
          balance: isTi ? null : r.balanceAmount,
          piNo: r.sourcePiNumber ?? "",
          piDate: r.sourcePiDate ? showDate(r.sourcePiDate) : "",
          status: r.status,
        });
      });

      ws.addRow([]);
      const sum = ws.addRow({
        client: `TI total (${totals.ti})`,
        taxable: totals.taxable,
        total: totals.total,
        tds: totals.tds,
        afterTds: totals.afterTds,
      });
      sum.font = { bold: true };
      const sumPi = ws.addRow({
        client: `PI total (${totals.pi})`,
        total: totals.piValue,
        received: totals.received,
        balance: totals.balance,
      });
      sumPi.font = { bold: true };

      columns.forEach((c, i) => {
        if (c.money) ws.getColumn(i + 1).numFmt = "#,##,##0.00";
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `PI-TI-report_${from}_to_${to}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not create the Excel file."));
    } finally {
      setExporting(false);
    }
  };

  const presetBtn = (p: Preset, label: string) => (
    <button
      key={p}
      onClick={() => choose(p)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
        preset === p ? "bg-blue-700 text-white border-blue-700" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );

  const card = (label: string, value: string, sub?: string) => (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );

  return (
    <div className="p-0 lg:p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Invoice Report</h2>
          <p className="text-sm text-gray-500">All PIs and TIs by invoice date, with GST, TDS and payment received.</p>
        </div>
        <button
          onClick={downloadExcel}
          disabled={exporting || loading || shown.length === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-700 hover:bg-green-800 disabled:opacity-40"
        >
          {exporting ? "Preparing…" : "Download Excel"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {presetBtn("month", "This month")}
        {presetBtn("lastMonth", "Last month")}
        {presetBtn("fy", "This financial year")}
        <span className="text-sm text-gray-400 mx-1">or</span>
        <input
          type="date" value={from} max={to}
          onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }}
          className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm"
        />
        <span className="text-sm text-gray-500">to</span>
        <input
          type="date" value={to} min={from}
          onChange={(e) => { setPreset("custom"); setTo(e.target.value); }}
          className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TypeFilter)}
          className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm"
        >
          <option value="ALL">PI + TI</option>
          <option value="PROFORMA">PI only</option>
          <option value="TAX">TI only</option>
        </select>
        <input
          type="search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search no., client, GSTIN"
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm w-full sm:w-64"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {card("Tax Invoices", `₹${money(totals.total)}`, `${totals.ti} TI · taxable ₹${money(totals.taxable)}`)}
        {card("TDS", `₹${money(totals.tds)}`, `After TDS ₹${money(totals.afterTds)}`)}
        {card("Proforma Invoices", `₹${money(totals.piValue)}`, `${totals.pi} PI`)}
        {card("Received / Balance", `₹${money(totals.received)}`, `Balance ₹${money(totals.balance)}`)}
      </div>

      {/* Phone / tablet: one card per invoice. The table is for laptops. */}
      <div className="lg:hidden space-y-2">
        {loading ? (
          <p className="p-6 text-center text-gray-500 text-sm">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="p-6 text-center text-gray-500 text-sm">No invoices on these dates.</p>
        ) : (
          shown.map((r) => {
            const isTi = r.invoiceType === "TAX";
            const gst = num(r.cgstAmount) + num(r.sgstAmount) + num(r.igstAmount);
            return (
              <button
                key={r.id}
                onClick={() => navigate(detailPath(r))}
                className="w-full text-left rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className={`mr-2 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      isTi ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                    }`}>
                      {typeLabel(r.invoiceType)}
                    </span>
                    <span className="font-bold text-gray-900 break-all">{r.invoiceNumber}</span>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">{showDate(r.issueDate)}</span>
                </div>
                <p className="mt-1 text-sm text-gray-800 break-words">{r.clientName ?? "—"}</p>
                {r.clientGst && <p className="text-xs text-gray-500">{r.clientGst}</p>}
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
                  <div className="rounded-lg bg-gray-50 px-2 py-1.5"><span className="block text-gray-500">Taxable</span><b>{money(r.taxableAmount)}</b></div>
                  <div className="rounded-lg bg-gray-50 px-2 py-1.5"><span className="block text-gray-500">GST</span><b>{money(gst)}</b></div>
                  <div className="rounded-lg bg-gray-50 px-2 py-1.5"><span className="block text-gray-500">Total</span><b>{money(r.totalAmount)}</b></div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                  {isTi ? (
                    <>
                      <span>TDS {num(r.tdsRate) > 0 ? `${money(r.tdsAmount)} @${num(r.tdsRate)}%` : "NIL"}</span>
                      <span>After TDS <b>{money(r.amountAfterTds ?? r.totalAmount)}</b></span>
                      {r.sourcePiNumber && <span>PI {r.sourcePiNumber}</span>}
                    </>
                  ) : (
                    <>
                      <span>Received <b className="text-green-700">{money(r.receivedAmount)}</b></span>
                      <span>Balance <b className="text-orange-700">{money(r.balanceAmount)}</b></span>
                    </>
                  )}
                  <span className="ml-auto">{r.status}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="hidden lg:block overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Invoice No.</th>
              <th className="p-3 text-left">Client</th>
              <th className="p-3 text-right">Taxable</th>
              <th className="p-3 text-right">GST</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-right">TDS</th>
              <th className="p-3 text-right">After TDS</th>
              <th className="p-3 text-right">Received</th>
              <th className="p-3 text-right">Balance</th>
              <th className="p-3 text-left">PI No. / Date</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} className="p-6 text-center text-gray-500">Loading…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={12} className="p-6 text-center text-gray-500">No invoices on these dates.</td></tr>
            ) : (
              shown.map((r) => {
                const isTi = r.invoiceType === "TAX";
                const gst = num(r.cgstAmount) + num(r.sgstAmount) + num(r.igstAmount);
                return (
                  <tr
                    key={r.id}
                    onClick={() => navigate(detailPath(r))}
                    title="Open the list this invoice belongs to"
                    className="border-b hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="p-3">{showDate(r.issueDate)}</td>
                    <td className="p-3">
                      <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-semibold ${
                        isTi ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                      }`}>
                        {typeLabel(r.invoiceType)}
                      </span>
                      <span className="font-medium text-gray-900">{r.invoiceNumber}</span>
                      {!isTi && r.piStage && r.piStage !== "ADVANCE" && (
                        <span className="ml-1 text-xs text-gray-500">({stageLabel(r.piStage)})</span>
                      )}
                    </td>
                    <td className="p-3 max-w-[260px] truncate" title={r.clientName ?? ""}>
                      {r.clientName ?? "—"}
                      {r.clientGst && <span className="block text-xs text-gray-500">{r.clientGst}</span>}
                    </td>
                    <td className="p-3 text-right">{money(r.taxableAmount)}</td>
                    <td className="p-3 text-right">{money(gst)}</td>
                    <td className="p-3 text-right font-semibold">{money(r.totalAmount)}</td>
                    <td className="p-3 text-right">
                      {isTi ? (num(r.tdsRate) > 0 ? <>{money(r.tdsAmount)} <span className="text-xs text-gray-500">@{num(r.tdsRate)}%</span></> : "NIL") : "—"}
                    </td>
                    <td className="p-3 text-right">{isTi ? money(r.amountAfterTds ?? r.totalAmount) : "—"}</td>
                    <td className="p-3 text-right">{isTi ? "—" : money(r.receivedAmount)}</td>
                    <td className="p-3 text-right">{isTi ? "—" : money(r.balanceAmount)}</td>
                    <td className="p-3">
                      {r.sourcePiNumber ? (
                        <>
                          {r.sourcePiNumber}
                          <span className="block text-xs text-gray-500">{showDate(r.sourcePiDate)}</span>
                        </>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-xs">{r.status}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        Received and Balance are tracked on the PI (that is where payments are entered), so they show on PI rows only.
      </p>
    </div>
  );
}