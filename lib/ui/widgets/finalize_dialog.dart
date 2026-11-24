import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/app_state.dart';
import '../theme.dart';

class FinalizeDialog extends StatelessWidget {
  const FinalizeDialog({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();

    return Material(
      color: const Color(0x990B1524),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: Card(
            margin: const EdgeInsets.all(24),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Finaliser la fiche',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.text,
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Indiquez la date de fin de préparation. La fiche passera dans l’historique.',
                    style: TextStyle(color: AppTheme.muted, height: 1.4),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Date de fin de préparation',
                    style: TextStyle(
                      color: AppTheme.muted,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: state.endDate ?? DateTime.now(),
                        firstDate: DateTime(2000),
                        lastDate: DateTime(2100),
                      );
                      if (picked != null) state.setEndDate(picked);
                    },
                    icon: const Icon(Icons.calendar_today_outlined, size: 18),
                    label: Text(
                      state.endDate == null
                          ? 'Choisir une date'
                          : '${state.endDate!.day.toString().padLeft(2, '0')}/'
                              '${state.endDate!.month.toString().padLeft(2, '0')}/'
                              '${state.endDate!.year}',
                    ),
                  ),
                  const SizedBox(height: 22),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      OutlinedButton(
                        onPressed: state.cancelFinalize,
                        child: const Text('Annuler'),
                      ),
                      const SizedBox(width: 10),
                      FilledButton(
                        onPressed: state.confirmFinalize,
                        child: const Text('Confirmer la finalisation'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
