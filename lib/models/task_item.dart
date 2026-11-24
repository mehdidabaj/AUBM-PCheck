class TaskItem {
  TaskItem({
    required this.id,
    required this.text,
    this.done = false,
    this.sortOrder = 0,
  });

  final String id;
  String text;
  bool done;
  int sortOrder;

  TaskItem copyWith({
    String? id,
    String? text,
    bool? done,
    int? sortOrder,
  }) {
    return TaskItem(
      id: id ?? this.id,
      text: text ?? this.text,
      done: done ?? this.done,
      sortOrder: sortOrder ?? this.sortOrder,
    );
  }

  Map<String, Object?> toMap(String ficheId) => {
        'id': id,
        'fiche_id': ficheId,
        'text': text,
        'done': done ? 1 : 0,
        'sort_order': sortOrder,
      };

  factory TaskItem.fromMap(Map<String, Object?> map) {
    return TaskItem(
      id: map['id']! as String,
      text: map['text']! as String,
      done: (map['done'] as int? ?? 0) == 1,
      sortOrder: map['sort_order'] as int? ?? 0,
    );
  }
}
