import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../state/app_state.dart';
import '../theme.dart';

class EditorView extends StatefulWidget {
  const EditorView({super.key});

  @override
  State<EditorView> createState() => _EditorViewState();
}

class _EditorViewState extends State<EditorView> {
  late final TextEditingController _version;
  late final TextEditingController _owner;
  late final TextEditingController _pcName;
  late final TextEditingController _newTask;
  String? _boundId;
  bool _boundReadOnly = false;

  @override
  void initState() {
    super.initState();
    final state = context.read<AppState>();
    _version = TextEditingController(text: state.version);
    _owner = TextEditingController(text: state.owner);
    _pcName = TextEditingController(text: state.pcName);
    _newTask = TextEditingController(text: state.newTaskText);
    _boundId = state.currentId;
    _boundReadOnly = state.isReadOnly;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final state = context.watch<AppState>();
    if (_boundId != state.currentId || _boundReadOnly != state.isReadOnly) {
      _boundId = state.currentId;
      _boundReadOnly = state.isReadOnly;
      _version.text = state.version;
      _owner.text = state.owner;
      _pcName.text = state.pcName;
      _newTask.text = state.newTaskText;
    }
  }

  @override
  void dispose() {
    _version.dispose();
    _owner.dispose();
    _pcName.dispose();
    _newTask.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final df = DateFormat('dd/MM/yyyy');

    return ColoredBox(
      color: AppTheme.bg,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(28, 28, 28, 40),
        children: [
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.start,
            runSpacing: 12,
            children: [
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      state.editorTitle,
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.text,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Renseignez le PC, ajoutez les tâches, puis cochez-les au fur et à mesure.',
                      style: TextStyle(color: AppTheme.muted, fontSize: 14),
                    ),
                  ],
                ),
              ),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  OutlinedButton(onPressed: state.newFiche, child: const Text('Nouvelle')),
                  if (!state.isReadOnly)
                    OutlinedButton(
                      onPressed: state.saveDraft,
                      child: const Text('Enregistrer brouillon'),
                    ),
                  OutlinedButton(
                    onPressed: () => state.printFiche(),
                    child: const Text('Imprimer'),
                  ),
                  OutlinedButton(
                    onPressed: () => state.exportPdf(),
                    child: const Text('Exporter PDF'),
                  ),
                  if (!state.isReadOnly)
                    FilledButton(
                      onPressed: state.openFinalize,
                      child: const Text('Finaliser'),
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 22),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SectionTitle('Informations du PC'),
                  const SizedBox(height: 16),
                  LayoutBuilder(
                    builder: (context, c) {
                      final twoCols = c.maxWidth > 700;
                      final fields = [
                        _LabeledField(
                          label: 'Version du Todo PC',
                          child: TextField(
                            enabled: !state.isReadOnly,
                            controller: _version,
                            onChanged: state.setVersion,
                            decoration: const InputDecoration(hintText: 'ex. v2.1'),
                          ),
                        ),
                        _LabeledField(
                          label: 'Propriétaire du PC',
                          child: TextField(
                            enabled: !state.isReadOnly,
                            controller: _owner,
                            onChanged: state.setOwner,
                            decoration: const InputDecoration(hintText: 'Nom du propriétaire'),
                          ),
                        ),
                        _LabeledField(
                          label: 'Nom complet du PC',
                          child: TextField(
                            enabled: !state.isReadOnly,
                            controller: _pcName,
                            onChanged: state.setPcName,
                            decoration:
                                const InputDecoration(hintText: 'ex. LAPTOP-DUPONT-01'),
                          ),
                        ),
                        _LabeledField(
                          label: 'Date de début de préparation',
                          child: OutlinedButton.icon(
                            onPressed: state.isReadOnly
                                ? null
                                : () async {
                                    final picked = await showDatePicker(
                                      context: context,
                                      initialDate: state.startDate ?? DateTime.now(),
                                      firstDate: DateTime(2000),
                                      lastDate: DateTime(2100),
                                    );
                                    if (picked != null) state.setStartDate(picked);
                                  },
                            icon: const Icon(Icons.calendar_today_outlined, size: 18),
                            label: Text(
                              state.startDate == null ? 'Choisir' : df.format(state.startDate!),
                            ),
                          ),
                        ),
                      ];

                      if (!twoCols) {
                        return Column(
                          children: [
                            for (final f in fields) ...[
                              f,
                              const SizedBox(height: 14),
                            ],
                          ],
                        );
                      }

                      return Column(
                        children: [
                          Row(children: [
                            Expanded(child: fields[0]),
                            const SizedBox(width: 16),
                            Expanded(child: fields[1]),
                          ]),
                          const SizedBox(height: 14),
                          Row(children: [
                            Expanded(child: fields[2]),
                            const SizedBox(width: 16),
                            Expanded(child: fields[3]),
                          ]),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Expanded(child: _SectionTitle('Tâches à faire')),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: AppTheme.accentSoft,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          '${state.tasksProgress} cochées',
                          style: const TextStyle(
                            color: AppTheme.accentStrong,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          enabled: !state.isReadOnly,
                          controller: _newTask,
                          onChanged: state.setNewTaskText,
                          onSubmitted: (_) {
                            state.addTask();
                            _newTask.clear();
                          },
                          decoration: const InputDecoration(
                            hintText: 'Saisir une tâche à ajouter…',
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      FilledButton(
                        onPressed: state.isReadOnly
                            ? null
                            : () {
                                state.addTask();
                                _newTask.clear();
                              },
                        child: const Text('Ajouter'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  if (state.tasks.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(22),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF4F7FB),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.line),
                      ),
                      child: const Column(
                        children: [
                          Text(
                            'Aucune tâche pour l’instant',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: AppTheme.text,
                            ),
                          ),
                          SizedBox(height: 6),
                          Text(
                            'Saisissez une tâche ci-dessus puis cliquez sur Ajouter.',
                            style: TextStyle(color: AppTheme.muted),
                          ),
                        ],
                      ),
                    )
                  else
                    ...state.tasks.map(
                      (task) => Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF4F7FB),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppTheme.line),
                        ),
                        child: Row(
                          children: [
                            Checkbox(
                              value: task.done,
                              onChanged: state.isReadOnly
                                  ? null
                                  : (v) => state.toggleTask(task.id, v ?? false),
                            ),
                            Expanded(
                              child: Text(
                                task.text,
                                style: TextStyle(
                                  color: task.done ? AppTheme.muted : AppTheme.text,
                                  decoration:
                                      task.done ? TextDecoration.lineThrough : null,
                                ),
                              ),
                            ),
                            TextButton(
                              onPressed: state.isReadOnly
                                  ? null
                                  : () => state.removeTask(task.id),
                              style: TextButton.styleFrom(foregroundColor: AppTheme.danger),
                              child: const Text('Supprimer'),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          if (state.statusMessage.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              state.statusMessage,
              style: const TextStyle(
                color: AppTheme.accentStrong,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 18,
          decoration: BoxDecoration(
            color: AppTheme.accent,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          text,
          style: const TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w600,
            color: AppTheme.text,
          ),
        ),
      ],
    );
  }
}

class _LabeledField extends StatelessWidget {
  const _LabeledField({required this.label, required this.child});
  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppTheme.muted,
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 8),
        child,
      ],
    );
  }
}
