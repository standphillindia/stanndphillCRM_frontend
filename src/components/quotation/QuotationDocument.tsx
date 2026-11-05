// src/components/quotation/QuotationDocument.tsx
//
// The printable quotation. This same DOM node is what the preview modal
// shows and what html2canvas captures for the PDF, so the preview can
// never disagree with the downloaded file.
//
// One layout covers all seven certification types. Rather than seven
// templates, every block renders only when it has content — a WPC
// quotation has no functional-scope table but does have an intro
// paragraph; an EPR Plastic one carries a full covering letter; the BIS
// ones have neither. Leaving a block empty on the form drops it here.
//
// Section numbers are assigned at render time from whichever blocks are
// present, which is why the source documents disagreed about whether
// Commercial Scope was "PART 2" or "PART 3". Here it can't drift.
//
// ── On pagination ──
// downloadElementAsPdf runs html2canvas, which flattens this into one tall
// bitmap and slices it at A4 boundaries. CSS page-break rules are invisible
// to it, so the only way to control where a page ends is to make the
// content itself exactly one page tall. That's why the covering letter is
// its own fixed-height A4 sheet — without it the signature block landed
// half on one page and half on the next.
//
// ── On the corner graphics ──
// The originals were built in Canva and carry angled navy/orange bands in
// the corners. They're drawn here with CSS border triangles rather than
// clip-path or transforms, because those are the shapes html2canvas
// rasterises most reliably.

import React from "react";
import logo from "../../assets/invoicelogo.png";
import { getSignatoryByName } from "../../config/signatories";
import type {
  FunctionalScopeRow,
  PaymentTermRow,
  QuotationLineItemResponse,
  SampleRequirementRow,
} from "../../services/quotationService";

export interface QuotationDocumentProps {
  elementId?: string;

  offerNumber: string;
  offerDate: string;
  validUntil?: string;
  /** Scheme code — AIFL adds the "All India First License" line above the title. */
  certificationType?: string;

  clientName?: string;
  clientCompany?: string;
  clientEmail?: string;
  clientMobile?: string;
  kindAttention?: string;

  introNote?: string;
  introParagraph?: string;
  projectDescription?: string;
  functionalScope?: FunctionalScopeRow[];
  totalTimeline?: string;
  basicAspects?: string[];
  basicRequirements?: string[];
  basicRequirementsNote?: string;
  sampleRequirements?: SampleRequirementRow[];
  sampleRemark?: string;
  sampleGuidelines?: string[];
  workScope?: string[];
  terms?: string[];
  paymentRatio?: PaymentTermRow[];
  showCurrencyColumn?: boolean;
  closingNote?: string;
  signatoryName?: string;
  signatoryTitle?: string;

  lineItems: QuotationLineItemResponse[];
  totalInr: number;
  totalUsd: number;
}

const COMPANY = {
  address:
    "A-1024, 10th Floor, T-3, NX one, Plot No 17, Techzone-4, Greater Noida West-201308, Uttar Pradesh, India.",
  contact: "Mob: +91-9667674225  |  Email: info@standphillindia.in",
  phone: "9667674225",
};

// A4 at 96dpi. The capture is sliced at exactly this height, so a sheet
// measuring this tall ends precisely where the page ends.
const A4_W = 794;
const A4_H = 1123;
const PAD = 40;

const NAVY = "#16213E";
const ORANGE = "#F26522";

const money = (v?: number) =>
  v === undefined || v === null ? "" : v.toLocaleString("en-IN");

const has = (v?: unknown[]) => Array.isArray(v) && v.length > 0;

const formatDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

/**
 * The Time Duration column is merged across consecutive steps that share
 * a duration. A blank timeDuration means "same as above", so we walk the
 * rows once and work out the rowSpan for each run.
 */
function withRowSpans(rows: FunctionalScopeRow[]) {
  return rows.map((row, i) => {
    if (!row.timeDuration?.trim()) return { row, rowSpan: 0 };
    let span = 1;
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[j].timeDuration?.trim()) break;
      span++;
    }
    return { row, rowSpan: span };
  });
}

/**
 * Groups scope rows so rows sharing a merged Time Duration cell stay in one
 * tbody (a rowSpan can't cross tbodies, and must not cross a page).
 */
function scopeGroups<T extends { rowSpan: number }>(rows: T[]): T[][] {
  const groups: T[][] = [];
  rows.forEach((r) => {
    if (r.rowSpan > 0 || groups.length === 0) groups.push([r]);
    else groups[groups.length - 1].push(r);
  });
  return groups;
}

/**
 * Splits the project description into an intro line and numbered points.
 *
 * People type the product list inline — "…following: 1. Chairs 2. Tables
 * 3. Storage" — and it printed as one dense paragraph. Each "N. " that
 * starts a new point (a number, a dot, then a space) now begins its own line. Line breaks typed in the box are kept too.
 * "IS 17632:2022" or "2018 for" don't match, so standards and years stay put.
 */
function splitDescription(text: string): { intro: string[]; points: string[] } {
  const intro: string[] = [];
  const points: string[] = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      line
        // \s+ after the marker (not \s*): "IS 1180 (Part 1):2014" has
        // "1)" followed by ":" and must not start a point.
        .split(/\s+(?=\d{1,2}(?:\.\)|\)|\.)\s+\S)/)
        .map((p) => p.trim())
        .filter(Boolean)
        .forEach((part) => {
          if (/^\d{1,2}(?:\.\)|\)|\.)\s+\S/.test(part)) points.push(part);
          // A typed line after the list stays its own line, unnumbered.
          else if (points.length) points.push(part);
          else intro.push(part);
        });
    });
  return { intro, points };
}

