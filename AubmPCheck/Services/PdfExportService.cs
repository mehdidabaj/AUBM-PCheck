using AubmPCheck.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace AubmPCheck.Services;

public class PdfExportService
{
    public PdfExportService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public void Export(PcTodoFiche fiche, string filePath)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(x => x.FontSize(11).FontColor(Colors.BlueGrey.Darken4));

                page.Header().Column(col =>
                {
                    col.Item().Text("AUBM PCHECK")
                        .FontSize(10)
                        .Bold()
                        .FontColor(Colors.Teal.Medium)
                        .LetterSpacing(0.08f);
                    col.Item().Text("Fiche Todo PC").FontSize(20).Bold();
                    col.Item().PaddingTop(8).LineHorizontal(2).LineColor(Colors.Teal.Medium);
                });

                page.Content().PaddingVertical(20).Column(col =>
                {
                    col.Spacing(6);
                    MetaRow(col, "Version du Todo PC", fiche.Version);
                    MetaRow(col, "Propriétaire du PC", fiche.Owner);
                    MetaRow(col, "Nom complet du PC", fiche.PcName);
                    MetaRow(col, "Date de début de préparation", FormatDate(fiche.StartDate));
                    MetaRow(col, "Date de fin de préparation",
                        fiche.EndDate.HasValue ? FormatDate(fiche.EndDate) : "En cours");

                    col.Item().PaddingTop(18).Text("Checklist des tâches").FontSize(14).Bold();
                    col.Item().Text($"{fiche.DoneCount} / {fiche.TotalCount} tâches cochées")
                        .FontColor(Colors.BlueGrey.Medium);

                    col.Item().PaddingTop(8).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(36);
                            columns.RelativeColumn();
                        });

                        foreach (var task in fiche.Tasks)
                        {
                            table.Cell().Border(1).BorderColor(Colors.Grey.Lighten2)
                                .Padding(8).AlignCenter()
                                .Text(task.Done ? "☑" : "☐").FontSize(14);

                            var cell = table.Cell().Border(1).BorderColor(Colors.Grey.Lighten2).Padding(8);
                            if (task.Done)
                            {
                                cell.Text(task.Text).Strikethrough().FontColor(Colors.Grey.Medium);
                            }
                            else
                            {
                                cell.Text(task.Text);
                            }
                        }

                        if (fiche.Tasks.Count == 0)
                        {
                            table.Cell().ColumnSpan(2).Border(1).BorderColor(Colors.Grey.Lighten2)
                                .Padding(8).Text("Aucune tâche");
                        }
                    });
                });

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span("Généré par AUBM PCheck — ");
                    text.Span(DateTime.Now.ToString("g"));
                });
            });
        });

        document.GeneratePdf(filePath);
    }

    private static void MetaRow(ColumnDescriptor col, string label, string value)
    {
        col.Item().Border(1).BorderColor(Colors.Grey.Lighten2).Row(row =>
        {
            row.ConstantItem(200).Background(Colors.Grey.Lighten4).Padding(8)
                .Text(label).SemiBold().FontColor(Colors.BlueGrey.Medium);
            row.RelativeItem().Padding(8).Text(value);
        });
    }

    private static string FormatDate(DateTime? date) =>
        date?.ToString("dd/MM/yyyy") ?? "—";
}
