# Prüfprotokoll

Stand: 9. November 2026. Auf diesem Windows-PC durchgeführt; alle nachfolgend als bestanden bezeichneten Prüfungen wurden tatsächlich ausgeführt.

## Projektumzug: aktuelle Verifikation

Die folgenden Ergebnisse vom 9. November 2026 ersetzen ältere Angaben zum noch offenen nativen Desktop-Test:

- Codebasis erfasst: `crates/engine` enthält Modelle, Worker-Prozess und HTML-Export; `crates/cli` die Kommandozeile; `browser/src` Crawl und axe-Prüfung; `desktop/src-tauri` die native IPC-Schicht; `desktop/ui` Oberfläche und lokale Projekte.
- Ursache: Der Workerpfad enthielt das beim Build verwendete Projektverzeichnis. Zusätzlich enthielt ein CMD-Starter einen festen Node-Installationspfad; der Suchpfad der laufenden Sitzung war veraltet.
- Workerpfade werden nun zur Laufzeit über `A11Y_WORKER`, EXE-Verzeichnis/Vorfahren und Arbeitsverzeichnis/Vorfahren aufgelöst. Starter ermitteln Projekt und Werkzeuge dynamisch und prüfen Node-Version sowie Browserabhängigkeiten.
- `cargo test --locked`: 7 Tests bestanden, einschließlich verschobenem Projektpfad mit Leerzeichen und fremdem Arbeitsverzeichnis.
- `cargo fmt --all -- --check` und `cargo clippy --locked --all-targets -- -D warnings`: bestanden.
- `cargo build --locked -p a11y-cli -p a11y-desktop`: bestanden; beide Debug-Programme aktualisiert.
- Browser: 6 Unitprüfungen, 9 Chromiumprüfungen und 1 Report-UI-Test bestanden.
- CLI-Integration bestanden, einschließlich kopierter EXE in einem temporären Projektpfad mit Leerzeichen, Browser-Junction und fremdem Arbeitsverzeichnis ohne `A11Y_WORKER`.
- Nativer Windows-/WebView2-Test bestanden: echter IPC-Scan, Filter, manuelle Bewertung und JSON-/HTML-Downloads; keine JavaScript-Fehler und keine erkannten axe-Verstöße im geprüften Ablauf.
- Beide CMD-Starter mit `-CheckOnly` aus fremdem Arbeitsverzeichnis geprüft; relative Worker-/Targetpfade mit Leerzeichen ebenfalls geprüft.

Die Desktop-App benötigt weiterhin Node.js, die Browserabhängigkeiten und das passende Playwright-Chromium. Ein vollständiges manuelles Barrierefreiheitsaudit war nicht Gegenstand der Umzugsreparatur.

## Erweiterung Prüfkatalog / Report (historisch)

Die folgenden Ergebnisse beziehen sich auf die neue Ausgabe mit 139 Prüfpunkten und haben Vorrang vor den historischen MVP-Ergebnissen weiter unten:

- `npm test`: 6 Tests bestanden, einschließlich Kriterienkatalog und konservativer Befundzuordnung.
- `npm run test:browser`: 9 Tests mit echtem Chromium bestanden, neues JSON gegen Schema validiert und Beispielbericht aktualisiert.
- `cargo test --locked`: 6 Tests bestanden, einschließlich Roundtrip und sicherem HTML-Export manueller Bewertungen.
- `cargo fmt --all -- --check` und `cargo clippy --locked --all-targets -- -D warnings`: bestanden.
- `npm run test:cli`: bestanden, echte Rust-CLI und Berichtsdateien.
- `npm run test:report-ui`: bestanden. Chromium prüft die tatsächlichen UI-Dateien mit eingespeistem Beispielbericht: Seitennavigation, Suche, Filter, Notizpflicht, Schutz gegen Überschreiben automatischer Fehler, manuellen JSON-Export, schmale Ansicht ohne horizontalen Seitenüberlauf und axe-Prüfung ohne erkannte A/AA-Verstöße. Screenshot `docs/report-ui.png` visuell geprüft. Dieser Test ersetzt keinen nativen IPC-Test.
- Regulärer Desktop-Build: nach dem Schließen der laufenden Anwendung mit `cargo build --locked -p a11y-desktop` erfolgreich aktualisiert. Der normale `Start-Desktop.cmd` verwendet jetzt den neuen Build.
- Nativer Desktop-Test: weiterhin **nicht bestanden**, da über den WebView2-Debugginganschluss keine erreichbare Scanner-Seite gefunden wird. Beim zusätzlichen Diagnoseversuch war der Anschluss nach der anfänglichen Verbindung nicht mehr erreichbar. Der erfolgreiche Desktop-Build ist damit bestätigt, der vollständige native IPC-/Exportablauf weiterhin nicht.

