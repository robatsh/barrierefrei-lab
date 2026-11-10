# Mitwirken

## Einrichtung

Die Voraussetzungen und Installation stehen in der [README](README.md). Alle folgenden Befehle im Ordner `a11y-scanner` ausführen. `npm ci` und `npm run setup` installieren die gesperrten JavaScript-Abhängigkeiten und Chromium. Cargo-Aufrufe mit `--locked` verwenden.

## Änderungen prüfen

Für Änderungen an der betroffenen Komponente die passenden Prüfungen ausführen:

```sh
npm test
cargo test --locked
cargo fmt --all -- --check
cargo clippy --locked --all-targets -- -D warnings
npm run test:browser
npm run test:report-ui
```

Für CLI-Integration zuerst `cargo build --locked -p a11y-cli`, danach `npm run test:cli`. Für native Desktop-Integration unter Windows zuerst `cargo build --locked -p a11y-desktop`, danach `npm run test:desktop`; diese Prüfung öffnet ein Fenster und benötigt WebView2. Details und Einschränkungen stehen in der README.

Änderungen an Berichtsformat, Befundzuordnung oder manuellen Bewertungen auch gegen das JSON-Schema und die vorhandenen Integrationstests prüfen. Neue Funktionalität verständlich dokumentieren. Testergebnisse mit Umgebung und Datum festhalten; historische Protokolle sind keine Zusage für andere Systeme.

## Pull Requests und Fehlerberichte

Problem, erwartetes und tatsächliches Verhalten sowie ausgeführte Prüfungen beschreiben. Bei UI-Änderungen geeignete Screenshots ergänzen. Reproduktionsbeispiele möglichst mit der lokalen Fixture-Website erstellen. Keine Zugangsdaten, privaten Website-Inhalte oder ungeprüften Scanberichte hochladen.

Lockdateien bei Abhängigkeitsänderungen mit aktualisieren. Generierte Laufzeitdateien bleiben außerhalb von Git.

Beiträge werden unter der [MIT-Lizenz](LICENSE) des Projekts eingereicht. Stelle sicher, dass du die nötigen Rechte besitzt. Fremdcode und dessen Lizenzbedingungen kennzeichnen.
