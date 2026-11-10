# Erste Git-Veröffentlichung

## Repository-Struktur

Bei der Vorbereitung lag das Git-Hauptverzeichnis eine Ebene über diesem Projekt: `barrieretool/`, mit dem Quellcode in `a11y-scanner/`. Die folgenden Git-Befehle werden im Projektordner ausgeführt und verwenden dieses vorhandene Repository. Kein zusätzliches verschachteltes Repository initialisieren.

Die README im Projektordner ist die ausführliche Projektdokumentation. Die README im übergeordneten Repository enthält den Gesamtüberblick und verlinkt auf `a11y-scanner/README.md`.

## Inhalt kontrollieren und übernehmen

```sh
git status --short --untracked-files=all
git add --dry-run -- .
git add -- .
git diff --cached --stat
git diff --cached --check
git diff --cached
```

Den vollständigen vorgemerkten Inhalt vor dem Commit prüfen. Insbesondere eigene Scanberichte, lokale Konfiguration, Zugangsdaten und Binärpakete gehören nicht in den Quellcode-Commit. `.gitignore` verhindert kein versehentliches übernehmen bereits versionierter Dateien und ersetzt keine Prüfung. `Cargo.lock` und beide `package-lock.json` gehören ins Repository. Die bewusst versionierten Berichte in `examples/` verwenden ausschließlich die lokale Testwebsite.

Anschließend einen Commit erstellen:

```sh
git commit -m "Prepare accessibility scanner source and documentation"
git remote -v
git branch --show-current
```

Vor einem Push das gewünschte Ziel-Repository und den tatsächlichen Branchnamen festlegen. Noch fehlende Remote-Konfiguration mit der URL des eigenen Repositorys ergänzen; danach `git push -u origin HEAD` ausführen. Bei bereits vorhandenem Remote dessen URL zuerst prüfen. Diese Vorbereitung führt weder Commit noch Push aus.

## Umfang

`node_modules/`, `target/`, `dist/`, Tauri-generierte Dateien, Testausgaben und `reports/` sind ausgeschlossen. Releasepakete separat als Release-Artefakte verteilen. Icons, Screenshots, Schema und Fixture-Beispiele bleiben Teil des Quellcodes. Die vorhandene MIT-Lizenz bleibt erhalten.
