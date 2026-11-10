# A11y Scanner

Lokaler Barrierefreiheitsscanner mit Rust-CLI, Tauri-Desktop-App und Playwright/axe-core. Entwicklungsstand: Prototyp (0.1.0). Open Source unter der [MIT-Lizenz](LICENSE).

Mit Unterstützung künstlicher Intelligenz entwickelt. Private und geschäftliche Nutzung, Weiterentwicklung, Weitergabe und Einbau in andere Projekte sind erlaubt, auch kommerziell. Details und Haftungshinweise: [Entwicklungs- und Nutzungshinweise](NOTICE.md).

[Installation](#installation) · [Tests und Builds](#tests-und-builds) · [Mitwirken](CONTRIBUTING.md) · [Git-Veröffentlichung](docs/git-publication.md)

## Prüfkatalog und kompakter Bericht

Der Bericht enthält jetzt **139 Prüfpunkte**: 50 WCAG-2.1-Kriterien A/AA einschließlich des für EN 301 549 V3.2.1 weiterhin relevanten Parsing-Kriteriums, 43 zusätzliche Web-Prüfaufträge sowie 46 dokumentbezogene Anforderungen aus Kapitel 10 (einschließlich Live-Untertiteln). Grundlage sind [WCAG 2.1](https://www.w3.org/TR/WCAG21/) und die explizit versionierte [EN 301 549 V3.2.1](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf). Der Katalog ist eine eigene Prüfhilfe, kein offizieller BIK-Test und keine vollständige Prüfung aller ICT-Produkte nach EN 301 549.

Die Desktop-Ausgabe bietet Suche, Befundfilter, fünf Seiten pro Abschnitt und aufklappbare Seiten, Regeln sowie Elemente. Der Prüfkatalog zeigt zehn Einträge je Abschnitt und lässt sich nach Standard, Bewertung und Suchtext filtern. Zu jedem Eintrag stehen Anwendbarkeit und manuelle Prüfhilfe bereit. „Manuell erfüllt“ und „nicht anwendbar“ erfordern eine Notiz; automatisch gefundene Verstöße lassen sich nicht als bestanden überschreiben. Nach einer Korrektur erneut scannen.

Unter Windows startet **`Start-Desktop.cmd`** den lokalen Debug-Build und erstellt ihn bei Bedarf. Bisherige Testergebnisse samt Datum und Umgebung stehen im [Prüfprotokoll](docs/validation.md).

Projekte, Berichte, Aufgabenstände und Prüfnotizen werden lokal im Speicher der Desktop-App gesichert und beim nächsten Start wieder geladen. JSON und HTML übernehmen Bewertungen und Notizen. Für eine zusätzliche Sicherung Berichte exportieren; die Oberfläche meldet fehlgeschlagene lokale Speicherung. Die HTML-Ausgabe ist eigenständig, offline lesbar und ohne JavaScript: Navigation, Seitenübersicht und verschachtelte aufklappbare Details begrenzen das Scrollen.

Einträge ohne automatische Verstöße bleiben offen. Ein erfolgreiches axe-Regelergebnis bedeutet nicht, dass ein ganzes Erfolgskriterium erfüllt ist. Dokumente, Echtzeitkommunikation, Medienfunktionen, Autorenwerkzeuge und Support sind gesonderte manuelle Prüfaufträge. Die EN-Einträge verwenden eigene, verkürzte Hilfetexte; für normative Bedingungen, Ausnahmen und Messwerte ist die verlinkte Klausel maßgeblich. Vorhandene WCAG-2.2- und Best-Practice-Regeln bleiben zusätzliche automatische Hinweise.

Lokaler Website-Barrierefreiheitsscanner für Windows und Linux: eine gemeinsame Rust-Engine, eine Rust-CLI und eine Tauri-2-Desktop-App. Der Browser-Worker verwendet Playwright/Chromium und axe-core. Keine Cloud, kein Konto nötig.

**MVP:** Eine HTTP(S)-Startadresse eingeben, interne Links begrenzt verfolgen, HTML-Seiten prüfen und JSON/HTML-Berichte mit Elementselektoren, HTML-Ausschnitten und möglichen Korrekturen erhalten. Automatische Fehler und manuell zu prüfende axe-Befunde bleiben getrennt. Das Ergebnis ist kein Konformitätsnachweis.

## Weitergebbarer Windows-Ordner

`powershell -ExecutionPolicy Bypass -File scripts/build-windows-release.ps1` erstellt
`dist/A11y-Scanner-Windows-x64` mit optimierten Desktop-/CLI-Programmen, Node.js,
Worker, Chromium und Lizenzen. Den gesamten Ordner weitergeben und dort
`Start-A11y-Scanner.cmd` starten. Auf dem Ziel-PC werden Windows 10/11 x64 und
Microsoft Edge WebView2 Runtime benötigt. Node, Rust und npm sind bereits durch
die mitgelieferten Laufzeitdateien abgedeckt. Details stehen in `LIESMICH.txt`.
Das Buildskript benötigt die oben beschriebenen Entwicklerabhängigkeiten und
installierte Playwright-Browser. Ein vorhandener Release-Ordner wird nicht überschrieben.

## Voraussetzungen für die Entwicklung

- Node.js ab 22 mit npm.
- Aktuelles stabiles Rust mit Cargo, Edition 2021.
- Windows: Microsoft C++ Build Tools mit „Desktopentwicklung mit C++“, Windows SDK und WebView2.
- Linux: Compiler und Tauri-Systembibliotheken. Für Debian/Ubuntu typischerweise:

```sh
sudo apt-get update
sudo apt-get install build-essential pkg-config libwebkit2gtk-4.1-dev \
  libxdo-dev libssl-dev librsvg2-dev libayatana-appindicator3-dev
```

Die Desktop-App benötigt eine grafische Sitzung. Die CLI läuft headless. Siehe die aktuellen [Tauri-Voraussetzungen](https://v2.tauri.app/start/prerequisites/) für deine Distribution.

## Installation

Ein Terminal im Projektordner `a11y-scanner` öffnen:

```sh
npm ci
npm run setup
cargo build --locked -p a11y-cli
```

Unter Linux gegebenenfalls statt des letzten Browser-Installationsschritts zusätzlich:

```sh
npx --prefix browser playwright install --with-deps chromium
```

Unter Windows kann `npm.cmd` anstelle von `npm` nötig sein, wenn PowerShell das npm-Skript sperrt. Nach einer Werkzeuginstallation ein neues Terminal öffnen, damit der Suchpfad aktuell ist.

## In drei Schritten ausprobieren

1. Terminal A, lokale Beispielwebsite starten:

```sh
npm run fixture
```

2. Terminal B, Rust-CLI starten:

```sh
cargo run --locked -p a11y-cli -- http://127.0.0.1:4179 --max-pages 5 --output reports/demo
```

Die Testwebsite hat bewusst eine fehlerhafte Seite, eine gute Seite, eine in robots.txt gesperrte (aber trotzdem geprüfte) Seite und einen 404-Link. Daher liefert dieser Scan **Exitcode 2**, schreibt aber beide Berichte. `reports/demo/report.html` im Browser öffnen. `examples/report.json` und `examples/report.html` sind echte Beispielausgaben der lokalen Testwebsite; der Port im gespeicherten Beispiel kann abweichen.

3. Desktop-App starten:

```sh
npm run desktop
```

Die Testadresse ist vorausgefüllt. „Scan starten“ prüft dieselben Seiten über dieselbe Engine. Befunde lassen sich aufklappen und filtern. JSON und HTML können über die Oberfläche gespeichert werden.

Nach der Installation kann **`Start-Desktop.cmd` per Doppelklick** verwendet werden; der Starter ermittelt die benötigten Werkzeuge und erstellt einen fehlenden Debug-Build. Die lokale Testwebsite separat mit `npm run fixture` starten oder eine eigene Website-Adresse eingeben. Nach Quellcodeänderungen `npm run desktop` verwenden; der Doppelklickstarter baut nur, falls noch keine ausführbare Datei existiert. `Start-Pruefkatalog.cmd` verwendet denselben Starter. Beide ermitteln Projekt, Node und Worker dynamisch; `CARGO_HOME` und `CARGO_TARGET_DIR` werden berücksichtigt. Mit `Start-Desktop.cmd -CheckOnly` lassen sich Pfade und Abhängigkeiten prüfen, ohne ein Fenster zu öffnen.

## Eigene Website prüfen

```sh
cargo run --locked -p a11y-cli -- https://example.org \
  --max-pages 20 --max-depth 2 --timeout-ms 20000 --settle-ms 700 \
  --delay-ms 300 --output reports/example --fail-on serious
```

Die mehrzeilige Schreibweise oben ist für Bash. Unter PowerShell den Befehl auf einer Zeile ausführen oder Backticks zur Fortsetzung verwenden.

| Option | Standard | Bedeutung |
| --- | --- | --- |
| `--max-pages` | 10 | Maximal 1–100 abgearbeitete URLs, Fehler/übersprungene Ziele zählen mit |
| `--max-depth` | 2 | Linktiefe 0–5; Startseite ist Tiefe 0 |
| `--timeout-ms` | 15000 | Timeout je Navigation bzw. axe-Prüfung, 1000–60000 ms |
| `--settle-ms` | 300 | Wartezeit nach DOM-Laden, 0–5000 ms |
| `--delay-ms` | 200 | Pause zwischen Seiten, 0–5000 ms |
| `--output` | reports | Verzeichnis für `report.json` und `report.html`; vorhandene Berichte werden ersetzt |
| `--fail-on` | aus | `minor`, `moderate`, `serious`, `critical`; diese Stufe und schwerere Fehler |
| `--worker` | Projektpfad | Alternativer Browser-Worker |

Exitcodes: **0** Scan ohne Seitenfehler und ohne ausgelöste Fehlerschwelle; **1** Start-/Protokoll-/Dateifehler; **2** Seitenfehler oder keine geprüfte Seite; **3** `--fail-on` ausgelöst. CLI-Aufruffehler von clap verwenden ebenfalls **2**. Seitenfehler haben Vorrang vor der Fehlerschwelle. Ein Exitcode 0 bedeutet keine bestätigte Barrierefreiheit. Ein durch Limits verkürzter Scan kann ebenfalls 0 liefern; `scope.truncated` beachten.

## Architektur und Projektstruktur

```text
CLI (clap) ─────────────┐
                       ├─ a11y-engine (Rust) ── JSON stdin/stdout ── Node-Worker
Tauri UI → Rust-Command ┘         │                                  │
                         Modelle / Grenzen                    Playwright Chromium
                         Prozesssteuerung                          │
                         HTML-Bericht                         axe-core im DOM
```

```text
Cargo.toml / Cargo.lock    Rust-Workspace, Default: CLI + Engine
crates/engine/            Gemeinsame Typen, Validierung, Worker-Prozess, HTML
crates/cli/               Argumente, Dateien, CI-Exitcodes
browser/src/              Crawl, Browserprüfung, Befundnormalisierung
browser/test/             Unit- und echte Chromium-Integrationstests
browser/fixtures/         Lokale Testwebsite
desktop/src-tauri/        Tauri-Binary, Commands, Konfiguration, Berechtigungen
desktop/ui/               Statische zugängliche Oberfläche, ohne Frontend-Framework
schema/report.schema.json Versionierter JSON-Vertrag
examples/                 Generierte Beispielberichte
docs/                     Architekturentscheidungen und Entwicklungsplan
```

Rust bleibt der gemeinsame Einstiegspunkt: Beide Oberflächen verwenden `a11y_engine::scan`. Der Node-Worker kapselt die Browserabhängigkeiten und lässt sich isoliert testen. Keine Shell-Befehle aus URLs; die Anfrage wird ausschließlich über stdin übergeben. Große Ausgaben werden parallel aus stdout/stderr gelesen. Ein Gesamtscan hat zusätzlich ein berechnetes Zeitlimit von höchstens 15 Minuten. Tauri führt die blockierende Engine auf einem Hintergrundthread aus und lässt jeweils einen Scan zu.

Der Bericht enthält pro Seite `violations` und `incomplete`, jeweils mit Regel-ID, Gewichtung, WCAG-/Best-Practice-Tags, Dokumentation, Korrekturvorschlag und betroffenen DOM-Elementen. Die vollständige Felddefinition steht im [JSON-Schema](schema/report.schema.json). Details zu Zählung und Versionierung: [Architektur](docs/architecture.md).

## Tests und Builds

```sh
npm test
npm run test:browser
cargo test --locked
cargo fmt --all -- --check
cargo clippy --locked --all-targets -- -D warnings
cargo build --locked -p a11y-desktop
npm run test:cli
npm run test:desktop
npm run test:report-ui
```

Browser-Tests verwenden ausschließlich die lokale Fixture-Website mit dynamischem Port. Sie prüfen reale axe-Befunde, Schema, Duplikate, robots.txt, Crawl-Limits, Weiterleitungen, HTTP-Fehler und den Worker-Prozess. Rust-Tests prüfen Anfragegrenzen, Gewichtungen und sicheres HTML-Escaping. CLI-Tests benötigen den gebauten Debug-Build. Der native Desktop-Test ist Windows-spezifisch und benötigt den gebauten Tauri-Debug-Build sowie WebView2; er öffnet kurz ein Testfenster und verwendet einen nur im Test aktivierten lokalen Debuggingport. Unter Linux wird er übersprungen. Prüfprotokoll: `docs/validation.md`.

Neue Beispielberichte erzeugen, PowerShell:

```powershell
$env:A11Y_WRITE_EXAMPLE = '1'
npm run test:browser
cargo run --locked -p a11y-engine --example render
```

Bash: `A11Y_WRITE_EXAMPLE=1 npm run test:browser`, anschließend derselbe Cargo-Befehl.

## Ausführbare Dateien und MVP-Grenzen

`cargo build -p a11y-desktop` erzeugt unter Windows `target/debug/a11y-desktop.exe`; die CLI heißt `target/debug/a11y.exe`. Unter Linux entsprechend ohne `.exe`. Für einen optimierten Desktop-Build: `npm run desktop:build`.

**Dies ist ein Entwickler-MVP, noch kein eigenständig installierbares Produkt.** Die Programme benötigen Node, den Worker samt `browser/node_modules` und den installierten Playwright-Browser. Der Standard-Workerpfad wird zur Laufzeit ermittelt: zuerst `A11Y_WORKER`, anschließend `browser/src/worker.mjs` relativ zum Programm und seinen übergeordneten Ordnern, danach relativ zum Arbeitsverzeichnis und seinen übergeordneten Ordnern. Der gesamte Projektordner lässt sich dadurch ohne Neubuild verschieben. Für getrennt weitergegebene Programme `A11Y_WORKER` auf den Worker setzen, optional `A11Y_NODE` auf die Node-Datei und `PLAYWRIGHT_BROWSERS_PATH` auf einen passenden Browserordner. Eine Desktop-App auf Linux benötigt zusätzlich die WebKitGTK-Laufzeitbibliotheken.

Die Startadresse darf weiterleiten, auch von HTTP auf HTTPS oder zu einer www-Adresse. Die endgültige Adresse bestimmt die **Origin** (Schema, Host und Port) für den anschließenden Crawl. Weitere Links und deren Weiterleitungen bleiben auf dieser Origin. Fragmente werden entfernt, Queryparameter bleiben erhalten. Nur normale HTML-Links werden verfolgt. Keine Sitemaps, Authentifizierung, Formulareingaben, Klickpfade, mobile Ansichten oder PDF-Prüfungen.

**robots.txt blockiert den Scan nicht.** Die Datei wird für diesen benutzergesteuerten Scanner nicht abgefragt; weder Disallow noch HTTP 301, fehlende Datei, Serverfehler oder Timeout stoppen die Prüfung. Im JSON steht `scope.robotsPolicy: "ignored"`; `robotsExcluded` bleibt aus Kompatibilitätsgründen als leere Liste erhalten. `--delay-ms` steuert die Pause zwischen Seiten. Tatsächlich nicht erreichbare Seiten, Serverzugriffssperren oder Browserfehler bleiben als Scanfehler sichtbar; sie werden nicht als erfolgreiche Prüfungen ausgegeben.

Die Seiten dürfen ihre üblichen externen Ressourcen laden; Navigation zu anderen Origins ist blockiert. Ein lokaler Scanner ist keine Sandbox für beliebigen fremden Webcode. Nicht als öffentlich erreichbaren Scan-Dienst betreiben: Schutz vor SSRF und Ressourcenmissbrauch wäre ein eigener Entwicklungsschritt. Berichte können Text und HTML-Ausschnitte der Website enthalten.

Kein Abbrechen/Live-Fortschritt im ersten MVP. Ein Fehler beim Seitenladen wird im Bericht vermerkt, nicht als erfolgreicher Test gezählt. Korrekturvorschläge sind Hilfestellungen, keine automatisch angewendeten Änderungen. Ein vollständiges Audit benötigt manuelle Prüfung, insbesondere Tastatur, Screenreader, Inhalte und Nutzerabläufe.

Weitere Schritte: [MVP-Plan](docs/roadmap.md). APIs: [Playwright](https://playwright.dev/docs/library), [axe-core](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md), [Tauri-Kommandos](https://v2.tauri.app/develop/calling-rust/).

## Repository und Lizenz

Quellcode, Lockdateien, Schema, App-Icons und die kuratierten Beispiele werden versioniert. Abhängigkeiten, Buildausgaben, lokale Berichte und Zugangsdaten bleiben ausgeschlossen. Die Beispiele stammen aus der lokalen Fixture-Website; eigene Scanberichte können vertrauliche Inhalte enthalten.

Der Projektcode steht unter der [MIT-Lizenz](LICENSE). Sie erlaubt auch kommerzielle Nutzung, Verkauf und Integration in andere Projekte. Urheberrechtsvermerk und Lizenztext müssen in Kopien oder wesentlichen Teilen erhalten bleiben. Gewährleistungs- und Haftungsausschluss stehen in der Lizenz; ergänzende Hinweise in [NOTICE.md](NOTICE.md).

Abhängigkeiten besitzen eigene Lizenzen; das Windows-Release-Skript legt die zugehörigen Lizenzdateien und Entwicklungshinweise dem Ausgabeordner bei. Hinweise zum Mitwirken stehen in [CONTRIBUTING.md](CONTRIBUTING.md), die Vorbereitung der Veröffentlichung in [docs/git-publication.md](docs/git-publication.md).
