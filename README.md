# AUBM PCheck (C# / WPF)

Application desktop **Windows** native pour créer des fiches de préparation PC avec checklist, historique, export PDF et impression.

## Fonctionnalités

- Version du Todo PC, propriétaire, nom complet du PC, date de début
- Ajout / suppression / coches des tâches
- Brouillons enregistrés localement
- Finalisation avec date de fin → historique recherchable
- Export PDF (QuestPDF) et impression Windows native

## Prérequis

- Windows 10/11
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- Visual Studio 2022 (charge de travail **Développement Desktop .NET**) **ou** ligne de commande

## Lancer en développement

```powershell
dotnet restore
dotnet run --project AubmPCheck
```

Ou ouvrir `AubmPCheck.sln` dans Visual Studio puis F5.

## Déployer / publier pour Windows

### Option A — dossier autonome (recommandé pour partage USB / réseau)

```powershell
dotnet publish AubmPCheck\AubmPCheck.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o .\publish
```

Résultat : un dossier `publish\` avec `AubmPCheck.exe`.  
Copiez ce dossier sur les PC cibles et lancez `AubmPCheck.exe`.

### Option B — framework-dependent (plus léger, .NET 8 Desktop Runtime requis)

```powershell
dotnet publish AubmPCheck\AubmPCheck.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o .\publish
```

### Option C — Visual Studio

1. Clic droit sur le projet → **Publier**
2. Dossier / dossier réseau
3. Mode autonome (`win-x64`) + fichier unique si souhaité
4. Publier

## Données

Stockage local JSON :

`%AppData%\AubmPCheck\data\todos.json`

## Structure

```
AubmPCheck.sln
AubmPCheck/
  Models/          # Fiches, tâches, store
  Services/        # JSON, PDF, impression
  ViewModels/      # MVVM (CommunityToolkit)
  Themes/          # Styles WPF
  MainWindow.xaml  # Interface
```
