using System.IO;
using System.Text;
using System.Windows;
using System.Windows.Threading;

namespace AubmPCheck;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        DispatcherUnhandledException += OnDispatcherUnhandledException;
        AppDomain.CurrentDomain.UnhandledException += OnUnhandledException;
        TaskScheduler.UnobservedTaskException += OnUnobservedTaskException;

        try
        {
            // Ensure native SQLite provider is initialized early (publish folder / single-file).
            SQLitePCL.Batteries_V2.Init();
        }
        catch (Exception ex)
        {
            ShowFatalError("Initialisation SQLite", ex);
            Shutdown(1);
        }
    }

    private void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        ShowFatalError("Erreur application", e.Exception);
        e.Handled = true;
    }

    private static void OnUnhandledException(object sender, UnhandledExceptionEventArgs e)
    {
        if (e.ExceptionObject is Exception ex)
        {
            ShowFatalError("Erreur fatale", ex);
        }
    }

    private static void OnUnobservedTaskException(object? sender, UnobservedTaskExceptionEventArgs e)
    {
        ShowFatalError("Erreur tâche", e.Exception);
        e.SetObserved();
    }

    private static void ShowFatalError(string title, Exception ex)
    {
        try
        {
            var logDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "AubmPCheck",
                "logs");
            Directory.CreateDirectory(logDir);
            var logPath = Path.Combine(logDir, $"error-{DateTime.Now:yyyyMMdd-HHmmss}.log");
            File.WriteAllText(logPath, BuildErrorText(title, ex), Encoding.UTF8);

            MessageBox.Show(
                $"{ex.Message}\n\nDétails enregistrés dans :\n{logPath}",
                $"AUBM PCheck — {title}",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
        catch
        {
            MessageBox.Show(ex.ToString(), $"AUBM PCheck — {title}", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private static string BuildErrorText(string title, Exception ex)
    {
        var sb = new StringBuilder();
        sb.AppendLine(title);
        sb.AppendLine(DateTime.Now.ToString("O"));
        sb.AppendLine(ex.ToString());
        return sb.ToString();
    }
}