function ProjectDescription({ text }: { text: string }) {
  const { intro, points } = splitDescription(text);
  return (
    <>
      {intro.map((l, i) => (
        <div key={`i${i}`}>{l}</div>
      ))}
      {points.map((p, i) => {
        const m = p.match(/^(\d{1,2}(?:\.\)|\)|\.))\s*(.*)$/);
        return (
          <div key={`p${i}`} style={{ display: "flex", gap: 6, marginTop: i === 0 && intro.length ? 4 : 2, whiteSpace: "pre-line" }}>
            <span style={{ minWidth: 18 }}>{m ? m[1] : ""}</span>
            <span>{m ? m[2] : p}</span>
          </div>
        );
      })}
    </>
  );
}

/**
 * Angled navy/orange bands sweeping in from both corners, mirrored left
 * and right so the band reads as one continuous ribbon across the sheet
 * rather than a lopsided wedge on one side.
 *
 * The left pair is deliberately shorter than the right: on the originals
 * the heavier mass sits on the right, away from the logo, and matching
 * both sides exactly made the header feel boxed in.
 */
function CornerBand({ position }: { position: "top" | "bottom" }) {
  const top = position === "top";
  const edge = top ? { top: 0 } : { bottom: 0 };

  // Right-hand wedges taper towards the middle; left-hand ones mirror them.
  const rightNavy = top
    ? { borderTop: `56px solid ${NAVY}`, borderLeft: "330px solid transparent" }
    : { borderBottom: `56px solid ${NAVY}`, borderLeft: "330px solid transparent" };
  const rightOrange = top
    ? { borderTop: `34px solid ${ORANGE}`, borderLeft: "230px solid transparent" }
    : { borderBottom: `34px solid ${ORANGE}`, borderLeft: "230px solid transparent" };
  const leftNavy = top
    ? { borderTop: `56px solid ${NAVY}`, borderRight: "190px solid transparent" }
    : { borderBottom: `56px solid ${NAVY}`, borderRight: "190px solid transparent" };
  const leftOrange = top
    ? { borderTop: `34px solid ${ORANGE}`, borderRight: "130px solid transparent" }
    : { borderBottom: `34px solid ${ORANGE}`, borderRight: "130px solid transparent" };

  const wedge = (
    styleSide: React.CSSProperties,
    border: React.CSSProperties,
    key: string
  ) => (
    <div
      key={key}
      style={{ position: "absolute", width: 0, height: 0, ...edge, ...styleSide, ...border }}
    />
  );

  return (
    <div style={{ ...S.cornerWrap, ...(top ? { marginBottom: 6 } : { marginTop: 10 }) }}>
      {wedge({ right: 0 }, rightNavy, "rn")}
      {wedge({ right: 0 }, rightOrange, "ro")}
      {wedge({ left: 0 }, leftNavy, "ln")}
      {wedge({ left: 0 }, leftOrange, "lo")}
    </div>
  );
}

/**
 * Groups commercial rows into the priced tables the document renders.
 *
 * A multi-product BIS application prices each product family separately —
 * "Work chairs & General Purposes chairs", then "Table desk & storage
 * unit", then "Beds & Bunk beds" — and within a family two products sit
 * side by side sharing one set of fee rows. Storage stays a flat list of
 * rows; the shape is rebuilt here.
 *
 * Rows with no sectionTitle fall into a single unheaded table, which is
 * exactly how every quotation raised before this looked.
 */
function groupIntoSections(items: QuotationLineItemResponse[]) {
  const sections: {
    title: string | null;
    columns: string[];
    rows: {
      category?: string;
      description?: string;
      remarks?: string;
      /** One cell per column, in the same order as `columns`. */
      cells: (QuotationLineItemResponse | undefined)[];
    }[];
  }[] = [];

  // Keyed on sectionIndex, not the heading. Two tables may share a title
  // or have none at all, and keying on text quietly merged them into one.
  // Rows written before sectionIndex existed all carry null, which lands
  // them in a single table — exactly how they used to render.
  const byIndex = new Map<number, QuotationLineItemResponse[]>();
  const indexOrder: number[] = [];

  items.forEach((item) => {
    const key = item.sectionIndex ?? 0;
    if (!byIndex.has(key)) {
      byIndex.set(key, []);
      indexOrder.push(key);
    }
    byIndex.get(key)!.push(item);
  });

  indexOrder.sort((a, b) => a - b);

  indexOrder.forEach((idx) => {
    const rowsIn = byIndex.get(idx)!;
    const title = rowsIn.find((r) => r.sectionTitle?.trim())?.sectionTitle?.trim() || "";


    // ── Rows ──
    // By rowIndex when saved; older rows fall back to their fee name.
    const rowKeys: string[] = [];
    const byRow = new Map<string, QuotationLineItemResponse[]>();
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
    const colOf = new Map<QuotationLineItemResponse, number>();
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

    sections.push({
      title: title || null,
      columns,
      rows: rowKeys.map((key) => {
        const group = byRow.get(key)!;
        const first = group[0];
        return {
          category: first.category,
          description: first.description,
          // Remarks are the same across a row's columns in every source
          // document, so the first non-empty one speaks for the row.
          remarks: group.find((g) => g.remarks?.trim())?.remarks,
          cells: columns.map((_, c) => group.find((g) => colOf.get(g) === c)),
        };
      }),
    });
  });

  return sections;
}

