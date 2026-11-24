import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/pc_todo_fiche.dart';
import '../theme.dart';

class FicheCard extends StatelessWidget {
  const FicheCard({
    super.key,
    required this.fiche,
    required this.actions,
    this.showEndDate = false,
  });

  final PcTodoFiche fiche;
  final List<Widget> actions;
  final bool showEndDate;

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('dd/MM/yyyy');
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final stacked = constraints.maxWidth < 640;
            final info = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  fiche.pcName,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.text,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Version ${fiche.version}  ·  ${fiche.owner}',
                  style: const TextStyle(color: AppTheme.muted),
                ),
                const SizedBox(height: 4),
                Text(
                  showEndDate
                      ? 'Début : ${fiche.startDate == null ? '—' : df.format(fiche.startDate!)}  ·  Fin : ${fiche.endDate == null ? '—' : df.format(fiche.endDate!)}'
                      : 'Début : ${fiche.startDate == null ? '—' : df.format(fiche.startDate!)}',
                  style: const TextStyle(color: AppTheme.muted),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppTheme.accentSoft,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    fiche.progressLabel,
                    style: const TextStyle(
                      color: AppTheme.accentStrong,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            );

            if (stacked) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  info,
                  const SizedBox(height: 14),
                  Wrap(spacing: 8, runSpacing: 8, children: actions),
                ],
              );
            }

            return Row(
              children: [
                Expanded(child: info),
                Wrap(spacing: 8, children: actions),
              ],
            );
          },
        ),
      ),
    );
  }
}
