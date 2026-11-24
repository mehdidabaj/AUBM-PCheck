using System.IO;
using System.Text.Json;
using AubmPCheck.Models;

namespace AubmPCheck.Services;

public class StorageService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly string _filePath;

    public StorageService()
    {
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "AubmPCheck",
            "data");
        Directory.CreateDirectory(dir);
        _filePath = Path.Combine(dir, "todos.json");
    }

    public string FilePath => _filePath;

    public AppStore Load()
    {
        if (!File.Exists(_filePath))
        {
            return new AppStore();
        }

        try
        {
            var json = File.ReadAllText(_filePath);
            return JsonSerializer.Deserialize<AppStore>(json, JsonOptions) ?? new AppStore();
        }
        catch
        {
            return new AppStore();
        }
    }

    public void Save(AppStore store)
    {
        var json = JsonSerializer.Serialize(store, JsonOptions);
        File.WriteAllText(_filePath, json);
    }
}
