import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import '../data/fiche_repository.dart';
import '../models/pc_todo_fiche.dart';
import '../models/task_item.dart';
import '../services/pdf_service.dart';

enum AppView { editor, drafts, history }

class AppState extends ChangeNotifier {
  AppState({
    FicheRepository? repository,
    PdfService? pdfService,
  })  : _repository = repository ?? FicheRepository(),
        _pdf = pdfService ?? PdfService();

  final FicheRepository _repository;
  final PdfService _pdf;
  final _uuid = const Uuid();

  AppView currentView = AppView.editor;
  bool loading = true;
  String statusMessage = '';
  String historySearch = '';
  bool isReadOnly = false;
  bool finalizeOpen = false;

  String? currentId;
  String version = '';
  String owner = '';
  String pcName = '';
  DateTime? startDate = DateTime.now();
  DateTime? endDate = DateTime.now();
  String newTaskText = '';
  String editorTitle = 'Nouvelle fiche Todo PC';
  List<TaskItem> tasks = [];

  List<PcTodoFiche> drafts = [];
  List<PcTodoFiche> history = [];

  List<PcTodoFiche> get filteredHistory {
    final q = historySearch.trim().toLowerCase();
    if (q.isEmpty) return history;
    return history
        .where((f) => '${f.pcName} ${f.owner} ${f.version}'.toLowerCase().contains(q))
        .toList();
  }

  String get tasksProgress => '${tasks.where((t) => t.done).length} / ${tasks.length}';

  Future<void> init() async {
    loading = true;
    notifyListeners();
    await refreshLists();
    newFiche();
    loading = false;
    notifyListeners();
  }

  Future<void> refreshLists() async {
    drafts = await _repository.getByStatus(FicheStatus.draft);
    history = await _repository.getByStatus(FicheStatus.finalized);
    notifyListeners();
  }

  void showView(AppView view) {
    currentView = view;
    notifyListeners();
  }

  void toast(String message) {
    statusMessage = message;
    notifyListeners();
  }

  void newFiche() {
    currentId = null;
    isReadOnly = false;
    version = '';
    owner = '';
    pcName = '';
    startDate = DateTime.now();
    endDate = DateTime.now();
    newTaskText = '';
    tasks = [];
    editorTitle = 'Nouvelle fiche Todo PC';
    currentView = AppView.editor;
    notifyListeners();
  }

  void setVersion(String v) {
    version = v;
    notifyListeners();
  }

  void setOwner(String v) {
    owner = v;
    notifyListeners();
  }

  void setPcName(String v) {
    pcName = v;
    notifyListeners();
  }

  void setStartDate(DateTime? v) {
    startDate = v;
    notifyListeners();
  }

  void setEndDate(DateTime? v) {
    endDate = v;
    notifyListeners();
  }

  void setNewTaskText(String v) {
    newTaskText = v;
    notifyListeners();
  }

  void setHistorySearch(String v) {
    historySearch = v;
    notifyListeners();
  }

  void addTask() {
    if (isReadOnly) return;
    final text = newTaskText.trim();
    if (text.isEmpty) {
      toast('Saisissez le libellé de la tâche.');
      return;
    }
    tasks = [
      ...tasks,
      TaskItem(id: _uuid.v4(), text: text, sortOrder: tasks.length),
    ];
    newTaskText = '';
    notifyListeners();
  }

  void toggleTask(String id, bool done) {
    if (isReadOnly) return;
    tasks = [
      for (final t in tasks)
        if (t.id == id) t.copyWith(done: done) else t,
    ];
    notifyListeners();
  }

  void removeTask(String id) {
    if (isReadOnly) return;
    tasks = tasks.where((t) => t.id != id).toList();
    notifyListeners();
  }

  PcTodoFiche _collect({bool keepId = true}) {
    return PcTodoFiche(
      id: keepId && currentId != null ? currentId! : _uuid.v4(),
      version: version.trim(),
      owner: owner.trim(),
      pcName: pcName.trim(),
      startDate: startDate,
      endDate: null,
      status: FicheStatus.draft,
      tasks: tasks.map((t) => t.copyWith()).toList(),
      updatedAt: DateTime.now().toUtc(),
      createdAt: DateTime.now().toUtc(),
    );
  }

