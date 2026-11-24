import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import 'theme.dart';
import 'views/drafts_view.dart';
import 'views/editor_view.dart';
import 'views/history_view.dart';
import 'widgets/finalize_dialog.dart';

class HomeShell extends StatelessWidget {
  const HomeShell({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final wide = MediaQuery.sizeOf(context).width >= 900;

    if (state.loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final body = switch (state.currentView) {
      AppView.editor => const EditorView(),
      AppView.drafts => const DraftsView(),
      AppView.history => const HistoryView(),
    };

    return Stack(
      children: [
        Scaffold(
          body: wide
              ? Row(
                  children: [
                    const _Sidebar(),
                    Expanded(child: body),
                  ],
                )
              : body,
          bottomNavigationBar: wide
              ? null
              : NavigationBar(
                  selectedIndex: state.currentView.index,
                  onDestinationSelected: (i) =>
                      state.showView(AppView.values[i]),
                  destinations: [
                    const NavigationDestination(
                      icon: Icon(Icons.note_add_outlined),
                      label: 'Fiche',
                    ),
                    NavigationDestination(
                      icon: Badge(
                        isLabelVisible: state.drafts.isNotEmpty,
                        label: Text('${state.drafts.length}'),
                        child: const Icon(Icons.drafts_outlined),
                      ),
                      label: 'Brouillons',
                    ),
                    NavigationDestination(
                      icon: Badge(
                        isLabelVisible: state.history.isNotEmpty,
                        label: Text('${state.history.length}'),
                        child: const Icon(Icons.history),
                      ),
                      label: 'Historique',
                    ),
                  ],
                ),
        ),
        if (state.finalizeOpen) const FinalizeDialog(),
      ],
    );
  }
}

class _Sidebar extends StatelessWidget {
  const _Sidebar();

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();

    Widget navItem({
      required AppView view,
      required IconData icon,
      required String label,
      int? badge,
    }) {
      final selected = state.currentView == view;
      return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Material(
          color: selected ? const Color(0x2A14B8A6) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => state.showView(view),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Icon(icon, color: selected ? Colors.white : AppTheme.sidebarMuted, size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      label,
                      style: TextStyle(
                        color: selected ? Colors.white : AppTheme.sidebarMuted,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (badge != null)
                    Container(
                      constraints: const BoxConstraints(minWidth: 26),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        '$badge',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.white, fontSize: 11),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      width: 268,
      color: AppTheme.sidebar,
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF14B8A6), Color(0xFF0F766E)],
                  ),
                ),
                child: const Text(
                  'PC',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 12),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'AUBM PCheck',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Préparation PC',
                    style: TextStyle(color: AppTheme.sidebarMuted, fontSize: 12.5),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 36),
          navItem(
            view: AppView.editor,
            icon: Icons.note_add_outlined,
            label: 'Nouvelle fiche',
          ),
          navItem(
            view: AppView.drafts,
            icon: Icons.drafts_outlined,
            label: 'Brouillons',
            badge: state.drafts.length,
          ),
          navItem(
            view: AppView.history,
            icon: Icons.history,
            label: 'Historique',
            badge: state.history.length,
          ),
          const Spacer(),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              'Préparez · cochez · finalisez\nPuis exportez en PDF ou imprimez.',
              style: TextStyle(color: AppTheme.sidebarMuted, height: 1.45, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}