export default function QuotationDocument(props: QuotationDocumentProps) {
  const {
    elementId = "quotation-document",
    certificationType,
    offerNumber,
    offerDate,
    clientName,
    clientCompany,
    clientEmail,
    clientMobile,
    kindAttention,
    introNote,
    introParagraph,
    projectDescription,
    functionalScope,
    totalTimeline,
    basicAspects,
    basicRequirements,
    basicRequirementsNote,
    sampleRequirements,
    sampleRemark,
    sampleGuidelines,
    workScope,
    terms,
    paymentRatio,
    showCurrencyColumn,
    closingNote,
    signatoryName,
    signatoryTitle,
    lineItems,
    totalInr,
    totalUsd,
  } = props;

  const signatory = getSignatoryByName(signatoryName);
  const hasIntroNote = Boolean(introNote?.trim());

  // Section numbering is derived, never hardcoded — see file header.
  let partNo = 0;
  const nextPart = () => ++partNo;

  // AMC (Annual Maintenance) quotations print Part 1 as two bullet lists —
  // "Documentation Support" (the Basic Aspects box) and "AMC Scope of Work"
  // (the Work Scope box) — instead of a process/timeline table, matching
  // the AMC letters the team sends (e.g. SI/AMC/2026/449).
  const isAmc = certificationType === "AMC";
  const showScope = has(functionalScope) || (isAmc && (has(basicAspects) || has(workScope)));
  const showCommercial = has(lineItems);
  // Part 3 splits into A/B/C sub-sections only when the sample blocks are
  // used (BEE-style quotations); otherwise it's the plain documents list.
  const hasSampleBlocks = has(sampleRequirements) || has(sampleGuidelines);
  const showRequirements = has(basicRequirements) || hasSampleBlocks;
  let reqSub = 0;
  const nextReqLetter = () => String.fromCharCode(65 + reqSub++);
  // "Product Sample required for BEE Testing" — the scheme the sample is
  // tested for, as the team's letters word it. Other schemes keep the
  // plain "Product Sample required for Testing".
  const sampleScheme = certificationType === "BEE" ? "BEE" : null;
  const showWorkScope = !isAmc && has(workScope);

  const scopePart = showScope ? nextPart() : null;
  const commercialPart = showCommercial ? nextPart() : null;
  const requirementsPart = showRequirements ? nextPart() : null;
  const workScopePart = showWorkScope ? nextPart() : null;

  const anyRemarks = lineItems?.some((i) => i.remarks?.trim());
  const commercialSections = groupIntoSections(lineItems ?? []);

  // A section with real column labels gets a header row; the source
  // documents leave them off when the section title already names both
  // products, so an all-blank label set renders without one.
  const hasColumnLabels = (cols: string[]) => cols.some((c) => c.trim() !== "");

  const Letterhead = () => (
    <>
      <CornerBand position="top" />
      <div style={S.header}>
        <img src={logo} alt="Standphill India" style={S.logo} />
        <div style={S.headerRight}>
          <div style={S.address}>{COMPANY.address}</div>
          <div style={S.contact}>{COMPANY.contact}</div>
        </div>
      </div>
      <div style={S.headerRule} />
    </>
  );

  /**
   * Addressee and offer reference, directly under the letterhead — in the
   * source documents this block was always the first thing under the logo,
   * above the covering letter, not below it.
   *
   * kindAttention appears once and is required, so the addressee and the
   * salutation below can't disagree. One source document read "To: Ms.
   * Muskan Gautam" above "Dear Mr. Satish Reddy", and that reached the
   * client.
   */
  const MetaBlock = () => (
    <div style={S.metaRow}>
      <div style={S.metaLeft}>
        {kindAttention && <div><span style={S.metaLabel}>To:</span> {kindAttention}</div>}
        {clientCompany && <div><span style={S.metaLabel}>Company Name:</span> {clientCompany}</div>}
        {clientName && clientName !== kindAttention && (
          <div><span style={S.metaLabel}>Contact:</span> {clientName}</div>
        )}
        {clientEmail && <div><span style={S.metaLabel}>E-mail:</span> {clientEmail}</div>}
        {clientMobile && <div><span style={S.metaLabel}>Mobile:</span> {clientMobile}</div>}
      </div>
      <div style={S.metaRight}>
        <div><span style={S.metaLabel}>Offer No.:</span> {offerNumber}</div>
        <div><span style={S.metaLabel}>Date:</span> {formatDate(offerDate)}</div>
      </div>
    </div>
  );

  const SignatureBlock = ({ warm = false }: { warm?: boolean }) => (
    <div style={S.signBlock}>
      <div style={S.signRegards}>{warm ? "Best Regards," : "Regards,"}</div>
      {signatory?.imageUrl && <img src={signatory.imageUrl} alt="" style={S.signature} />}
      {signatoryName && <div style={S.signName}>{signatoryName}</div>}
      {signatoryTitle && <div style={S.signRole}>{signatoryTitle}</div>}
      <div style={S.signRole}>STANDPHILL INDIA, Greater Noida, India</div>
      <div style={S.signPhone}>📞 {COMPANY.phone}</div>
    </div>
  );

  const Watermark = () => (
    <div style={S.watermark}>
      <div style={S.watermarkName}>STANDPHILL INDIA</div>
      <div style={S.watermarkTag}>The House of Standards</div>
    </div>
  );

  // ── LMPC: the team's letter format (e.g. offer SI/LMPC/583) ─────────────
  // Same sheet as every other quotation (letterhead, address/offer block,
  // watermark, corner bands, footer note), but the body is the team's LMPC
  // letter instead of Part 1 / Part 2: greeting, the documents list with
  // sub-headings, timeline, fees as paragraphs, then the sender's sign-off.
  // Built from the same form fields:
  //   introParagraph        -> the opening paragraphs
  //   basicRequirements     -> documents; a line ending in ":" is a
  //                            sub-heading, a line starting with "~" is plain
  //                            text, any other line is a bullet
  //   basicRequirementsNote -> small note under the documents
  //   totalTimeline         -> "Timeline: …"
  //   commercial table      -> "Fees: <table heading>"; each row prints as
  //                            "<Particulars>: <amount>" with its Remarks
  //                            below ("a | b | c" in Remarks = bullets)
  //   terms                 -> extra paragraphs after the fees
  //   closingNote           -> "Looking forward to …"
  //   signatoryName / Title -> sign-off; "Marketing Executive | 9958048941"
  //                            prints the title and phone on two lines
  if (certificationType === "LMPC") {
    const feeSections = groupIntoSections(lineItems ?? []);
    const titleLines = (signatoryTitle ?? "").split("|").map((t) => t.trim()).filter(Boolean);
    const docLines = (basicRequirements ?? []).map((l) => l.trim()).filter(Boolean);
    const firstHeading = docLines.findIndex((l) => l.endsWith(":"));
    const closing = (closingNote?.trim() || "Looking forward to your confirmation and documents.")
      .split("\n")
      .filter((x) => x.trim());

    return (
      <div id={elementId} style={S.doc}>
        <div style={S.bodySheet}>
          {Watermark()}
          <div style={S.layer}>
            {/* Letterhead, addressee and greeting travel together. */}
            <div data-pdf-block>
              {Letterhead()}
              {MetaBlock()}
              <h1 style={S.docTitle}>QUOTATION LETTER</h1>
              <p style={L.text}>Dear Sir,</p>
              <p style={{ ...L.text, marginTop: 10 }}>Document Requirements &amp; Details:-</p>
              <p style={{ ...L.text, marginTop: 10 }}>Greetings from Standphill India,</p>
            </div>

            {(introParagraph ?? "").split("\n").filter((x) => x.trim()).map((para, i) => (
              <p key={i} style={{ ...L.text, marginTop: 8, textAlign: "justify" }} data-pdf-block>{para}</p>
            ))}

            {docLines.length > 0 && (
              <div style={{ marginTop: 14 }}>
                {docLines.map((line, i) => {
                  if (line.endsWith(":")) {
                    return (
                      <h4
                        key={i}
                        style={{ ...L.docHeading, ...(i === firstHeading ? L.docHeadingMain : { marginLeft: 16 }) }}
                        data-pdf-block
                        data-pdf-keep-next
                      >
                        {line}
                      </h4>
                    );
                  }
                  if (line.startsWith("~")) {
                    const firstPlain = i === 0 || !docLines[i - 1].startsWith("~");
                    return (
                      <p key={i} style={{ ...L.text, marginTop: firstPlain ? 14 : 4 }} data-pdf-block>
                        {line.slice(1).trim()}
                      </p>
                    );
                  }
                  return (
                    <div key={i} style={L.docBullet} data-pdf-block>
                      <span style={L.dot}>•</span>
                      {line}
                    </div>
                  );
                })}
                {basicRequirementsNote?.trim() && (
                  <p style={{ ...L.small, marginTop: 8 }} data-pdf-block>{basicRequirementsNote}</p>
                )}
              </div>
            )}

            {totalTimeline?.trim() && (
              <p style={{ ...L.text, marginTop: 18 }} data-pdf-block>
                <b style={{ fontSize: 14 }}>Timeline:</b> {totalTimeline}
              </p>
            )}

            {feeSections.map((sec, si) => (
              <div key={si} style={{ marginTop: 22 }}>
                <div style={L.feesTitle} data-pdf-block data-pdf-keep-next>
                  <span style={{ fontWeight: 400 }}>Fees</span>
                  <b>:{sec.title ? sec.title : ""}</b>
                </div>
                {sec.rows.map((row, ri) => {
                  const cell = row.cells[0];
                  const textAmount = cell?.amountText?.trim() || "";
                  const remarks = (row.remarks ?? "").trim();
                  const parts = remarks.split("||").map((x) => x.trim()).filter(Boolean);
                  const category = (row.category ?? "").trim();

                  // "The total cost for LMPC registration is" -> one sentence
                  // with the amount in bold, like the team's letter.
                  if (/\bis$/i.test(category)) {
                    const amount = textAmount || (cell?.amountInr ? `₹ ${money(cell.amountInr)}` : "");
                    const first = parts[0] ?? "";
                    const gst = first.match(/^\+\s*GST/i)?.[0] ?? "";
                    return (
                      <div key={ri} style={{ marginBottom: 16 }} data-pdf-block>
                        <p style={L.text}>
                          {category} <b>{amount}{gst ? ` ${gst}` : ""}</b> {first.slice(gst.length).trim()}
                        </p>
                        {parts.slice(1).map((pt, k) => (
                          <p key={k} style={{ ...L.small, marginTop: 2 }}>{pt}</p>
                        ))}
                      </div>
                    );
                  }

                  const amount = textAmount || (cell?.amountInr ? `INR ${cell.amountInr}/-` : "");
                  const points = remarks.includes("|") && !remarks.includes("||")
                    ? remarks.split("|").map((x) => x.trim()).filter(Boolean)
                    : [];
                  return (
                    <div key={ri} style={{ marginBottom: 14 }} data-pdf-block>
                      <div style={L.feeHead}>{category}{amount ? `: ${amount}` : ""}</div>
                      {points.length > 0
                        ? points.map((pt, k) => (
                            <div key={k} style={L.feeBullet}>
                              <span style={L.dot}>•</span>
                              {pt}
                            </div>
                          ))
                        : parts.map((pt, k) => <div key={k} style={L.feeHead}>{pt}</div>)}
                    </div>
                  );
                })}
              </div>
            ))}

            {has(terms) &&
              terms!.map((t, i) => (
                <p key={i} style={{ ...L.text, marginTop: 8, textAlign: "justify" }} data-pdf-block>{t}</p>
              ))}

            {/* Sender sign-off */}
            <div style={{ marginTop: 22 }} data-pdf-block>
              {closing.map((para, i) => <p key={i} style={L.text}>{para}</p>)}
              <p style={{ ...L.text, marginTop: 12 }}>Best regards,</p>
              {signatoryName && <div style={L.signLine}>{signatoryName}</div>}
              {titleLines.map((t, i) => (
                <div key={i} style={L.signLine}>{i === 0 ? t.toUpperCase() : t}</div>
              ))}
              <div style={L.signLine}>STANDPHILL INDIA</div>
            </div>

            {/* Closing, footer note and the bottom band stay together. */}
            <div style={{ marginTop: 26 }} data-pdf-block>
              <p style={L.text}>We hope you will find the same in order &amp; oblige. We look forward to your kind anticipation.</p>
              <p style={{ ...L.text, marginTop: 12 }}>Thank you for your time and consideration.</p>
              <p style={L.text}>Regards,</p>
              <div style={{ ...L.orange, marginTop: 10 }}>Standphill India</div>
              <div style={L.orange}>Greater Noida- West</div>

              <div style={S.systemNote}>
                This document is generated by Standphill INDIA encrypted system software; valid without signature.
              </div>
              <CornerBand position="bottom" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id={elementId} style={S.doc}>

      {/* ── Sheet 1: covering letter, exactly one A4 tall ───────────── */}
      {hasIntroNote && (
        <div style={S.coverSheet} data-pdf-block>
          <Watermark />
          <div style={S.layer}>
            <Letterhead />
            <MetaBlock />
            <h2 style={S.centerTitle}>INTRODUCTORY NOTE</h2>
            {kindAttention && <p style={S.salutation}>Dear {kindAttention},</p>}
            {introNote!.split("\n").map((para, i) =>
              para.trim() ? <p key={i} style={S.introPara}>{para}</p> : null
            )}
          </div>
          <div style={S.layer}>
            <SignatureBlock warm />
            <CornerBand position="bottom" />
          </div>
        </div>
      )}

      {/* ── Sheet 2: the quotation body ─────────────────────────────── */}
      <div style={S.bodySheet}>
        <Watermark />
        <div style={S.layer}>
          {/* Letterhead, title and the project row travel together — a page
              that opened on a bare project table read as a stray fragment. */}
          <div data-pdf-block>
            <Letterhead />
            {!hasIntroNote && <MetaBlock />}

            {certificationType === "AIFL" && (
              <p style={S.docPreTitle}>(COMES UNDER ALL INDIA FIRST LICENSE)</p>
            )}
            <h1 style={S.docTitle}>QUOTATION LETTER</h1>

            {projectDescription?.trim() && (
              <table style={{ ...S.table, marginBottom: 16 }}>
                <tbody>
                  <tr>
                    <td style={{ ...S.td, ...S.labelCell, width: "22%" }}>
                      Project Name &amp; Description:
                    </td>
                    <td style={{ ...S.td, fontWeight: 600 }}>
                      <ProjectDescription text={projectDescription} />
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Prose intro used in place of a scope table (the WPC shape) */}
          {introParagraph?.trim() && (
            <div style={S.block} data-pdf-block>
              {introParagraph.split("\n").map((para, i) =>
                para.trim() ? <p key={i} style={S.para}>{para}</p> : null
              )}
            </div>
          )}

          {/* Long sections below flow row by row across pages: each row or
              bullet is its own data-pdf-block, the heading and table header
              are keep-next. Wrapping the whole section as one block left
              page 1 mostly blank whenever the table didn't fit under it. */}
          {showScope && (
            <div style={S.block}>
              <div data-pdf-block data-pdf-keep-next>
                <SectionTitle>PART {scopePart}: FUNCTIONAL SCOPE</SectionTitle>
              </div>
              {has(functionalScope) && (
              <table style={S.table}>
                <thead data-pdf-block data-pdf-keep-next>
                  <tr>
                    <th style={{ ...S.th, width: "19%" }}>Process</th>
                    <th style={S.th}>Description</th>
                    <th style={{ ...S.th, width: "21%", textAlign: "center" }}>Time Duration</th>
                  </tr>
                </thead>
                {/* One tbody per group of rows sharing a merged Time
                    Duration cell, so a merged cell is never split. */}
                {scopeGroups(withRowSpans(functionalScope!)).map((group, gi) => (
                  <tbody key={gi} data-pdf-block>
                    {group.map(({ row, rowSpan }, i) => (
                      <tr key={i}>
                        <td style={{ ...S.td, fontWeight: 700, color: NAVY }}>{row.stepLabel}</td>
                        <td style={S.td}>{row.description}</td>
                        {rowSpan > 0 && (
                          <td
                            style={{ ...S.td, textAlign: "center", verticalAlign: "middle" }}
                            rowSpan={rowSpan}
                          >
                            {row.timeDuration}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                ))}
                {/* keep-prev: the total never opens a page on its own. */}
                <tbody data-pdf-block data-pdf-keep-prev>
                  {totalTimeline?.trim() && (
                    <tr>
                      <td style={{ ...S.td, ...S.totalCell, textAlign: "right" }} colSpan={2}>
                        Total Timeline*
                      </td>
                      <td style={{ ...S.td, ...S.totalCell, textAlign: "center" }}>
                        {totalTimeline}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              )}
              {has(functionalScope) && totalTimeline?.trim() && (
                <div style={S.footnote} data-pdf-block>
                  * The timeline is subject to vary depending on the process involved.
                </div>
              )}

              {isAmc && has(basicAspects) && (
                <>
                  <h4 style={S.subTitle} data-pdf-block data-pdf-keep-next>Documentation Support</h4>
                  {basicAspects!.map((line, i) => (
                    <div key={i} style={S.bullet} data-pdf-block>{line}</div>
                  ))}
                </>
              )}
              {isAmc && has(workScope) && (
                <>
                  <h4 style={S.subTitle} data-pdf-block data-pdf-keep-next>AMC Scope of Work</h4>
                  {workScope!.map((line, i) => (
                    <div key={i} style={S.bullet} data-pdf-block>{line}</div>
                  ))}
                </>
              )}
            </div>
          )}

          {!isAmc && has(basicAspects) && (
            <div style={S.block}>
              <h4 style={S.subTitle} data-pdf-block data-pdf-keep-next>Basic Aspects</h4>
              {basicAspects!.map((line, i) => (
                <div key={i} style={S.bullet} data-pdf-block>{line}</div>
              ))}
            </div>
          )}

          {showCommercial && (
            <div style={S.block}>
              <div data-pdf-block data-pdf-keep-next>
                <SectionTitle>PART {commercialPart}: COMMERCIAL SCOPE</SectionTitle>
              </div>

              {commercialSections.map((section, si) => {
                const showLabels = hasColumnLabels(section.columns);

                return (
                  <div key={si} style={si > 0 ? S.sectionGap : undefined}>
                    {section.title && (
                      <h4 style={S.commercialSectionTitle} data-pdf-block data-pdf-keep-next>{section.title}</h4>
                    )}

                    <table style={S.table}>
                      <thead data-pdf-block data-pdf-keep-next>
                        <tr>
                          <th style={{ ...S.th, width: "22%" }}>Particulars</th>
                          {section.columns.map((col, ci) => (
                            <th
                              key={ci}
                              style={{ ...S.th, textAlign: showLabels ? "center" : "right" }}
                            >
                              {showLabels ? col || "—" : "Amount (INR)"}
                            </th>
                          ))}
                          {showCurrencyColumn && (
                            <th style={{ ...S.th, width: "12%", textAlign: "right" }}>USD</th>
                          )}
                          {anyRemarks && <th style={{ ...S.th, width: "21%" }}>Remarks</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row, ri) => (
                          <tr key={ri} data-pdf-block>
                            <td style={{ ...S.td, fontWeight: 700, color: NAVY }}>
                              {row.category}
                              {row.description && (
                                <div style={S.itemDescription}>{row.description}</div>
                              )}
                            </td>

                            {row.cells.map((cell, ci) => (
                              <td
                                key={ci}
                                style={{
                                  ...S.td,
                                  textAlign: "center",
                                  verticalAlign: "middle",
                                }}
                              >
                                {cell?.amountText?.trim()
                                  ? cell.amountText
                                  : cell?.amountInr
                                  ? `INR ${money(cell.amountInr)}`
                                  : ""}
                              </td>
                            ))}

                            {showCurrencyColumn && (
                              <td style={{ ...S.td, textAlign: "right", whiteSpace: "nowrap" }}>
                                {row.cells[0]?.amountUsd ? `$ ${money(row.cells[0]!.amountUsd!)}` : ""}
                              </td>
                            )}

                            {anyRemarks && (
                              <td style={{ ...S.td, fontSize: 9, color: "#334155" }}>
                                {row.remarks}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}

              {/* One total for the whole scope, not per section — the client
                  is being quoted a single figure however many product
                  families it is split across. */}
              <table style={{ ...S.table, marginTop: 10 }} data-pdf-block>
                <tbody>
                  <tr>
                    <td style={{ ...S.td, ...S.totalCell, textAlign: "right", width: "auto" }}>
                      TOTAL
                    </td>
                    <td
                      style={{ ...S.td, ...S.totalCell, textAlign: "right", width: "28%" }}
                    >
                      INR {money(totalInr)}
                      {showCurrencyColumn && totalUsd ? `  ·  $ ${money(totalUsd)}` : ""}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {has(paymentRatio) && (
            <div style={S.block} data-pdf-block>
              <h4 style={S.subTitle}>Payment Terms</h4>
              <table style={{ ...S.table, width: "62%" }}>
                <thead>
                  <tr>
                    <th style={S.th}>Payment Ratio</th>
                    <th style={S.th}>Payment Terms</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRatio!.map((row, i) => (
                    <tr key={i}>
                      <td style={S.td}>{row.label}</td>
                      <td style={{ ...S.td, fontWeight: 700, color: NAVY }}>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {has(terms) && (
            <div style={S.block}>
              <h4 style={S.subTitle} data-pdf-block data-pdf-keep-next>Terms &amp; Conditions</h4>
              {terms!.map((line, i) => (
                <div key={i} style={S.bullet} data-pdf-block>{line}</div>
              ))}
            </div>
          )}

          {showRequirements && (
            <div style={S.block}>
              <div data-pdf-block data-pdf-keep-next>
                <SectionTitle>PART {requirementsPart}: BASIC REQUIREMENTS</SectionTitle>
              </div>
              {/* Product sample table — laid out like the team's letters
                  (e.g. BEE offer 306): the heading is the table's first
                  row, then Product Name | Quantity Required, then the
                  remark as the last row, all inside one bordered table. */}
              {has(sampleRequirements) && (
                <div style={{ marginBottom: 12 }}>
                  <table style={S.table}>
                    <thead data-pdf-block data-pdf-keep-next>
                      <tr>
                        <th colSpan={2} style={{ ...S.th, textAlign: "left", fontSize: 11 }}>
                          {nextReqLetter()}. Product Sample required for {sampleScheme ? `${sampleScheme} ` : ""}Testing
                        </th>
                      </tr>
                      <tr>
                        <th style={{ ...S.th, textAlign: "left" }}>Product Name</th>
                        <th style={{ ...S.th, width: "35%", textAlign: "left" }}>Quantity Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sampleRequirements!.map((row, i) => (
                        <tr key={i} data-pdf-block>
                          <td style={S.td}>{row.productName}</td>
                          <td style={S.td}>{row.quantity}</td>
                        </tr>
                      ))}
                      {sampleRemark?.trim() && (
                        <tr data-pdf-block>
                          <td colSpan={2} style={S.td}>
                            {/^remark\s*:/i.test(sampleRemark.trim()) ? (
                              <>
                                <b>{sampleRemark.trim().slice(0, sampleRemark.trim().indexOf(":") + 1)}</b>
                                {sampleRemark.trim().slice(sampleRemark.trim().indexOf(":") + 1)}
                              </>
                            ) : (
                              <>
                                <b>Remark:</b> {sampleRemark.trim()}
                              </>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {has(sampleGuidelines) && (
                <div style={{ marginBottom: 12 }}>
                  <h4 style={S.subTitle} data-pdf-block data-pdf-keep-next>
                    {nextReqLetter()}. Product Sample Guidelines
                  </h4>
                  {sampleGuidelines!.map((line, i) => (
                    <div key={i} style={S.bullet} data-pdf-block>{line}</div>
                  ))}
                </div>
              )}

              {has(basicRequirements) && hasSampleBlocks && (
                <h4 style={S.subTitle} data-pdf-block data-pdf-keep-next>
                  {nextReqLetter()}. Documents Required from the Manufacturer
                </h4>
              )}
              {has(basicRequirements) && (
              <table style={S.table}>
                <tbody>
                  {basicRequirements!.map((doc, i) => (
                    <tr key={i} data-pdf-block>
                      <td style={{ ...S.td, width: "6%", textAlign: "center", fontWeight: 700, color: NAVY }}>
                        {i + 1}
                      </td>
                      <td style={S.td}>{doc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
              {basicRequirementsNote?.trim() && (
                <div style={S.footnote} data-pdf-block>{basicRequirementsNote}</div>
              )}
            </div>
          )}

          {showWorkScope && (
            <div style={S.block}>
              <div data-pdf-block data-pdf-keep-next>
                <SectionTitle>PART {workScopePart}: WORK SCOPE</SectionTitle>
              </div>
              {workScope!.map((line, i) => (
                <div key={i} style={S.bullet} data-pdf-block>{line}</div>
              ))}
            </div>
          )}

          {closingNote?.trim() && (
            <div style={S.block} data-pdf-block>
              {closingNote.split("\n").map((para, i) =>
                para.trim() ? <p key={i} style={S.para}>{para}</p> : null
              )}
            </div>
          )}

          {/* Signature, footer note and the closing band are one unit —
              splitting them stranded a lone footer line on its own page. */}
          <div data-pdf-block>
            <SignatureBlock />

            <div style={S.systemNote}>
              This document is generated by Standphill INDIA encrypted system software; valid without signature.
            </div>

            <CornerBand position="bottom" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Styles for the LMPC letter (see the LMPC branch above). Same sheet,
// letterhead, watermark and corner bands as every other quotation; the
// body text is Times New Roman like the team's LMPC letter (SI/LMPC/583).
const TIMES = "'Times New Roman', Times, serif";
const L: Record<string, React.CSSProperties> = {
  text: { fontFamily: TIMES, fontSize: 12.5, lineHeight: 1.5, color: "#111", margin: 0 },
  small: { fontFamily: TIMES, fontSize: 11, lineHeight: 1.6, color: "#111", margin: 0 },
  docHeading: { fontFamily: TIMES, fontSize: 14.5, fontWeight: 700, fontStyle: "italic", color: "#111", margin: "14px 0 8px" },
  docHeadingMain: { textDecoration: "underline" },
  docBullet: { fontFamily: TIMES, fontSize: 11.5, lineHeight: 1.45, color: "#111", paddingLeft: 22, position: "relative" },
  dot: { position: "absolute", left: 6, top: 0 },
  feesTitle: { fontFamily: TIMES, fontSize: 15, fontStyle: "italic", color: "#111", marginBottom: 12 },
  feeHead: { fontFamily: TIMES, fontSize: 12.5, fontWeight: 700, fontStyle: "italic", lineHeight: 1.6, color: "#111" },
  feeBullet: { fontFamily: TIMES, fontSize: 11, fontWeight: 700, fontStyle: "italic", lineHeight: 1.6, color: "#111", paddingLeft: 22, position: "relative" },
  signLine: { fontFamily: TIMES, fontSize: 12, fontWeight: 700, lineHeight: 1.45, color: "#111" },
  orange: { fontFamily: TIMES, fontWeight: 700, fontStyle: "italic", fontSize: 15, color: "#F26522", lineHeight: 1.3 },
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={S.partTitleWrap}>
      <div style={S.partTitleAccent} />
      <h3 style={S.partTitle}>{children}</h3>
    </div>
  );
}

// Inline styles rather than a stylesheet: html2canvas resolves computed
// styles at capture time, and inline rules are the ones least likely to
// be affected by whatever page the component is mounted on.
const S: Record<string, React.CSSProperties> = {
  doc: {
    width: `${A4_W}px`,
    background: "#ffffff",
    color: "#111827",
    fontFamily: "'Segoe UI', Calibri, Arial, sans-serif",
    fontSize: 11,
    lineHeight: 1.45,
    boxSizing: "border-box",
  },

  // Exactly one page tall so html2canvas's slice lands on the boundary
  // instead of cutting the signature in half.
  coverSheet: {
    position: "relative",
    width: `${A4_W}px`,
    height: `${A4_H}px`,
    padding: `0 ${PAD}px`,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    background: "#ffffff",
    overflow: "hidden",
  },
  bodySheet: {
    position: "relative",
    width: `${A4_W}px`,
    minHeight: `${A4_H}px`,
    padding: `0 ${PAD}px 20px`,
    boxSizing: "border-box",
    background: "#ffffff",
    overflow: "hidden",
  },
  layer: { position: "relative", zIndex: 1 },

  watermark: {
    position: "absolute",
    top: "42%",
    left: 0,
    right: 0,
    textAlign: "center",
    zIndex: 0,
    pointerEvents: "none",
  },
  watermarkName: {
    fontSize: 46,
    fontWeight: 800,
    letterSpacing: 3,
    color: "#F3F4F6",
  },
  watermarkTag: {
    fontSize: 17,
    letterSpacing: 2,
    color: "#F5F6F8",
    marginTop: 2,
  },

  cornerWrap: {
    position: "relative",
    height: 56,
    margin: `0 -${PAD}px`,
    overflow: "hidden",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  logo: { height: 64, objectFit: "contain" },
  headerRight: { textAlign: "right", maxWidth: "58%" },
  address: { fontSize: 10, fontWeight: 700, color: NAVY, lineHeight: 1.4 },
  contact: { fontSize: 10, fontWeight: 600, marginTop: 4, color: NAVY },
  headerRule: { height: 4, background: NAVY, margin: `10px -${PAD}px 14px` },

  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
    marginBottom: 14,
  },
  metaLeft: { fontSize: 10.5, lineHeight: 1.7, fontStyle: "italic" },
  metaRight: {
    fontSize: 10.5,
    lineHeight: 1.7,
    fontStyle: "italic",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  metaLabel: { fontWeight: 800, color: NAVY, fontStyle: "italic" },

  centerTitle: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: 800,
    color: NAVY,
    textDecoration: "underline",
    margin: "22px 0 20px",
    letterSpacing: 0.5,
  },
  // The originals set the covering letter in a serif italic, which is a
  // large part of why they read as a letter and not as a form.
  salutation: {
    fontFamily: "'Times New Roman', Georgia, serif",
    fontStyle: "italic",
    fontSize: 12.5,
    margin: "0 0 12px",
  },
  introPara: {
    fontFamily: "'Times New Roman', Georgia, serif",
    fontStyle: "italic",
    fontSize: 12,
    lineHeight: 1.55,
    margin: "0 0 11px",
    textAlign: "justify",
  },

  docPreTitle: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: 700,
    color: NAVY,
    letterSpacing: 0.6,
    margin: "4px 0 2px",
  },

  docTitle: {
    textAlign: "center",
    fontSize: 19,
    fontWeight: 800,
    color: NAVY,
    letterSpacing: 1.2,
    margin: "4px 0 14px",
  },

  block: { marginBottom: 16 },

  partTitleWrap: { display: "flex", alignItems: "center", gap: 7, marginBottom: 7 },
  partTitleAccent: { width: 5, height: 16, background: ORANGE },
  partTitle: {
    fontSize: 12.5,
    fontWeight: 800,
    fontStyle: "italic",
    color: NAVY,
    margin: 0,
    letterSpacing: 0.3,
  },
  subTitle: { fontSize: 11.5, fontWeight: 800, color: NAVY, margin: "0 0 6px" },

  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
  th: {
    border: `1px solid ${NAVY}`,
    padding: "7px 8px",
    background: "#E9EDF5",
    fontWeight: 800,
    fontSize: 10.5,
    color: NAVY,
    textAlign: "left",
  },
  td: {
    border: `1px solid ${NAVY}`,
    padding: "6px 8px",
    fontSize: 10.5,
    verticalAlign: "top",
    wordBreak: "break-word",
    background: "#ffffff",
  },
  labelCell: { background: "#F5F7FB", fontWeight: 800, color: NAVY },
  totalCell: { background: "#E9EDF5", fontWeight: 800, color: NAVY },

  sectionGap: { marginTop: 14 },
  commercialSectionTitle: {
    fontSize: 11.5,
    fontWeight: 800,
    fontStyle: "italic",
    color: NAVY,
    margin: "0 0 5px",
    textDecoration: "underline",
  },
  itemDescription: {
    fontWeight: 400,
    fontSize: 9.5,
    color: "#334155",
    marginTop: 2,
  },

  bullet: { margin: "0 0 4px", paddingLeft: 12 },
  para: { margin: "0 0 9px", textAlign: "justify" },
  footnote: { fontSize: 9, marginTop: 4, color: "#5A6B85", fontStyle: "italic" },

  signBlock: { marginTop: 24, fontSize: 10.5 },
  signRegards: { marginBottom: 2, fontStyle: "italic", color: NAVY },
  signature: { height: 44, objectFit: "contain", display: "block", margin: "2px 0" },
  signName: { fontWeight: 800, color: "#C0392B", fontSize: 12 },
  signRole: { fontStyle: "italic", fontWeight: 700, color: "#C0392B" },
  signPhone: { marginTop: 3, fontWeight: 700, color: NAVY },

  systemNote: { marginTop: 16, textAlign: "center", fontSize: 8.5, color: "#7A8699" },
};