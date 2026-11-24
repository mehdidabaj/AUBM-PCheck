# AUBM PCheck (C# / WPF)

Application desktop **Windows** native pour créer des fiches de préparation PC avec checklist, historique, export PDF et impression.

## Fonctionnalités

- Version du Todo PC, propriétaire, nom complet du PC, date de début
- Ajout / suppression / coches des tâches
- Brouillons enregistrés localement
- Finalisation avec date de fin → historique recherchable
- Export PDF (QuestPDF) et impression Windows native
- Stockage **SQLite**

## Prérequis

- Windows 10/11
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) (pour compiler / publier)

## Lancer en développement

```powershell
dotnet restore
dotnet run --project AubmPCheck
```

## Publier l’exécutable (recommandé)

```powershell
.\publish.ps1
```

Ou manuellement :

```powershell
dotnet publish AubmPCheck\AubmPCheck.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o .\publish
```

Puis lancez :

```powershell
.\publish\AubmPCheck.exe
```

**Important :** copiez **tout le dossier** `publish\` (l’exe + les DLL natives SQLite/Skia).  
Ne déplacez pas seulement `AubmPCheck.exe` seul.

### Pourquoi pas `PublishSingleFile=true` par défaut ?

SQLite et QuestPDF (Skia) ont besoin de bibliothèques natives (`.dll`).  
Un exe unique sans extraction native fait souvent planter l’app au démarrage sans message.

Si vous voulez quand même un fichier unique :

```powershell
dotnet publish AubmPCheck\AubmPCheck.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:IncludeAllContentForSelfExtract=true -o .\publish
```

## Données / logs

- Base SQLite : `%AppData%\AubmPCheck\data\todos.db`
- Logs d’erreur : `%AppData%\AubmPCheck\logs\`

## Structure

```
AubmPCheck.sln
AubmPCheck/
  Models/
  Services/        # SQLite, PDF, impression
  ViewModels/
  Themes/
  MainWindow.xaml
publish.ps1
```
