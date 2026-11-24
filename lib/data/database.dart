import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:sqflite_common_ffi_web/sqflite_ffi_web.dart';
// sqflite is required as a dependency for Android/iOS plugin registration.

class AppDatabase {
  AppDatabase._();
  static final AppDatabase instance = AppDatabase._();

  Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _open();
    return _db!;
  }

  bool get _isDesktop =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.windows ||
          defaultTargetPlatform == TargetPlatform.linux ||
          defaultTargetPlatform == TargetPlatform.macOS);

  Future<Database> _open() async {
    if (kIsWeb) {
      databaseFactory = databaseFactoryFfiWeb;
      return databaseFactory.openDatabase(
        'aubm_pcheck.db',
        options: OpenDatabaseOptions(
          version: 1,
          onConfigure: (db) async {
            await db.execute('PRAGMA foreign_keys = ON');
          },
          onCreate: _onCreate,
        ),
      );
    }

    if (_isDesktop) {
      sqfliteFfiInit();
      databaseFactory = databaseFactoryFfi;
    }

    final dir = await getApplicationSupportDirectory();
    final dbPath = p.join(dir.path, 'todos.db');
    return openDatabase(
      dbPath,
      version: 1,
      onConfigure: (db) async {
        await db.execute('PRAGMA foreign_keys = ON');
      },
      onCreate: _onCreate,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE fiches (
        id TEXT PRIMARY KEY NOT NULL,
        version TEXT NOT NULL,
        owner TEXT NOT NULL,
        pc_name TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        status TEXT NOT NULL CHECK (status IN ('draft', 'finalized')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        finalized_at TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY NOT NULL,
        fiche_id TEXT NOT NULL,
        text TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (fiche_id) REFERENCES fiches(id) ON DELETE CASCADE
      )
    ''');

    await db.execute('CREATE INDEX idx_fiches_status ON fiches(status)');
    await db.execute('CREATE INDEX idx_tasks_fiche_id ON tasks(fiche_id)');
  }
}
