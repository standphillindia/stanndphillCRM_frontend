// src/utils/downloadQuotation.ts
//
// PDF export that breaks pages *between* blocks instead of straight through
// them.
//
// downloadElementAsPdf (used by the invoices) rasterises the element and
// then slices the bitmap at fixed A4 intervals. It has no idea what's at
// those intervals, so a table or a signature sitting on the boundary gets
// cut in half — which is exactly what was happening to the quotation's
// Payment Terms table.
//
// This version measures where each block actually sits before slicing, and
// moves the cut up to the nearest block edge. Any element carrying
// data-pdf-block is treated as indivisible.
//
// Long sections (the scope tables, bullet lists) are not one block — each
// row or bullet is, so a long table flows across pages row by row instead
// of jumping whole to the next page and leaving most of the previous one
// blank. data-pdf-keep-next marks headings and table headers that must
// travel with the row after them; data-pdf-keep-prev marks totals that
// must stay with the row before them.

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/** A4 aspect ratio — page height as a multiple of page width. */
const A4_RATIO = 297 / 210;

/**
 * Leftovers smaller than this (in CSS px) are trailing margin, not content.
 * Without the tolerance a sub-pixel remainder still counted as "more to
 * render" and jsPDF emitted a blank final page.
 */
const TAIL_TOLERANCE_PX = 6;

/**
 * A block taller than this fraction of a page can't be kept whole — there
 * is nowhere to move it to. Those get split as before, which is the right
 * call: a 60-row table has to break somewhere.
 */
const MAX_KEEP_WHOLE = 0.95;

interface Block {
  top: number;
  bottom: number;
}

/**
 * Positions of every [data-pdf-block] descendant, in CSS px relative to the
 * top of the container. getBoundingClientRect rather than offsetTop, so
 * nesting and transforms don't throw the numbers off.
 */
function measureBlocks(container: HTMLElement, selector = "[data-pdf-block]"): Block[] {
  const containerTop = container.getBoundingClientRect().top;

  return Array.from(container.querySelectorAll<HTMLElement>(selector))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top - containerTop, bottom: r.bottom - containerTop };
    })
    .filter((b) => b.bottom > b.top)
    .sort((a, b) => a.top - b.top);
}

/**
 * A heading or table header ending this close above the cut is treated as
 * sitting at the bottom of the page, and goes to the next page with the
 * row that follows it.
 */
const KEEP_NEXT_GAP_PX = 24;

/**
 * White space kept at the top of every page after the first and at the
 * bottom of every page, in CSS px. Page 1 keeps its letterhead band flush
 * with the top edge. Without this, a table continuing onto a new page was
 * glued to the paper's edge.
 */
const PAGE_TOP_MARGIN_PX = 32;
const PAGE_BOTTOM_MARGIN_PX = 28;

/**
 * Works out where each page should end.
 *
 * Walks down the document a page at a time. If the natural cut lands inside
 * a block, the cut moves up to that block's top edge so the block travels
 * whole to the next page. The white space left behind is the price of not
 * slicing a table through the middle.
 */
function planPageBreaks(
  totalHeight: number,
  pageHeight: number,
  blocks: Block[],
  keepNext: Block[] = [],
  keepPrev: Block[] = []
): number[] {
  const breaks: number[] = [];
  let cursor = 0;

  let guard = 0;
  while (cursor < totalHeight - TAIL_TOLERANCE_PX && guard++ < 200) {
    // How much content fits on this page once its margins are taken out.
    const capacity =
      pageHeight - PAGE_BOTTOM_MARGIN_PX - (breaks.length > 0 ? PAGE_TOP_MARGIN_PX : 0);
    const naturalEnd = cursor + capacity;

    if (naturalEnd >= totalHeight) {
      breaks.push(totalHeight);
      break;
    }

    // The block, if any, that the natural cut would slice through.
    const straddling = blocks.find(
      (b) => b.top < naturalEnd - 1 && b.bottom > naturalEnd + 1
    );

    let cut = naturalEnd;

    if (straddling) {
      const blockHeight = straddling.bottom - straddling.top;
      const startsOnThisPage = straddling.top > cursor + 1;

      // Only push it down if it will actually fit on a page of its own.
      // A block that is itself taller than a page has to be split, and a
      // block already starting at the top of this page has nowhere to go.
      if (startsOnThisPage && blockHeight <= capacity * MAX_KEEP_WHOLE) {
        cut = straddling.top;
      }
    }

    // A section title or table header must not be the last thing on a
    // page. Pull the cut up above it (repeatedly: title, then thead).
    for (let i = 0; i < 4; i++) {
      const orphan = keepNext.find(
        (k) => k.top > cursor + 1 && k.top < cut && k.bottom <= cut + 1 && cut - k.bottom <= KEEP_NEXT_GAP_PX
      );
      if (!orphan) break;
      cut = orphan.top;
    }

    // A total row must not open a page alone: take the row above with it.
    if (keepPrev.some((k) => Math.abs(k.top - cut) <= 2)) {
      const above = blocks
        .filter((b) => b.bottom <= cut + 2 && b.bottom >= cut - 4 && b.top > cursor + 1)
        .sort((a, b) => b.top - a.top)[0];
      if (above) cut = above.top;
    }

    // Never emit a zero-height or backwards page.
    if (cut <= cursor + 1) cut = naturalEnd;

    breaks.push(cut);
    cursor = cut;
  }

  if (breaks.length === 0) breaks.push(totalHeight);
  return breaks;
}