  bool _validate(PcTodoFiche fiche) {
    if (fiche.version.isEmpty ||
        fiche.owner.isEmpty ||
        fiche.pcName.isEmpty ||
        fiche.startDate == null) {
      toast('Renseignez version, propriétaire, nom du PC et date de début.');
      return false;
    }
    if (fiche.tasks.isEmpty) {
      toast('Ajoutez au moins une tâche.');
      return false;
    }
    return true;
  }

  Future<void> saveDraft() async {
    if (isReadOnly) return;
    final fiche = _collect(keepId: true);
    if (!_validate(fiche)) return;

    final matches = drafts.where((d) => d.id == fiche.id);
    if (matches.isNotEmpty) {
      fiche.createdAt = matches.first.createdAt;
    }
    fiche.status = FicheStatus.draft;
    await _repository.upsert(fiche);
    currentId = fiche.id;
    editorTitle = 'Brouillon — ${fiche.pcName}';
    await refreshLists();
    toast('Brouillon enregistré.');
  }

  Future<void> openDraft(PcTodoFiche fiche) async {
    _fill(fiche, readOnly: false);
    editorTitle = 'Brouillon — ${fiche.pcName}';
    currentView = AppView.editor;
    notifyListeners();
  }

  Future<void> openHistory(PcTodoFiche fiche) async {
    _fill(fiche, readOnly: true);
    final end = fiche.endDate == null
        ? '—'
        : '${fiche.endDate!.day.toString().padLeft(2, '0')}/${fiche.endDate!.month.toString().padLeft(2, '0')}/${fiche.endDate!.year}';
    editorTitle = 'Historique — ${fiche.pcName} (terminé le $end)';
    currentView = AppView.editor;
    notifyListeners();
  }

  void _fill(PcTodoFiche fiche, {required bool readOnly}) {
    currentId = fiche.id;
    isReadOnly = readOnly;
    version = fiche.version;
    owner = fiche.owner;
    pcName = fiche.pcName;
    startDate = fiche.startDate;
    endDate = fiche.endDate ?? DateTime.now();
    tasks = fiche.tasks.map((t) => t.copyWith()).toList();
  }

  Future<void> deleteDraft(PcTodoFiche fiche) async {
    await _repository.delete(fiche.id);
    if (currentId == fiche.id) newFiche();
    await refreshLists();
    toast('Brouillon supprimé.');
  }

  Future<void> deleteHistory(PcTodoFiche fiche) async {
    await _repository.delete(fiche.id);
    if (currentId == fiche.id && isReadOnly) newFiche();
    await refreshLists();
    toast('Fiche retirée de l’historique.');
  }

  void openFinalize() {
    if (isReadOnly) return;
    final fiche = _collect();
    if (!_validate(fiche)) return;
    endDate = DateTime.now();
    finalizeOpen = true;
    notifyListeners();
  }

  void cancelFinalize() {
    finalizeOpen = false;
    notifyListeners();
  }

  Future<void> confirmFinalize() async {
    final fiche = _collect(keepId: true);
    if (!_validate(fiche)) return;
    if (endDate == null) {
      toast('Indiquez la date de fin de préparation.');
      return;
    }
    if (fiche.startDate != null &&
        endDate!.isBefore(DateTime(fiche.startDate!.year, fiche.startDate!.month, fiche.startDate!.day))) {
      toast('La date de fin ne peut pas être antérieure à la date de début.');
      return;
    }

    fiche
      ..endDate = endDate
      ..status = FicheStatus.finalized
      ..finalizedAt = DateTime.now().toUtc()
      ..updatedAt = DateTime.now().toUtc();

    await _repository.upsert(fiche);
    finalizeOpen = false;
    await refreshLists();
    newFiche();
    currentView = AppView.history;
    toast('Fiche finalisée et ajoutée à l’historique.');
    notifyListeners();
  }

  Future<void> exportPdf([PcTodoFiche? fiche]) async {
    final target = fiche ?? _collect();
    if (fiche == null && !_validate(target)) return;
    await _pdf.exportOrPrint(target, printDirect: false);
    toast('Export PDF prêt.');
  }

  Future<void> printFiche([PcTodoFiche? fiche]) async {
    final target = fiche ?? _collect();
    if (fiche == null && !_validate(target)) return;
    await _pdf.exportOrPrint(target, printDirect: true);
  }
}
