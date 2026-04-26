import jsPDF from "jspdf";
import { saveAs } from "file-saver";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  AlignmentType,
  PageBreak,
} from "docx";
import { experimentData } from "@/data/experiments";

const SLATE = "0F172A";
const INDIGO = "4F46E5";
const MUTED = "64748B";
const BORDER = "CBD5E1";
const HEADER_FILL = "EEF2FF";

// ---------- PDF ----------

export function exportPdf() {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const text = (
    str: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: [number, number, number];
      gap?: number;
      indent?: number;
    } = {},
  ) => {
    const size = opts.size ?? 10;
    const color = opts.color ?? [15, 23, 42];
    const indent = opts.indent ?? 0;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(str, contentWidth - indent);
    for (const line of lines) {
      ensureSpace(size + 4);
      doc.text(line, margin + indent, y);
      y += size + 4;
    }
    y += opts.gap ?? 0;
  };

  const sectionTitle = (title: string) => {
    ensureSpace(22);
    y += 2;
    text(title.toUpperCase(), { size: 11, bold: true, color: [79, 70, 229], gap: 4 });
  };

  const hr = () => {
    ensureSpace(10);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
  };

  // Header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("THE AI SCIENTIST", margin, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(165, 180, 252);
  doc.text("Experiment Plan · Executive Briefing", margin, 46);
  doc.setTextColor(226, 232, 240);
  doc.setFontSize(8);
  doc.text(
    `${experimentData.project.id}  ·  ${new Date().toLocaleDateString()}`,
    pageWidth - margin,
    30,
    { align: "right" },
  );
  doc.text(`Status: ${experimentData.project.status}`, pageWidth - margin, 46, {
    align: "right",
  });
  y = 90;

  // Hypothesis
  text("HYPOTHESIS", { size: 9, bold: true, color: [100, 116, 139], gap: 2 });
  text(experimentData.project.hypothesis, { size: 12, bold: true, gap: 6 });
  text(
    `Principal Investigator: ${experimentData.project.pi}   ·   Created: ${experimentData.project.created}`,
    { size: 9, color: [100, 116, 139], gap: 8 },
  );
  hr();

  // Key metrics
  sectionTitle("Key Metrics");
  const metrics: [string, string][] = [
    ["Total Estimated Cost", `${experimentData.currency}${experimentData.totalCost.toLocaleString()}`],
    ["Novelty Score", `${experimentData.noveltyScore}%  (${experimentData.noveltySignal})`],
    ["Duration", "10 weeks"],
    ["Animal model", "Humanized C57BL/6"],
    ["Cohort size", "n = 24 / group"],
  ];
  metrics.forEach(([k, v]) => {
    ensureSpace(16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(k, margin, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(v, pageWidth - margin, y, { align: "right" });
    y += 14;
  });
  y += 4;
  hr();

  // Executive Summary
  sectionTitle("Executive Summary");
  text(experimentData.executiveSummary, { size: 10, gap: 8 });
  hr();

  // Budget
  sectionTitle("Budget Breakdown");
  experimentData.budget.forEach((b) => {
    ensureSpace(14);
    const pct = ((b.value / experimentData.totalCost) * 100).toFixed(1);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(b.category, margin, y);
    doc.setFont("helvetica", "bold");
    doc.text(
      `${experimentData.currency}${b.value.toLocaleString()}  (${pct}%)`,
      pageWidth - margin,
      y,
      { align: "right" },
    );
    y += 14;
  });
  y += 4;
  hr();

  // Protocol table
  sectionTitle("Protocol Designer");
  const cols = [
    { key: "step", label: "#", w: 24 },
    { key: "title", label: "Step", w: 130 },
    { key: "phase", label: "Phase", w: 70 },
    { key: "duration", label: "Duration", w: 70 },
    { key: "safety", label: "Safety", w: 60 },
    { key: "notes", label: "Notes", w: contentWidth - 24 - 130 - 70 - 70 - 60 },
  ] as const;

  // header row
  ensureSpace(20);
  doc.setFillColor(238, 242, 255);
  doc.rect(margin, y - 10, contentWidth, 16, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  let x = margin + 4;
  cols.forEach((c) => {
    doc.text(c.label.toUpperCase(), x, y);
    x += c.w;
  });
  y += 10;

  experimentData.protocol.forEach((p) => {
    const cells = cols.map((c) => String((p as Record<string, unknown>)[c.key] ?? ""));
    const wrapped = cells.map((txt, i) =>
      doc.splitTextToSize(txt, cols[i].w - 6),
    );
    const rowHeight = Math.max(...wrapped.map((w) => w.length)) * 11 + 6;
    ensureSpace(rowHeight + 4);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y - 4, pageWidth - margin, y - 4);
    let cx = margin + 4;
    wrapped.forEach((lines, i) => {
      doc.setFont("helvetica", i === 1 ? "bold" : "normal");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      lines.forEach((ln: string, li: number) => {
        doc.text(ln, cx, y + li * 10);
      });
      cx += cols[i].w;
    });
    y += rowHeight;
  });
  y += 6;
  hr();

  // Materials
  sectionTitle("Materials & Sourcing");
  experimentData.materials.forEach((m) => {
    ensureSpace(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(m.name, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(
      `${m.catalog} · ${m.vendor} · Qty ${m.qty} · ${experimentData.currency}${(m.unitCost * m.qty).toFixed(2)}`,
      margin,
      y + 11,
    );
    y += 24;
  });
  hr();

  // References
  sectionTitle("Literature & Grounding");
  experimentData.references.forEach((r, idx) => {
    ensureSpace(34);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const titleLines = doc.splitTextToSize(`${idx + 1}. ${r.title}`, contentWidth);
    titleLines.forEach((ln: string, li: number) => {
      doc.text(ln, margin, y + li * 11);
    });
    y += titleLines.length * 11;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${r.authors} · ${r.journal}`, margin, y + 2);
    doc.setTextColor(79, 70, 229);
    doc.text(`doi:${r.doi}`, margin, y + 13);
    doc.setTextColor(16, 185, 129);
    doc.text(`Relevance ${r.relevance}%`, pageWidth - margin, y + 13, {
      align: "right",
    });
    y += 22;
  });

  // Footer page numbers
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `The AI Scientist · ${experimentData.project.id}`,
      margin,
      pageHeight - 18,
    );
    doc.text(`Page ${i} of ${total}`, pageWidth - margin, pageHeight - 18, {
      align: "right",
    });
  }

  doc.save(`${experimentData.project.id}-experiment-plan.pdf`);
}

// ---------- DOCX ----------

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
const cellBorders = {
  top: cellBorder,
  bottom: cellBorder,
  left: cellBorder,
  right: cellBorder,
};

function p(text: string, opts: { bold?: boolean; size?: number; color?: string; spacingAfter?: number } = {}) {
  return new Paragraph({
    spacing: { after: opts.spacingAfter ?? 80 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        size: opts.size ?? 20,
        color: opts.color ?? SLATE,
        font: "Calibri",
      }),
    ],
  });
}

function sectionHeading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: INDIGO, font: "Calibri" }),
    ],
  });
}

function metaRow(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 60 },
    tabStops: [{ type: "right" as const, position: 9000 }],
    children: [
      new TextRun({ text: label, size: 20, color: MUTED, font: "Calibri" }),
      new TextRun({ text: `\t${value}`, bold: true, size: 20, color: SLATE, font: "Calibri" }),
    ],
  });
}

function headerCell(text: string, width: number) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: HEADER_FILL, type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: text.toUpperCase(), bold: true, size: 16, color: INDIGO, font: "Calibri" }),
        ],
      }),
    ],
  });
}

function bodyCell(text: string, width: number, opts: { bold?: boolean } = {}) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 18, bold: opts.bold, color: SLATE, font: "Calibri" })],
      }),
    ],
  });
}

export async function exportDocx() {
  // Title block
  const children: Array<Paragraph | Table> = [];

  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "THE AI SCIENTIST", bold: true, size: 28, color: SLATE, font: "Calibri" }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `Experiment Plan · ${experimentData.project.id} · Status: ${experimentData.project.status}`,
          size: 18,
          color: MUTED,
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "HYPOTHESIS", bold: true, size: 16, color: MUTED, font: "Calibri" }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: experimentData.project.hypothesis, bold: true, size: 24, color: SLATE, font: "Calibri" }),
      ],
    }),
  );

  // Key metrics
  children.push(sectionHeading("Key Metrics"));
  children.push(
    metaRow("Total Estimated Cost", `${experimentData.currency}${experimentData.totalCost.toLocaleString()}`),
    metaRow("Novelty Score", `${experimentData.noveltyScore}% — ${experimentData.noveltySignal}`),
    metaRow("Principal Investigator", experimentData.project.pi),
    metaRow("Duration", "10 weeks"),
    metaRow("Animal model", "Humanized C57BL/6"),
    metaRow("Cohort size", "n = 24 / group"),
  );

  // Executive summary
  children.push(sectionHeading("Executive Summary"));
  children.push(p(experimentData.executiveSummary, { size: 20, spacingAfter: 200 }));

  // Budget
  children.push(sectionHeading("Budget Breakdown"));
  experimentData.budget.forEach((b) => {
    const pct = ((b.value / experimentData.totalCost) * 100).toFixed(1);
    children.push(
      metaRow(b.category, `${experimentData.currency}${b.value.toLocaleString()}  (${pct}%)`),
    );
  });

  // Protocol
  children.push(sectionHeading("Protocol Designer"));
  const widths = [600, 2200, 1200, 1200, 1000, 2960];
  const tableWidth = widths.reduce((a, b) => a + b, 0);
  const headers = ["#", "Step", "Phase", "Duration", "Safety", "Notes"];
  const protocolRows = [
    new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => headerCell(h, widths[i])),
    }),
    ...experimentData.protocol.map(
      (s) =>
        new TableRow({
          children: [
            bodyCell(String(s.step), widths[0]),
            bodyCell(s.title, widths[1], { bold: true }),
            bodyCell(s.phase, widths[2]),
            bodyCell(s.duration, widths[3]),
            bodyCell(s.safety, widths[4]),
            bodyCell(s.notes, widths[5]),
          ],
        }),
    ),
  ];
  children.push(
    new Table({
      width: { size: tableWidth, type: WidthType.DXA },
      columnWidths: widths,
      rows: protocolRows,
    }),
  );

  // Materials
  children.push(sectionHeading("Materials & Sourcing"));
  const matWidths = [3500, 2400, 1400, 1860];
  const matTotal = matWidths.reduce((a, b) => a + b, 0);
  children.push(
    new Table({
      width: { size: matTotal, type: WidthType.DXA },
      columnWidths: matWidths,
      rows: [
        new TableRow({
          tableHeader: true,
          children: ["Item", "Catalog / Vendor", "Qty", "Subtotal"].map((h, i) =>
            headerCell(h, matWidths[i]),
          ),
        }),
        ...experimentData.materials.map(
          (m) =>
            new TableRow({
              children: [
                bodyCell(m.name, matWidths[0], { bold: true }),
                bodyCell(`${m.catalog} · ${m.vendor}`, matWidths[1]),
                bodyCell(String(m.qty), matWidths[2]),
                bodyCell(
                  `${experimentData.currency}${(m.unitCost * m.qty).toFixed(2)}`,
                  matWidths[3],
                ),
              ],
            }),
        ),
      ],
    }),
  );

  // References
  children.push(sectionHeading("Literature & Grounding"));
  experimentData.references.forEach((r, idx) => {
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: `${idx + 1}. ${r.title}`, bold: true, size: 20, color: SLATE, font: "Calibri" }),
        ],
      }),
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({ text: `${r.authors} · ${r.journal}  ·  `, size: 18, color: MUTED, font: "Calibri" }),
          new TextRun({ text: `doi:${r.doi}`, size: 18, color: INDIGO, font: "Calibri" }),
          new TextRun({ text: `   ·   Relevance ${r.relevance}%`, size: 18, color: "10B981", font: "Calibri" }),
        ],
      }),
    );
  });

  const doc = new Document({
    creator: "The AI Scientist",
    title: experimentData.project.name,
    styles: {
      default: { document: { run: { font: "Calibri", size: 20 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${experimentData.project.id}-experiment-plan.docx`);
}

// Backward-compatible names used by header actions.
export function exportPlanAsPDF(_args?: { title?: string; content?: string }) {
  exportPdf();
}

export async function exportPlanAsDOCX(_args?: { title?: string; content?: string }) {
  await exportDocx();
}
