import { jsPDF, GState } from "jspdf";
import type { BoardWidget } from "./types";

const PADDING = 32;
const HEADER_H = 26;

function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

function defaultTitle(widget: BoardWidget): string {
  if (widget.title) return widget.title;
  if (widget.content.kind === "kpi") return widget.content.kpi.label;
  if (widget.content.kind === "chart") return widget.content.chart.title;
  return "Nota";
}

/**
 * Draws the board directly with jsPDF's vector primitives instead of
 * rasterizing the DOM (html2canvas): crisp text, tiny file size, no layout
 * wait. Charts are the one raster piece — grabbed straight from the live
 * <canvas> Chart.js already painted, so no extra render pass is needed.
 */
export function exportBoardToPdf(widgets: BoardWidget[], background: string, fileName: string) {
  if (widgets.length === 0) return;

  const minX = Math.min(...widgets.map((w) => w.x));
  const minY = Math.min(...widgets.map((w) => w.y));
  const maxX = Math.max(...widgets.map((w) => w.x + w.w));
  const maxY = Math.max(...widgets.map((w) => w.y + w.h));

  const pageW = maxX - minX + PADDING * 2;
  const pageH = maxY - minY + PADDING * 2;

  const pdf = new jsPDF({
    orientation: pageW >= pageH ? "landscape" : "portrait",
    unit: "px",
    format: [pageW, pageH],
    compress: true,
  });

  const pageBg = hexToRgba(background);
  pdf.setFillColor(pageBg.r, pageBg.g, pageBg.b);
  pdf.rect(0, 0, pageW, pageH, "F");

  for (const widget of widgets) {
    const x = widget.x - minX + PADDING;
    const y = widget.y - minY + PADDING;
    const { w, h } = widget;
    const isPlainText = widget.content.kind === "text" && !widget.background;

    let contentTop = y + 8;
    const contentX = x + 14;
    const contentW = w - 28;

    if (!isPlainText) {
      const card = hexToRgba(widget.background ?? "#ffffffff");
      pdf.setFillColor(card.r, card.g, card.b);
      pdf.setDrawColor(227, 226, 232);
      pdf.setLineWidth(1);
      if (card.a < 1) pdf.setGState(new GState({ opacity: card.a }));
      pdf.roundedRect(x, y, w, h, 10, 10, "FD");
      if (card.a < 1) pdf.setGState(new GState({ opacity: 1 }));

      pdf.setTextColor(107, 107, 124);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(defaultTitle(widget), contentX, y + 18, { maxWidth: contentW });
      contentTop = y + HEADER_H;
    }

    const contentH = h - (contentTop - y) - 10;

    if (widget.content.kind === "kpi") {
      pdf.setTextColor(23, 23, 42);
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text(widget.content.kpi.value, contentX, contentTop + 26, { maxWidth: contentW });
    } else if (widget.content.kind === "text") {
      pdf.setTextColor(23, 23, 42);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(widget.content.text, contentX, contentTop + 12, { maxWidth: contentW });
    } else if (widget.content.kind === "chart") {
      const canvas = document.querySelector<HTMLCanvasElement>(`[data-chart-widget="${widget.id}"] canvas`);
      if (canvas) {
        const imgData = canvas.toDataURL("image/png", 1.0);
        pdf.addImage(imgData, "PNG", contentX, contentTop, contentW, Math.max(0, contentH));
      }
    }
  }

  pdf.save(fileName);
}