Manuelle Tastatur-/Screenreader-Prüfung der gesamten App und Dokumentprüfungen bleiben offen. Die neue Darstellung ist kein Konformitätsnachweis.

## Umgebung

- Windows x64, MSVC Build Tools 2026, Windows SDK.
- rustc 1.99.1, cargo 1.99.1.
- Node.js 26.13.0, npm 11.20.0.
- Tauri Rust 2.12.5, Tauri CLI 2.12.4.
- axe-core 4.14.0; genaue JavaScript- und Rust-Abhängigkeiten in den Lockdateien.
- Playwright mit dem dazugehörigen heruntergeladenen Chromium.
- WebView2 157.0.4341.42 für die native Desktop-Oberfläche.

## Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| Rust-Minimalprogramm kompilieren und ausführen | Bestanden |
| `npm test` | 4 Unit-Tests bestanden |
| `npm run test:browser` | 9 Prüfungen einschließlich robots-Regressionen und Start-Weiterleitungen bestanden |
| `cargo test --locked` | 5 Rust-Tests bestanden |
| `cargo fmt --all -- --check` | Bestanden |
| `cargo clippy --locked --all-targets -- -D warnings` | Bestanden, Engine und CLI |
| `cargo clippy --locked -p a11y-desktop --all-targets -- -D warnings` | Bestanden |
| `cargo build --locked -p a11y-cli` | Windows-Binary erfolgreich erstellt |
| `cargo build --locked -p a11y-desktop` | Windows-Binary erfolgreich erstellt |
| `npm run test:cli` | Echte Rust-CLI → Worker → Chromium → Berichtsdateien bestanden |
| `npm run test:desktop` | Native Tauri-/WebView2-App mit echtem Rust-IPC und Scan bestanden |

Insgesamt **20 Tests** über alle Testsuiten, wobei die Integrationstests jeweils zahlreiche Einzelfälle prüfen. Der native Desktop-Test ist unter Linux bewusst als übersprungen markiert; das ist keine Linux-Verifikation.

## Geprüfte Funktionen

Browser: fehlende Alternativtexte, namenlose Buttons, fehlende Labels und Seitensprache werden tatsächlich erkannt. Die gute Fixture-Seite hat keine erkannten automatischen Fehler. Der Crawl entfernt Fragmente, prüft die gute Seite nur einmal, folgt keinen mailto-Links und prüft `/private` trotz Disallow. HTTP 404 wird als Scanfehler gemeldet. Seiten-/Tiefenlimits und Redirects innerhalb der Origin funktionieren. Die initiale Weiterleitung darf die Origin wechseln und setzt die endgültige Crawl-Origin; spätere Redirects außerhalb dieser Origin werden blockiert. Der echte Worker liefert gültiges JSON; die Ausgabe wird gegen das mitgelieferte Schema validiert.

Regression zum gemeldeten Fehler „robots.txt nicht lesbar (HTTP 301)“: separate Fixture-Konfigurationen für 301, 403, 500, Weiterleitungsschleife, ausbleibende Antwort und Disallow wurden geprüft. In allen Fällen wird die Zielseite erfolgreich gescannt; der Scanner sendet gar keine Anfrage an robots.txt. Deshalb kann diese Datei weder eine zusätzliche Fehlerquelle noch eine Wartezeit verursachen.

CLI: `--fail-on serious` liefert bei der fehlerhaften Testseite Exitcode 3; die gute Seite liefert trotz aktivierter Schwelle 0. Der gemischte Crawl mit 404 liefert 2. Eine file-URL wird mit 1 zurückgewiesen. JSON- und HTML-Dateien wurden gelesen und inhaltlich geprüft.

Desktop: Das tatsächliche Windows-Binary wurde gestartet und seine WebView2 über einen temporären lokalen Debuggingport automatisiert. Eingabe, Scanbutton, Ergebniszusammenfassung, vier Seitenabschnitte, aufklappbare DOM-Befunde und Filter wurden geprüft. Beide Export-Schaltflächen lösen echte Downloads aus; JSON und HTML wurden gespeichert. Zusätzlich wurde der gemeinsame HTML-Exporter über Tauri-IPC aufgerufen.

