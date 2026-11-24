import 'package:sqflite/sqflite.dart';

import '../models/pc_todo_fiche.dart';
import '../models/task_item.dart';
import 'database.dart';

class FicheRepository {
  Future<List<PcTodoFiche>> getByStatus(FicheStatus status) async {
    final db = await AppDatabase.instance.database;
    final statusValue = status == FicheStatus.finalized ? 'finalized' : 'draft';
    final rows = await db.query(
      'fiches',
      where: 'status = ?',
      whereArgs: [statusValue],
      orderBy: 'updated_at DESC',
    );

    final fiches = <PcTodoFiche>[];
    for (final row in rows) {
      final tasks = await _loadTasks(row['id']! as String);
      fiches.add(PcTodoFiche.fromMap(row, tasks));
    }
    return fiches;
  }

  Future<List<TaskItem>> _loadTasks(String ficheId) async {
    final db = await AppDatabase.instance.database;
    final rows = await db.query(
      'tasks',
      where: 'fiche_id = ?',
      whereArgs: [ficheId],
      orderBy: 'sort_order ASC',
    );
    return rows.map(TaskItem.fromMap).toList();
  }

  Future<void> upsert(PcTodoFiche fiche) async {
    final db = await AppDatabase.instance.database;
    await db.transaction((txn) async {
      await txn.insert(
        'fiches',
        fiche.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
      await txn.delete('tasks', where: 'fiche_id = ?', whereArgs: [fiche.id]);
      for (var i = 0; i < fiche.tasks.length; i++) {
        final task = fiche.tasks[i].copyWith(sortOrder: i);
        await txn.insert('tasks', task.toMap(fiche.id));
      }
    });
  }

  Future<void> delete(String id) async {
    final db = await AppDatabase.instance.database;
    await db.delete('tasks', where: 'fiche_id = ?', whereArgs: [id]);
    await db.delete('fiches', where: 'id = ?', whereArgs: [id]);
  }
}
