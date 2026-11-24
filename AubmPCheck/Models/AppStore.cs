namespace AubmPCheck.Models;

public class AppStore
{
    public List<PcTodoFiche> Drafts { get; set; } = new();
    public List<PcTodoFiche> History { get; set; } = new();
}