Die Scanner-Oberfläche wurde nach einem echten Scan selbst mit axe geprüft: **0 erkannte Verstöße** gegen die ausgewählten automatischen WCAG-A/AA-Regeln. Das ist kein vollständiger Nachweis der Barrierefreiheit der App. Keine JavaScript-Seitenfehler im getesteten Ablauf. Ein Screenshot der echten WebView befindet sich in `docs/desktop.png`.

HTML-Ausgabe: Der echte Beispielbericht lässt sich unverändert durch die Rust-Modelle serialisieren. Ein zusätzlicher Test setzt bösartigen Seitentitel, HTML-Ausschnitt und eine javascript-Dokumentationsadresse ein und prüft, dass daraus kein aktives HTML/Link wird.

## Beispielbericht

`examples/report.json` stammt aus einem echten Scan des lokalen Fixture-Servers auf einem dynamischen Port. `examples/report.html` wurde daraus durch die gemeinsame Rust-Engine erzeugt. Ergebnis: drei erfolgreich geprüfte Seiten, eine Fehlerseite, sechs automatische Regelbefunde mit sechs betroffenen Elementen. Keine robots-Ausschlüsse. Der Port im Bericht ist historisch und muss nicht mehr erreichbar sein.

## Offen / nicht auf diesem Rechner verifiziert

- Linux-Build und native Linux-Laufzeit: Quellcode und Anleitung vorbereitet, hier nicht ausgeführt.
- Release-/Installer-Build, Signierung, automatisch mitgelieferte Node-/Chromium-Laufzeit: außerhalb des Entwickler-MVPs.
- Vollständige manuelle Tastatur-/Screenreader-Prüfung, angemeldete Websites, Captchas und umfangreiche SPA-Abläufe.
- Abbrechen, Schließen während eines laufenden Scans und harte Prozessbeendigung sind noch nicht produktreif abgesichert.

Frühe Prüfungen fanden einen Windows-Datei-URL-Pfadfehler im Test und ein fehlendes Tauri-Icon. Beides ist behoben; die betreffenden Prüfungen wurden danach erfolgreich wiederholt.

## Dashboard und Aufgaben (2026-11-09)

Neue Bereiche: Uebersicht, Website pruefen, Verbesserungen und manuelle Checkliste. Der letzte Bericht einschliesslich Aufgaben und manuellen Notizen wird lokal gespeichert; ein neuer Scan setzt manuelle Bestaetigungen zurueck. Aufgaben werden nach Auswirkung und Anzahl betroffener Elemente gruppiert. Scanvergleiche beziehen sich auf Fehlerarten, nicht auf einen Konformitaetsscore.

Browser-Regressionen bestanden: Navigation, Filter und Pagination, manuelle Nachweise, JSON-Export, Aufgabenstatus nach Neuladen, Checklistenstatus nach Neuladen und Zuruecksetzen nach erneutem Scan, Vergleich. Automatischer axe-Check ohne Befunde; mobile Ansicht ohne horizontales Scrollen. Engine-/Katalogtests: 6 bestanden.

Desktop-Binary mit eingebetteten Assets neu gebaut (`cargo build -p a11y-desktop --features tauri/custom-protocol --offline`). Der native End-to-End-Test konnte diesmal keine WebView-Seite am Debuggingport finden; deshalb ist der aktuelle native Scan-/Export-Ablauf nicht verifiziert. Die Browser-Oberflaechentests verwenden eine simulierte Tauri-Schnittstelle.

## Projektverwaltung (2026-11-09)

Lokales Speicherformat v2 mit getrennten Projekten (Name, URL, letzter Bericht samt Bearbeitungsständen). Der bisherige Einzelbericht wird beim ersten Laden migriert; der alte Speicherschlüssel wird erst nach erfolgreichem Schreiben entfernt. Projektanlage, Wechsel und bestätigtes Löschen sind während eines Scans gesperrt. Löschen entfernt ausschließlich das gewählte Projekt; exportierte Dateien bleiben erhalten. Eine Löschung wird nur bei erfolgreichem Schreiben des verbleibenden Projektbestands übernommen.

Geprüft: zwei getrennte Projekte, Isolation der Aufgabenstände, Projektwechsel, Abbruch des Löschdialogs, Löschen des aktiven Projekts, letztes Projekt löschen, Neuladen ohne Wiederherstellung gelöschter Daten, Übernahme alter manueller Nachweise. Sieben Tests bestanden (UI, Engine und Katalog); axe-Projektansicht ohne Befunde, mobile Ansicht ohne horizontales Scrollen. Screenshot: projects-ui.png. Desktop-Binary mit eingebetteten Assets neu gebaut; der zuvor dokumentierte native WebView-Test wurde für diese Änderung nicht erneut ausgeführt.
