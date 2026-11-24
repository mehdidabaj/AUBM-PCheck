import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/app_state.dart';
import '../theme.dart';
import '../widgets/fiche_card.dart';

class HistoryView extends StatefulWidget {
  const HistoryView({super.key});

  @override
  State<HistoryView> createState() => _HistoryViewState();
}

class _HistoryViewState extends State<HistoryView> {
  late final TextEditingController _search;

  @override
  void initState() {
    super.initState();
    _search = TextEditingController(text: context.read<AppState>().historySearch);
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final items = state.filteredHistory;

    return ColoredBox(
      color: AppTheme.bg,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(28, 28, 28, 40),
        children: [
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Historique des Todo PC',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.text,
                    ),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Fiches finalisées avec date de fin de préparation.',
                    style: TextStyle(color: AppTheme.muted),
                  ),
                ],
              ),
              SizedBox(
                width: 300,
                child: TextField(
                  controller: _search,
                  onChanged: state.setHistorySearch,
                  decoration: const InputDecoration(
                    hintText: 'Rechercher (PC, propriétaire, version)…',
                    prefixIcon: Icon(Icons.search),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
          if (items.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Text(
                  state.history.isEmpty
                      ? 'Aucune fiche finalisée pour le moment.'
                      : 'Aucun résultat pour cette recherche.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppTheme.muted),
                ),
              ),
            )
          else
            ...items.map(
              (fiche) => FicheCard(
                fiche: fiche,
                showEndDate: true,
                actions: [
                  FilledButton(
                    onPressed: () => state.openHistory(fiche),
                    child: const Text('Voir'),
                  ),
                  OutlinedButton(
                    onPressed: () => state.exportPdf(fiche),
                    child: const Text('PDF'),
                  ),
                  OutlinedButton(
                    onPressed: () => state.printFiche(fiche),
                    child: const Text('Imprimer'),
                  ),
                  OutlinedButton(
                    onPressed: () async {
                      final ok = await showDialog<bool>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          title: const Text('Confirmation'),
                          content: Text('Retirer « ${fiche.pcName} » de l’historique ?'),
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
                      if (ok == true) await state.deleteHistory(fiche);
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
