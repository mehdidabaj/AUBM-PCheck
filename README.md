# AUBM PCheck (Flutter multiplateforme)

Application de fiches de préparation PC avec checklist, historique SQLite, export PDF et impression.

**Plateformes :** Windows · Linux · Web · Android

## Fonctionnalités

- Version, propriétaire, nom du PC, date de début
- Tâches ajoutées / cochées / supprimées
- Brouillons + finalisation (date de fin) → historique recherchable
- Export PDF / impression
- Stockage SQLite (pas de JSON, pas de WPF)

## Prérequis

- [Flutter SDK](https://docs.flutter.dev/get-started/install) (3.22+)
- Pour Windows desktop : Visual Studio avec charge « Desktop development with C++ »
- Pour Linux desktop : `clang`, `cmake`, `ninja`, `gtk3`
- Pour Android : Android Studio / SDK
- Pour Web : Chrome

## Lancer

```bash
flutter pub get
flutter run -d windows    # ou chrome, linux, android
```

## Build / déploiement

### Windows
```bash
flutter build windows
# sortie : build/windows/x64/runner/Release/
```

### Linux
```bash
flutter build linux
# sortie : build/linux/x64/release/bundle/
```

### Web
```bash
dart run sqflite_common_ffi_web:setup   # une fois
flutter build web
# déployer le dossier build/web/
```

### Android
```bash
flutter build apk --release
# APK : build/app/outputs/flutter-apk/app-release.apk
```

## Données

- Desktop : dossier support de l'application (`todos.db`)
- Android : stockage app local
- Web : SQLite Wasm dans le navigateur

## Structure

```
lib/
  main.dart
  models/
  data/
  services/
  state/
  ui/
```
