using CommunityToolkit.Mvvm.ComponentModel;

namespace AubmPCheck.ViewModels;

public partial class TaskItemViewModel : ObservableObject
{
    public string Id { get; }

    [ObservableProperty]
    private string _text = string.Empty;

    [ObservableProperty]
    private bool _done;

    public TaskItemViewModel(string id, string text, bool done = false)
    {
        Id = id;
        _text = text;
        _done = done;
    }
}
