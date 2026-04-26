import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import html2canvas from "html2canvas";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportPlanAsPDF(args: { title: string; content: string }) {
  const reportNode = document.getElementById("report-export-root");
  if (reportNode) {
    void exportReportNodeAsPDF(reportNode, args.title);
    return;
  }
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  let y = 44;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(args.title, 40, y);
  y += 22;
  const lines = args.content.split("\n");
  for (const raw of lines) {
    const line = raw.trimEnd();
    const isSection = line.endsWith(":") && !line.startsWith("-") && line.length < 40;
    pdf.setFont("helvetica", isSection ? "bold" : "normal");
    pdf.setFontSize(isSection ? 12 : 10);
    const wrapped = pdf.splitTextToSize(line || " ", 515);
    for (const w of wrapped) {
      if (y > 800) {
        pdf.addPage();
        y = 40;
      }
      pdf.text(w, line.startsWith("- ") ? 52 : 40, y);
      y += isSection ? 16 : 13;
    }
    y += isSection ? 4 : 1;
  }
  const blob = pdf.output("blob");
  downloadBlob(blob, `${safeName(args.title)}.pdf`);
}

export async function exportPlanAsDOCX(args: { title: string; content: string }) {
  const lines = args.content.split("\n");
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: args.title, bold: true, size: 30 })],
          }),
          ...lines.map(line => {
            const isSection = line.endsWith(":") && !line.startsWith("-") && line.length < 40;
            if (line.startsWith("- ")) {
              return new Paragraph({
                bullet: { level: 0 },
                children: [new TextRun({ text: line.slice(2) })],
              });
            }
            return new Paragraph({
              spacing: { before: isSection ? 180 : 40, after: isSection ? 80 : 20 },
              children: [new TextRun({ text: line || " ", bold: isSection })],
            });
          }),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${safeName(args.title)}.docx`);
}

function safeName(s: string) {
  return (s || "plan").replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "_").slice(0, 60) || "plan";
}

async function exportReportNodeAsPDF(node: HTMLElement, title: string) {
  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let yOffset = 0;
  let remaining = imgHeight;
  while (remaining > 0) {
    const pageCanvas = document.createElement("canvas");
    const pageCanvasHeightPx = Math.floor((canvas.width * (pageHeight - margin * 2)) / imgWidth);
    pageCanvas.width = canvas.width;
    pageCanvas.height = Math.min(pageCanvasHeightPx, canvas.height - yOffset);
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(
      canvas,
      0, yOffset, pageCanvas.width, pageCanvas.height,
      0, 0, pageCanvas.width, pageCanvas.height
    );
    const pageImg = pageCanvas.toDataURL("image/png");
    const drawHeight = (pageCanvas.height * imgWidth) / pageCanvas.width;
    pdf.addImage(pageImg, "PNG", margin, margin, imgWidth, drawHeight);
    yOffset += pageCanvas.height;
    remaining -= drawHeight;
    if (remaining > 0) pdf.addPage();
  }

  const blob = pdf.output("blob");
  downloadBlob(blob, `${safeName(title)}.pdf`);
}

