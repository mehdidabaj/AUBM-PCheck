namespace AubmPCheck.Models;

public class TaskItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Text { get; set; } = string.Empty;
    public bool Done { get; set; }
}
