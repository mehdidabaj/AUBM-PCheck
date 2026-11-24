import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../models/pc_todo_fiche.dart';

class PdfService {
  final _dateFormat = DateFormat('dd/MM/yyyy');

  Future<void> exportOrPrint(PcTodoFiche fiche, {required bool printDirect}) async {
    final doc = await _build(fiche);
    if (printDirect) {
      await Printing.layoutPdf(onLayout: (_) async => doc.save());
      return;
    }

    final bytes = await doc.save();
    final name = 'TodoPC_${_safe(fiche.pcName)}_${_safe(fiche.version)}.pdf';

    if (kIsWeb) {
      await Printing.sharePdf(bytes: bytes, filename: name);
      return;
    }

    await Printing.sharePdf(bytes: bytes, filename: name);
  }

  Future<pw.Document> _build(PcTodoFiche fiche) async {
    final doc = pw.Document();
    final done = fiche.doneCount;

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(40),
        build: (context) => [
          pw.Text(
            'AUBM PCHECK',
            style: pw.TextStyle(
              color: PdfColor.fromHex('#0F766E'),
              fontSize: 11,
              fontWeight: pw.FontWeight.bold,
              letterSpacing: 1.2,
            ),
          ),
          pw.SizedBox(height: 4),
          pw.Text(
            'Fiche Todo PC',
            style: pw.TextStyle(fontSize: 22, fontWeight: pw.FontWeight.bold),
          ),
          pw.Container(
            margin: const pw.EdgeInsets.only(top: 8, bottom: 18),
            height: 2,
            color: PdfColor.fromHex('#0F766E'),
          ),
          _metaRow('Version du Todo PC', fiche.version),
          _metaRow('Propriétaire du PC', fiche.owner),
          _metaRow('Nom complet du PC', fiche.pcName),
          _metaRow(
            'Date de début de préparation',
            fiche.startDate == null ? '—' : _dateFormat.format(fiche.startDate!),
          ),
          _metaRow(
            'Date de fin de préparation',
            fiche.endDate == null ? 'En cours' : _dateFormat.format(fiche.endDate!),
          ),
          pw.SizedBox(height: 18),
          pw.Text(
            'Checklist des tâches',
            style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 4),
          pw.Text('$done / ${fiche.totalCount} tâches cochées'),
          pw.SizedBox(height: 10),
          if (fiche.tasks.isEmpty)
            pw.Text('Aucune tâche')
          else
            ...fiche.tasks.map(
              (t) => pw.Container(
                margin: const pw.EdgeInsets.only(bottom: 6),
                padding: const pw.EdgeInsets.all(8),
                decoration: pw.BoxDecoration(
                  border: pw.Border.all(color: PdfColors.grey300),
                ),
                child: pw.Row(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text(t.done ? '☑' : '☐', style: const pw.TextStyle(fontSize: 14)),
                    pw.SizedBox(width: 10),
                    pw.Expanded(
                      child: pw.Text(
                        t.text,
                        style: pw.TextStyle(
                          decoration: t.done ? pw.TextDecoration.lineThrough : null,
                          color: t.done ? PdfColors.grey : PdfColors.black,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
        footer: (context) => pw.Text(
          'Généré par AUBM PCheck — ${DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now())}',
          style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey600),
        ),
      ),
    );

    return doc;
  }

  pw.Widget _metaRow(String label, String value) {
    return pw.Container(
      margin: const pw.EdgeInsets.only(bottom: 4),
      decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.grey300)),
      child: pw.Row(
        children: [
          pw.Container(
            width: 200,
            color: PdfColors.grey100,
            padding: const pw.EdgeInsets.all(8),
            child: pw.Text(label, style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
          ),
          pw.Expanded(
            child: pw.Padding(
              padding: const pw.EdgeInsets.all(8),
              child: pw.Text(value),
            ),
          ),
        ],
      ),
    );
  }

  String _safe(String value) {
    final cleaned = value.replaceAll(RegExp(r'[^\w\-]+'), '_');
    return cleaned.isEmpty ? 'fiche' : cleaned;
  }
}
