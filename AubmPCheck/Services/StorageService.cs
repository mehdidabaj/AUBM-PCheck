using System.Globalization;
using System.IO;
using AubmPCheck.Models;
using Microsoft.Data.Sqlite;

namespace AubmPCheck.Services;

public class StorageService
{
    private const string StatusDraft = "draft";
    private const string StatusFinalized = "finalized";

    private readonly string _dbPath;

    public StorageService()
    {
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "AubmPCheck",
            "data");
        Directory.CreateDirectory(dir);
        _dbPath = Path.Combine(dir, "todos.db");
        EnsureSchema();
    }

    public string DatabasePath => _dbPath;

    private SqliteConnection OpenConnection()
    {
        var connection = new SqliteConnection($"Data Source={_dbPath}");
        connection.Open();
        using var pragma = connection.CreateCommand();
        pragma.CommandText = "PRAGMA foreign_keys = ON;";
        pragma.ExecuteNonQuery();
        return connection;
    }

    private void EnsureSchema()
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText =
            """
            CREATE TABLE IF NOT EXISTS fiches (
                id TEXT PRIMARY KEY NOT NULL,
                version TEXT NOT NULL,
                owner TEXT NOT NULL,
                pc_name TEXT NOT NULL,
                start_date TEXT NULL,
                end_date TEXT NULL,
                status TEXT NOT NULL CHECK (status IN ('draft', 'finalized')),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                finalized_at TEXT NULL
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY NOT NULL,
                fiche_id TEXT NOT NULL,
                text TEXT NOT NULL,
                done INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (fiche_id) REFERENCES fiches(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_fiches_status ON fiches(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_fiche_id ON tasks(fiche_id);
            """;
        command.ExecuteNonQuery();
    }

    public AppStore Load()
    {
        var store = new AppStore();

        using var connection = OpenConnection();
        using var ficheCommand = connection.CreateCommand();
        ficheCommand.CommandText =
            """
            SELECT id, version, owner, pc_name, start_date, end_date, status,
                   created_at, updated_at, finalized_at
            FROM fiches
            ORDER BY updated_at DESC;
            """;

        using var reader = ficheCommand.ExecuteReader();
        while (reader.Read())
        {
            var fiche = new PcTodoFiche
            {
                Id = reader.GetString(0),
                Version = reader.GetString(1),
                Owner = reader.GetString(2),
                PcName = reader.GetString(3),
                StartDate = ParseDate(reader.IsDBNull(4) ? null : reader.GetString(4)),
                EndDate = ParseDate(reader.IsDBNull(5) ? null : reader.GetString(5)),
                CreatedAt = ParseDateTime(reader.GetString(7)) ?? DateTime.UtcNow,
                UpdatedAt = ParseDateTime(reader.GetString(8)) ?? DateTime.UtcNow,
                FinalizedAt = ParseDateTime(reader.IsDBNull(9) ? null : reader.GetString(9)),
                Tasks = new List<TaskItem>()
            };

            var status = reader.GetString(6);
            if (status == StatusFinalized)
            {
                store.History.Add(fiche);
            }
            else
            {
                store.Drafts.Add(fiche);
            }
        }

        foreach (var fiche in store.Drafts.Concat(store.History))
        {
            fiche.Tasks = LoadTasks(connection, fiche.Id);
        }

        return store;
    }

    public void Save(AppStore store)
    {
        using var connection = OpenConnection();
        using var transaction = connection.BeginTransaction();

        using (var clearTasks = connection.CreateCommand())
        {
            clearTasks.Transaction = transaction;
            clearTasks.CommandText = "DELETE FROM tasks;";
            clearTasks.ExecuteNonQuery();
        }

        using (var clearFiches = connection.CreateCommand())
        {
            clearFiches.Transaction = transaction;
            clearFiches.CommandText = "DELETE FROM fiches;";
            clearFiches.ExecuteNonQuery();
        }

        foreach (var fiche in store.Drafts)
        {
            InsertFiche(connection, transaction, fiche, StatusDraft);
        }

        foreach (var fiche in store.History)
        {
            InsertFiche(connection, transaction, fiche, StatusFinalized);
        }

        transaction.Commit();
    }

    private static List<TaskItem> LoadTasks(SqliteConnection connection, string ficheId)
    {
        using var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT id, text, done
            FROM tasks
            WHERE fiche_id = $ficheId
            ORDER BY sort_order ASC, rowid ASC;
            """;
        command.Parameters.AddWithValue("$ficheId", ficheId);

        var tasks = new List<TaskItem>();
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            tasks.Add(new TaskItem
            {
                Id = reader.GetString(0),
                Text = reader.GetString(1),
                Done = reader.GetInt64(2) != 0
            });
        }

        return tasks;
    }

    private static void InsertFiche(
        SqliteConnection connection,
        SqliteTransaction transaction,
        PcTodoFiche fiche,
        string status)
    {
        using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText =
                """
                INSERT INTO fiches (
                    id, version, owner, pc_name, start_date, end_date, status,
                    created_at, updated_at, finalized_at
                ) VALUES (
                    $id, $version, $owner, $pcName, $startDate, $endDate, $status,
                    $createdAt, $updatedAt, $finalizedAt
                );
                """;
            command.Parameters.AddWithValue("$id", fiche.Id);
            command.Parameters.AddWithValue("$version", fiche.Version ?? string.Empty);
            command.Parameters.AddWithValue("$owner", fiche.Owner ?? string.Empty);
            command.Parameters.AddWithValue("$pcName", fiche.PcName ?? string.Empty);
            command.Parameters.AddWithValue("$startDate", FormatDate(fiche.StartDate));
            command.Parameters.AddWithValue("$endDate", FormatDate(fiche.EndDate));
            command.Parameters.AddWithValue("$status", status);
            command.Parameters.AddWithValue("$createdAt", FormatDateTime(fiche.CreatedAt));
            command.Parameters.AddWithValue("$updatedAt", FormatDateTime(fiche.UpdatedAt));
            command.Parameters.AddWithValue("$finalizedAt", FormatDateTime(fiche.FinalizedAt));
            command.ExecuteNonQuery();
        }

        for (var i = 0; i < fiche.Tasks.Count; i++)
        {
            var task = fiche.Tasks[i];
            using var taskCommand = connection.CreateCommand();
            taskCommand.Transaction = transaction;
            taskCommand.CommandText =
                """
                INSERT INTO tasks (id, fiche_id, text, done, sort_order)
                VALUES ($id, $ficheId, $text, $done, $sortOrder);
                """;
            taskCommand.Parameters.AddWithValue("$id", string.IsNullOrWhiteSpace(task.Id)
                ? Guid.NewGuid().ToString("N")
                : task.Id);
            taskCommand.Parameters.AddWithValue("$ficheId", fiche.Id);
            taskCommand.Parameters.AddWithValue("$text", task.Text ?? string.Empty);
            taskCommand.Parameters.AddWithValue("$done", task.Done ? 1 : 0);
            taskCommand.Parameters.AddWithValue("$sortOrder", i);
            taskCommand.ExecuteNonQuery();
        }
    }

    private static object FormatDate(DateTime? value) =>
        value.HasValue
            ? value.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
            : DBNull.Value;

    private static object FormatDateTime(DateTime? value) =>
        value.HasValue
            ? value.Value.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture)
            : DBNull.Value;

    private static DateTime? ParseDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (DateTime.TryParseExact(
                value,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var date))
        {
            return date;
        }

        return DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var fallback)
            ? fallback.Date
            : null;
    }

    private static DateTime? ParseDateTime(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return DateTime.TryParse(
            value,
            CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind,
            out var dateTime)
            ? dateTime
            : null;
    }
}
