namespace AubmPCheck.Models;

public class PcTodoFiche
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Version { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;
    public string PcName { get; set; } = string.Empty;
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public List<TaskItem> Tasks { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? FinalizedAt { get; set; }

    public int DoneCount => Tasks.Count(t => t.Done);
    public int TotalCount => Tasks.Count;
    public string ProgressLabel => $"{DoneCount} / {TotalCount} tâches";

    public PcTodoFiche Clone()
    {
        return new PcTodoFiche
        {
            Id = Id,
            Version = Version,
            Owner = Owner,
            PcName = PcName,
            StartDate = StartDate,
            EndDate = EndDate,
            CreatedAt = CreatedAt,
            UpdatedAt = UpdatedAt,
            FinalizedAt = FinalizedAt,
            Tasks = Tasks.Select(t => new TaskItem
            {
                Id = t.Id,
                Text = t.Text,
                Done = t.Done
            }).ToList()
        };
    }
}
