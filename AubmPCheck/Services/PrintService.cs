using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using AubmPCheck.Models;

namespace AubmPCheck.Services;

public class PrintService
{
    public void Print(PcTodoFiche fiche)
    {
        var dialog = new PrintDialog();
        if (dialog.ShowDialog() != true)
        {
            return;
        }

        var doc = BuildDocument(fiche);
        doc.PageHeight = dialog.PrintableAreaHeight;
        doc.PageWidth = dialog.PrintableAreaWidth;
        doc.PagePadding = new Thickness(48);
        doc.ColumnWidth = dialog.PrintableAreaWidth;

        dialog.PrintDocument(((IDocumentPaginatorSource)doc).DocumentPaginator, $"Todo PC — {fiche.PcName}");
    }

    private static FlowDocument BuildDocument(PcTodoFiche fiche)
    {
        var doc = new FlowDocument
        {
            FontFamily = new FontFamily("Segoe UI"),
            FontSize = 12,
            Foreground = Brushes.Black
        };

        doc.Blocks.Add(new Paragraph(new Run("AUBM PCHECK"))
        {
            FontSize = 11,
            FontWeight = FontWeights.Bold,
            Foreground = new SolidColorBrush(Color.FromRgb(31, 154, 133)),
            Margin = new Thickness(0, 0, 0, 2)
        });

        doc.Blocks.Add(new Paragraph(new Run("Fiche Todo PC"))
        {
            FontSize = 20,
            FontWeight = FontWeights.Bold,
            Margin = new Thickness(0, 0, 0, 16)
        });

        var meta = new Table { CellSpacing = 0 };
        meta.Columns.Add(new TableColumn { Width = new GridLength(220) });
        meta.Columns.Add(new TableColumn { Width = new GridLength(1, GridUnitType.Star) });
        var group = new TableRowGroup();
        meta.RowGroups.Add(group);

        void AddMeta(string label, string value)
        {
            var row = new TableRow();
            row.Cells.Add(new TableCell(new Paragraph(new Run(label)))
            {
                BorderBrush = Brushes.LightGray,
                BorderThickness = new Thickness(1),
                Padding = new Thickness(6),
                Background = new SolidColorBrush(Color.FromRgb(243, 247, 250))
            });
            row.Cells.Add(new TableCell(new Paragraph(new Run(value)))
            {
                BorderBrush = Brushes.LightGray,
                BorderThickness = new Thickness(1),
                Padding = new Thickness(6)
            });
            group.Rows.Add(row);
        }

        AddMeta("Version du Todo PC", fiche.Version);
        AddMeta("Propriétaire du PC", fiche.Owner);
        AddMeta("Nom complet du PC", fiche.PcName);
        AddMeta("Date de début de préparation", fiche.StartDate?.ToString("dd/MM/yyyy") ?? "—");
        AddMeta("Date de fin de préparation",
            fiche.EndDate?.ToString("dd/MM/yyyy") ?? "En cours");

        doc.Blocks.Add(meta);

        doc.Blocks.Add(new Paragraph(new Run("Checklist des tâches"))
        {
            FontSize = 14,
            FontWeight = FontWeights.Bold,
            Margin = new Thickness(0, 18, 0, 4)
        });

        doc.Blocks.Add(new Paragraph(new Run($"{fiche.DoneCount} / {fiche.TotalCount} tâches cochées"))
        {
            Foreground = Brushes.DimGray,
            Margin = new Thickness(0, 0, 0, 8)
        });

        if (fiche.Tasks.Count == 0)
        {
            doc.Blocks.Add(new Paragraph(new Run("Aucune tâche")));
        }
        else
        {
            var list = new List();
            foreach (var task in fiche.Tasks)
            {
                var mark = task.Done ? "☑ " : "☐ ";
                var run = new Run(mark + task.Text);
                if (task.Done)
                {
                    run.TextDecorations = TextDecorations.Strikethrough;
                    run.Foreground = Brushes.Gray;
                }

                list.ListItems.Add(new ListItem(new Paragraph(run)));
            }

            doc.Blocks.Add(list);
        }

        return doc;
    }
}
