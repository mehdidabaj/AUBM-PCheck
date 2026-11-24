using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.ComponentModel;
using System.IO;
using System.Windows;
using AubmPCheck.Models;
using AubmPCheck.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Win32;

namespace AubmPCheck.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly StorageService _storage = new();
    private readonly PdfExportService _pdf = new();
    private readonly PrintService _print = new();
    private AppStore _store = new();

    [ObservableProperty]
    private string _currentView = "Editor";

    [ObservableProperty]
    private string _editorTitle = "Nouvelle fiche Todo PC";

    [ObservableProperty]
    private string _version = string.Empty;

    [ObservableProperty]
    private string _owner = string.Empty;

    [ObservableProperty]
    private string _pcName = string.Empty;

    [ObservableProperty]
    private DateTime? _startDate = DateTime.Today;

    [ObservableProperty]
    private DateTime? _endDate = DateTime.Today;

    [ObservableProperty]
    private string _newTaskText = string.Empty;

    [ObservableProperty]
    private string? _currentId;

    [ObservableProperty]
    private bool _isReadOnly;

    [ObservableProperty]
    private bool _isFinalizeDialogOpen;

    [ObservableProperty]
    private string _historySearch = string.Empty;

    [ObservableProperty]
    private string _statusMessage = string.Empty;

    [ObservableProperty]
    private string _tasksProgress = "0 / 0";

    public ObservableCollection<TaskItemViewModel> Tasks { get; } = new();
    public ObservableCollection<PcTodoFiche> Drafts { get; } = new();
    public ObservableCollection<PcTodoFiche> FilteredHistory { get; } = new();

    public int DraftsCount => Drafts.Count;
    public int HistoryCount => _store.History.Count;

    public MainViewModel()
    {
        Tasks.CollectionChanged += OnTasksCollectionChanged;
        LoadStore();
        RefreshLists();
    }

    partial void OnHistorySearchChanged(string value) => RefreshHistoryFilter();

    private void OnTasksCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        if (e.NewItems != null)
        {
            foreach (TaskItemViewModel item in e.NewItems)
            {
                item.PropertyChanged += OnTaskPropertyChanged;
            }
        }

        if (e.OldItems != null)
        {
            foreach (TaskItemViewModel item in e.OldItems)
            {
                item.PropertyChanged -= OnTaskPropertyChanged;
            }
        }

        UpdateProgress();
    }

    private void OnTaskPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName is nameof(TaskItemViewModel.Done) or nameof(TaskItemViewModel.Text))
        {
            UpdateProgress();
        }
    }

    private void UpdateProgress()
    {
        var done = Tasks.Count(t => t.Done);
        TasksProgress = $"{done} / {Tasks.Count}";
    }

    private void LoadStore()
    {
        _store = _storage.Load();
    }

    private void Persist()
    {
        _storage.Save(_store);
        RefreshLists();
        OnPropertyChanged(nameof(DraftsCount));
        OnPropertyChanged(nameof(HistoryCount));
    }

    private void RefreshLists()
    {
        Drafts.Clear();
        foreach (var d in _store.Drafts.OrderByDescending(x => x.UpdatedAt))
        {
            Drafts.Add(d);
        }

        RefreshHistoryFilter();
        OnPropertyChanged(nameof(DraftsCount));
        OnPropertyChanged(nameof(HistoryCount));
    }

    private void RefreshHistoryFilter()
    {
        FilteredHistory.Clear();
        var q = HistorySearch.Trim().ToLowerInvariant();
        var items = _store.History.OrderByDescending(x => x.FinalizedAt ?? x.UpdatedAt);
        foreach (var item in items)
        {
            if (string.IsNullOrEmpty(q) ||
                $"{item.PcName} {item.Owner} {item.Version}".ToLowerInvariant().Contains(q))
            {
                FilteredHistory.Add(item);
            }
        }
    }

    private void Toast(string message)
    {
        StatusMessage = message;
    }

    private PcTodoFiche CollectFiche(bool keepId)
    {
        return new PcTodoFiche
        {
            Id = keepId && !string.IsNullOrEmpty(CurrentId) ? CurrentId! : Guid.NewGuid().ToString("N"),
            Version = Version.Trim(),
            Owner = Owner.Trim(),
            PcName = PcName.Trim(),
            StartDate = StartDate,
            EndDate = null,
            Tasks = Tasks.Select(t => new TaskItem
            {
                Id = t.Id,
                Text = t.Text,
                Done = t.Done
            }).ToList(),
            UpdatedAt = DateTime.UtcNow
        };
    }

    private bool Validate(PcTodoFiche fiche)
    {
        if (string.IsNullOrWhiteSpace(fiche.Version) ||
            string.IsNullOrWhiteSpace(fiche.Owner) ||
            string.IsNullOrWhiteSpace(fiche.PcName) ||
            fiche.StartDate is null)
        {
            Toast("Renseignez version, propriétaire, nom du PC et date de début.");
            return false;
        }

        if (fiche.Tasks.Count == 0)
        {
            Toast("Ajoutez au moins une tâche.");
            return false;
        }

        return true;
    }

    private void FillEditor(PcTodoFiche fiche, bool readOnly)
    {
        CurrentId = fiche.Id;
        Version = fiche.Version;
        Owner = fiche.Owner;
        PcName = fiche.PcName;
        StartDate = fiche.StartDate ?? DateTime.Today;
        IsReadOnly = readOnly;

        Tasks.Clear();
        foreach (var t in fiche.Tasks)
        {
            Tasks.Add(new TaskItemViewModel(t.Id, t.Text, t.Done));
        }

        UpdateProgress();
    }

    [RelayCommand]
    private void ShowEditor() => CurrentView = "Editor";

    [RelayCommand]
    private void ShowDrafts()
    {
        CurrentView = "Drafts";
        RefreshLists();
    }

    [RelayCommand]
    private void ShowHistory()
    {
        CurrentView = "History";
        RefreshHistoryFilter();
    }

    [RelayCommand]
    private void NewFiche()
    {
        CurrentId = null;
        IsReadOnly = false;
        EditorTitle = "Nouvelle fiche Todo PC";
        Version = string.Empty;
        Owner = string.Empty;
        PcName = string.Empty;
        StartDate = DateTime.Today;
        NewTaskText = string.Empty;
        Tasks.Clear();
        UpdateProgress();
        CurrentView = "Editor";
    }

    [RelayCommand]
    private void AddTask()
    {
        if (IsReadOnly)
        {
            return;
        }

        var text = NewTaskText.Trim();
        if (string.IsNullOrEmpty(text))
        {
            Toast("Saisissez le libellé de la tâche.");
            return;
        }

        Tasks.Add(new TaskItemViewModel(Guid.NewGuid().ToString("N"), text));
        NewTaskText = string.Empty;
    }

    [RelayCommand]
    private void RemoveTask(TaskItemViewModel? task)
    {
        if (IsReadOnly || task is null)
        {
            return;
        }

        Tasks.Remove(task);
    }

    [RelayCommand]
    private void SaveDraft()
    {
        if (IsReadOnly)
        {
            return;
        }

        var fiche = CollectFiche(keepId: true);
        if (!Validate(fiche))
        {
            return;
        }

        fiche.CreatedAt = DateTime.UtcNow;
        var existing = _store.Drafts.FirstOrDefault(d => d.Id == fiche.Id);
        if (existing != null)
        {
            fiche.CreatedAt = existing.CreatedAt;
            _store.Drafts.Remove(existing);
        }

        CurrentId = fiche.Id;
        _store.Drafts.Insert(0, fiche);
        Persist();
        EditorTitle = $"Brouillon — {fiche.PcName}";
        Toast("Brouillon enregistré.");
    }

    [RelayCommand]
    private void OpenDraft(PcTodoFiche? fiche)
    {
        if (fiche is null)
        {
            return;
        }

        FillEditor(fiche, readOnly: false);
        EditorTitle = $"Brouillon — {fiche.PcName}";
        CurrentView = "Editor";
    }

    [RelayCommand]
    private void DeleteDraft(PcTodoFiche? fiche)
    {
        if (fiche is null)
        {
            return;
        }

        var result = MessageBox.Show(
            $"Supprimer le brouillon « {fiche.PcName} » ?",
            "Confirmation",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question);

        if (result != MessageBoxResult.Yes)
        {
            return;
        }

        _store.Drafts.RemoveAll(d => d.Id == fiche.Id);
        if (CurrentId == fiche.Id)
        {
            NewFiche();
        }

        Persist();
        Toast("Brouillon supprimé.");
    }

    [RelayCommand]
    private void OpenHistoryItem(PcTodoFiche? fiche)
    {
        if (fiche is null)
        {
            return;
        }

        FillEditor(fiche, readOnly: true);
        var end = fiche.EndDate?.ToString("dd/MM/yyyy") ?? "—";
        EditorTitle = $"Historique — {fiche.PcName} (terminé le {end})";
        CurrentView = "Editor";
    }

    [RelayCommand]
    private void DeleteHistory(PcTodoFiche? fiche)
    {
        if (fiche is null)
        {
            return;
        }

        var result = MessageBox.Show(
            $"Retirer « {fiche.PcName} » de l’historique ?",
            "Confirmation",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question);

        if (result != MessageBoxResult.Yes)
        {
            return;
        }

        _store.History.RemoveAll(h => h.Id == fiche.Id);
        if (CurrentId == fiche.Id && IsReadOnly)
        {
            NewFiche();
        }

        Persist();
        Toast("Fiche retirée de l’historique.");
    }

    [RelayCommand]
    private void OpenFinalizeDialog()
    {
        if (IsReadOnly)
        {
            return;
        }

        var fiche = CollectFiche(keepId: true);
        if (!Validate(fiche))
        {
            return;
        }

        EndDate = DateTime.Today;
        IsFinalizeDialogOpen = true;
    }

    [RelayCommand]
    private void CancelFinalize() => IsFinalizeDialogOpen = false;

    [RelayCommand]
    private void ConfirmFinalize()
    {
        var fiche = CollectFiche(keepId: true);
        if (!Validate(fiche))
        {
            return;
        }

        if (EndDate is null)
        {
            Toast("Indiquez la date de fin de préparation.");
            return;
        }

        if (fiche.StartDate.HasValue && EndDate.Value.Date < fiche.StartDate.Value.Date)
        {
            Toast("La date de fin ne peut pas être antérieure à la date de début.");
            return;
        }

        fiche.EndDate = EndDate.Value.Date;
        fiche.FinalizedAt = DateTime.UtcNow;
        fiche.UpdatedAt = DateTime.UtcNow;

        _store.History.Insert(0, fiche);
        _store.Drafts.RemoveAll(d => d.Id == fiche.Id);
        Persist();

        IsFinalizeDialogOpen = false;
        NewFiche();
        CurrentView = "History";
        Toast("Fiche finalisée et ajoutée à l’historique.");
    }

    [RelayCommand]
    private void ExportPdf(PcTodoFiche? ficheOverride = null)
    {
        var fiche = ficheOverride ?? CollectFiche(keepId: true);
        if (ficheOverride is null && !Validate(fiche))
        {
            return;
        }

        var dialog = new SaveFileDialog
        {
            Title = "Exporter la fiche en PDF",
            Filter = "PDF (*.pdf)|*.pdf",
            FileName = $"TodoPC_{Sanitize(fiche.PcName)}_{Sanitize(fiche.Version)}.pdf"
        };

        if (dialog.ShowDialog() != true)
        {
            return;
        }

        try
        {
            _pdf.Export(fiche, dialog.FileName);
            Toast("PDF exporté avec succès.");
            try
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "explorer.exe",
                    Arguments = $"/select,\"{dialog.FileName}\"",
                    UseShellExecute = true
                });
            }
            catch
            {
                // ignore explorer failures
            }
        }
        catch (Exception ex)
        {
            Toast($"Échec de l’export PDF : {ex.Message}");
        }
    }

    [RelayCommand]
    private void PrintFiche(PcTodoFiche? ficheOverride = null)
    {
        var fiche = ficheOverride ?? CollectFiche(keepId: true);
        if (ficheOverride is null && !Validate(fiche))
        {
            return;
        }

        try
        {
            _print.Print(fiche);
            Toast("Impression lancée.");
        }
        catch (Exception ex)
        {
            Toast($"Impression : {ex.Message}");
        }
    }

    private static string Sanitize(string value)
    {
        foreach (var c in Path.GetInvalidFileNameChars())
        {
            value = value.Replace(c, '_');
        }

        return string.IsNullOrWhiteSpace(value) ? "fiche" : value.Trim();
    }
}
