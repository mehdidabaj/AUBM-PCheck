using System.Windows;
using System.Windows.Input;
using AubmPCheck.ViewModels;

namespace AubmPCheck;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    private void NewTaskBox_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter && DataContext is MainViewModel vm)
        {
            vm.AddTaskCommand.Execute(null);
            e.Handled = true;
        }
    }

    private void ModalBackdrop_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (DataContext is MainViewModel vm)
        {
            vm.CancelFinalizeCommand.Execute(null);
        }
    }
}
