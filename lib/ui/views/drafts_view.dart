import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/app_state.dart';
import '../theme.dart';
import '../widgets/fiche_card.dart';

class DraftsView extends StatelessWidget {
  const DraftsView({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();

    return ColoredBox(
      color: AppTheme.bg,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(28, 28, 28, 40),
        children: [
          const Text(
            'Brouillons',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: AppTheme.text),
          ),
          const SizedBox(height: 8),
          const Text(
            'Fiches en cours de préparation, non encore finalisées.',
            style: TextStyle(color: AppTheme.muted),
          ),
          const SizedBox(height: 22),
          if (state.drafts.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(28),
                child: Text(
                  'Aucun brouillon enregistré.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.muted),
                ),
              ),
            )
          else
            ...state.drafts.map(
              (fiche) => FicheCard(
                fiche: fiche,
                actions: [
                  FilledButton(
                    onPressed: () => state.openDraft(fiche),
                    child: const Text('Ouvrir'),
                  ),
                  OutlinedButton(
                    onPressed: () => state.exportPdf(fiche),
                    child: const Text('PDF'),
                  ),
                  OutlinedButton(
                    onPressed: () async {
                      final ok = await showDialog<bool>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          title: const Text('Confirmation'),
                          content: Text('Supprimer le brouillon « ${fiche.pcName} » ?'),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(ctx, false),
                              child: const Text('Annuler'),
                            ),
                            TextButton(
                              onPressed: () => Navigator.pop(ctx, true),
                              child: const Text('Supprimer'),
                            ),
                          ],
                        ),
                      );
                      if (ok == true) await state.deleteDraft(fiche);
                    },
                    style: OutlinedButton.styleFrom(foregroundColor: AppTheme.danger),
                    child: const Text('Supprimer'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
