import 'task_item.dart';

enum FicheStatus { draft, finalized }

class PcTodoFiche {
  PcTodoFiche({
    required this.id,
    required this.version,
    required this.owner,
    required this.pcName,
    this.startDate,
    this.endDate,
    this.status = FicheStatus.draft,
    List<TaskItem>? tasks,
    DateTime? createdAt,
    DateTime? updatedAt,
    this.finalizedAt,
  })  : tasks = tasks ?? <TaskItem>[],
        createdAt = createdAt ?? DateTime.now().toUtc(),
        updatedAt = updatedAt ?? DateTime.now().toUtc();

  final String id;
  String version;
  String owner;
  String pcName;
  DateTime? startDate;
  DateTime? endDate;
  FicheStatus status;
  List<TaskItem> tasks;
  DateTime createdAt;
  DateTime updatedAt;
  DateTime? finalizedAt;

  int get doneCount => tasks.where((t) => t.done).length;
  int get totalCount => tasks.length;
  String get progressLabel => '$doneCount / $totalCount tâches';

  PcTodoFiche copyWith({
    String? id,
    String? version,
    String? owner,
    String? pcName,
    DateTime? startDate,
    DateTime? endDate,
    FicheStatus? status,
    List<TaskItem>? tasks,
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? finalizedAt,
  }) {
    return PcTodoFiche(
      id: id ?? this.id,
      version: version ?? this.version,
      owner: owner ?? this.owner,
      pcName: pcName ?? this.pcName,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      status: status ?? this.status,
      tasks: tasks ?? this.tasks.map((t) => t.copyWith()).toList(),
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      finalizedAt: finalizedAt ?? this.finalizedAt,
    );
  }

  Map<String, Object?> toMap() => {
        'id': id,
        'version': version,
        'owner': owner,
        'pc_name': pcName,
        'start_date': startDate?.toIso8601String().split('T').first,
        'end_date': endDate?.toIso8601String().split('T').first,
        'status': status == FicheStatus.finalized ? 'finalized' : 'draft',
        'created_at': createdAt.toIso8601String(),
        'updated_at': updatedAt.toIso8601String(),
        'finalized_at': finalizedAt?.toIso8601String(),
      };

  factory PcTodoFiche.fromMap(Map<String, Object?> map, List<TaskItem> tasks) {
    final statusRaw = map['status'] as String? ?? 'draft';
    return PcTodoFiche(
      id: map['id']! as String,
      version: map['version'] as String? ?? '',
      owner: map['owner'] as String? ?? '',
      pcName: map['pc_name'] as String? ?? '',
      startDate: _parseDate(map['start_date'] as String?),
      endDate: _parseDate(map['end_date'] as String?),
      status: statusRaw == 'finalized' ? FicheStatus.finalized : FicheStatus.draft,
      tasks: tasks,
      createdAt: DateTime.tryParse(map['created_at'] as String? ?? '')?.toUtc() ??
          DateTime.now().toUtc(),
      updatedAt: DateTime.tryParse(map['updated_at'] as String? ?? '')?.toUtc() ??
          DateTime.now().toUtc(),
      finalizedAt: DateTime.tryParse(map['finalized_at'] as String? ?? '')?.toUtc(),
    );
  }

  static DateTime? _parseDate(String? value) {
    if (value == null || value.isEmpty) return null;
    return DateTime.tryParse(value);
  }
}
