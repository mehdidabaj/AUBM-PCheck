import { jsPDF } from "jspdf";
import type { PcTodoFiche } from "./types";

function formatDate(value: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function buildPdf(fiche: PcTodoFiche) {
  const doc = new jsPDF();
  let y = 20;

  doc.setTextColor(15, 118, 110);
  doc.setFontSize(11);
  doc.text("AUBM PCHECK", 20, y);
  y += 8;
  doc.setTextColor(20, 32, 51);
  doc.setFontSize(18);
  doc.text("Fiche Todo PC", 20, y);
  y += 10;
  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(0.8);
  doc.line(20, y, 190, y);
  y += 12;

  const rows: Array<[string, string]> = [
    ["Version du Todo PC", fiche.version],
    ["Propriétaire du PC", fiche.owner],
    ["Nom complet du PC", fiche.pcName],
    ["Date de début", formatDate(fiche.startDate)],
    [
      "Date de fin",
      fiche.endDate ? formatDate(fiche.endDate) : "En cours",
    ],
  ];

  doc.setFontSize(11);
  for (const [label, value] of rows) {
    doc.setFillColor(243, 247, 250);
    doc.rect(20, y - 5, 60, 9, "F");
    doc.setDrawColor(213, 222, 232);
    doc.rect(20, y - 5, 170, 9);
    doc.text(label, 22, y);
    doc.text(value, 84, y);
    y += 11;
  }

  y += 8;
  doc.setFontSize(13);
  doc.text("Checklist des tâches", 20, y);
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(90, 100, 120);
  const done = fiche.tasks.filter((t) => t.done).length;
  doc.text(`${done} / ${fiche.tasks.length} tâches cochées`, 20, y);
  y += 8;
  doc.setTextColor(20, 32, 51);

  if (!fiche.tasks.length) {
    doc.text("Aucune tâche", 20, y);
  } else {
    for (const task of fiche.tasks) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      const mark = task.done ? "[x]" : "[ ]";
      doc.text(`${mark}  ${task.text}`, 20, y, { maxWidth: 170 });
      y += 8;
    }
  }

  return doc;
}

export function downloadPdf(fiche: PcTodoFiche) {
  const doc = buildPdf(fiche);
  const name = `TodoPC_${fiche.pcName || "fiche"}_${fiche.version || "v"}.pdf`
    .replace(/[^\w.-]+/g, "_");
  doc.save(name);
}

export function printPdf(fiche: PcTodoFiche) {
  const doc = buildPdf(fiche);
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}