/**
 * How far (CSS px) a cut may move up to find a clean gap between lines.
 * A line of text here is ~16px, so this always reaches the gap above the
 * line it would have sliced.
 */
const SNAP_SEARCH_PX = 40;

/** A pixel this dark counts as ink (text, borders); watermark tint does not. */
const INK_LUMA = 170;

/**
 * Last line of defence against a cut through text.
 *
 * The planned cut comes from measuring the page layout, but what ends up
 * in the picture can sit a few pixels off (fonts, images still loading,
 * the preview being scrolled). So look at the actual picture: in the band
 * just above the cut, pick the pixel row with the least ink — the white
 * gap between two lines — and cut there instead.
 */
function snapToWhitespace(
  canvas: HTMLCanvasElement,
  breaksCss: number[],
  pxRatio: number
): number[] {
  const ctx = canvas.getContext("2d");
  if (!ctx) return breaksCss;

  const out: number[] = [];
  let prev = 0;
  breaksCss.forEach((cutCss, i) => {
    // The last break is the end of the document — nothing to snap.
    if (i === breaksCss.length - 1) {
      out.push(cutCss);
      return;
    }
    const bottomPx = Math.round(cutCss * pxRatio);
    const searchPx = Math.round(SNAP_SEARCH_PX * pxRatio);
    const topPx = Math.max(Math.round((prev + 40) * pxRatio), bottomPx - searchPx);
    if (bottomPx - topPx < 2) {
      out.push(cutCss);
      prev = cutCss;
      return;
    }

    let data: Uint8ClampedArray;
    try {
      data = ctx.getImageData(0, topPx, canvas.width, bottomPx - topPx + 1).data;
    } catch {
      out.push(cutCss); // tainted canvas — keep the planned cut
      prev = cutCss;
      return;
    }

    const w = canvas.width;
    let bestRow = bottomPx - topPx;
    let bestInk = Number.POSITIVE_INFINITY;
    // Bottom-up, so ties keep the cut as low as possible (least white space).
    for (let r = bottomPx - topPx; r >= 0; r--) {
      let ink = 0;
      const base = r * w * 4;
      for (let x = 0; x < w; x += 2) {
        const o = base + x * 4;
        const luma = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
        if (luma < INK_LUMA) ink++;
      }
      if (ink < bestInk) {
        bestInk = ink;
        bestRow = r;
        if (ink === 0) break; // a fully clean row — can't do better
      }
    }

    const snapped = (topPx + bestRow) / pxRatio;
    out.push(snapped);
    prev = snapped;
  });
  return out;
}

export async function downloadQuotationPdf(
  elementId: string,
  fileName: string = "quotation.pdf"
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found.`);
  }

  const cssWidth = element.offsetWidth;
  let cssHeight = element.scrollHeight;
  const pageHeightCss = cssWidth * A4_RATIO;

  // Measured on the live page first, then again inside html2canvas's own
  // copy (onclone) — that copy is what actually gets drawn, so its
  // positions win. Measuring only the live page let a cut land a few
  // pixels off and slice a line of text in half.
  let blocks = measureBlocks(element);
  let keepNext = measureBlocks(element, "[data-pdf-keep-next]");
  let keepPrev = measureBlocks(element, "[data-pdf-keep-prev]");

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: -window.scrollY,
    windowWidth: element.scrollWidth,
    onclone: (_doc, clonedElement) => {
      try {
        const cloned = measureBlocks(clonedElement);
        if (cloned.length > 0) {
          blocks = cloned;
          keepNext = measureBlocks(clonedElement, "[data-pdf-keep-next]");
          keepPrev = measureBlocks(clonedElement, "[data-pdf-keep-prev]");
          cssHeight = clonedElement.scrollHeight || cssHeight;
        }
      } catch {
        /* keep the live-page measurements */
      }
    },
  });

  // Canvas pixels per CSS pixel — html2canvas's own scale, not assumed.
  const pxRatio = canvas.height / cssHeight;

  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const breaks = snapToWhitespace(
    canvas,
    planPageBreaks(cssHeight, pageHeightCss, blocks, keepNext, keepPrev),
    pxRatio
  );

  let sliceTopCss = 0;

  breaks.forEach((breakAtCss, pageIndex) => {
    const sliceHeightCss = breakAtCss - sliceTopCss;
    if (sliceHeightCss <= TAIL_TOLERANCE_PX) return;

    const sy = Math.round(sliceTopCss * pxRatio);
    const sh = Math.round(sliceHeightCss * pxRatio);

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sh;

    const ctx = pageCanvas.getContext("2d");
    if (!ctx) return;

    // Paint the background first: a short page would otherwise carry a
    // transparent tail that prints as grey.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);

    // Keep the scale identical on every page — the slice is anchored to the
    // top, so a short page simply leaves white space at the bottom rather
    // than stretching to fill it. Pages after the first start below a
    // top margin.
    const mmPerCss = pdfWidth / cssWidth;
    const topMm = pageIndex > 0 ? PAGE_TOP_MARGIN_PX * mmPerCss : 0;
    const imgHeight = (sh * pdfWidth) / canvas.width;

    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(
      pageCanvas.toDataURL("image/png"),
      "PNG",
      0,
      topMm,
      pdfWidth,
      Math.min(imgHeight, pdfHeight - topMm),
      undefined,
      "FAST"
    );

    sliceTopCss = breakAtCss;
  });

  pdf.save(fileName);
}

export default downloadQuotationPdf;