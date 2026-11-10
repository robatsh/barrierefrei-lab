# Architektur und Ergebnisvertrag

## Entscheidung: Rust steuert, Node prüft

Eine Rust-Bibliothek ist die gemeinsame Engine der CLI und Desktop-App. Sie validiert die Anfrage, startet einen Worker ohne Shell, überwacht die Laufzeit, liest typisierte Ergebnisse und erzeugt den HTML-Bericht. Der Node-Worker enthält die Crawl- und Browserlogik. So wird die offizielle Playwright-JavaScript-API direkt genutzt, und axe-core läuft im gerenderten DOM. Eine Rust-Neuimplementierung der Browsersteuerung ist für das MVP unnötig.

CLI und Desktop unterscheiden sich nur in der Ein-/Ausgabe. Die CLI schreibt Dateien und setzt Exitcodes. Tauri überträgt dieselben Serde-Typen an eine statische Oberfläche. Exportiertes HTML kommt in beiden Fällen aus derselben Rust-Funktion. Die UI ist absichtlich klein: kein React-/Vite-Build, keine zusätzliche Zustandsbibliothek.

## Datenfluss

1. UI/CLI baut `ScanRequest`; Rust prüft URL und Wertebereiche.
2. Engine startet `node worker.mjs`, schreibt ein JSON-Objekt nach stdin und schließt stdin.
3. Worker validiert erneut und startet einen isolierten Chromium-Kontext. robots.txt ist keine Voraussetzung und wird nicht abgefragt.
4. Die initiale Top-Level-Weiterleitungskette darf die Origin wechseln (z. B. HTTP→HTTPS oder www). Die endgültige URL setzt die Crawl-Origin. Breitensuche folgt danach nur HTML-Links innerhalb dieser Origin. Fragmente werden entfernt; Querystrings bleiben semantisch erhalten. Set-basierte Deduplizierung, Seiten-, Tiefen- und Warteschlangenlimits verhindern ungebremste Crawls.
5. Jede Seite erhält ihren eigenen Tab. Nach DOMContentLoaded und einer kurzen Wartezeit wird axe injiziert und ausgeführt.
6. axe-Regeln mit Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` sowie `best-practice` werden geprüft. Das sind die verfügbaren passenden automatisierten Regeln, keine vollständige Abdeckung dieser Standards.
7. Worker normalisiert die Daten und gibt ein einzelnes JSON-Dokument nach stdout aus. Nur Diagnosefehler gehen nach stderr. Der Browser wird in `finally` geschlossen.
8. Rust deserialisiert Version 1.0 und gibt denselben Bericht an beide Clients zurück.

## Vertrag 1.0

`schema/report.schema.json` ist ein Draft-07-Schema. Die realen Integrationsergebnisse werden damit geprüft. Rust bildet den Vertrag mit expliziten Structs und Enums ab. `schemaVersion` muss `1.0` sein; eine inkompatible Änderung erfordert eine neue Version. Zeitangaben werden als ISO-8601-UTC-Strings ausgegeben. URLs sind absolute HTTP(S)-Adressen.

- `tool`: Scanner- und axe-Version für die Nachvollziehbarkeit.
- `request`: tatsächlich verwendete Parameter.
- `scope`: Origin, Tags, Ansicht, robots-Policy, ausgeschlossene Links und Hinweis auf Limits.
- `pages`: angeforderte/endgültige URL, Tiefe, Status, HTTP-Status und Befunde.
- `violations`: automatisch erkannte Fehler.
- `incomplete`: axe konnte die Frage nicht entscheiden; manuelle Prüfung erforderlich.
- `nodes`: Zielselektoren (auch verschachtelt für Shadow DOM/Frames), HTML, Fehlerzusammenfassung und Checkmeldungen.
- `suggestion`: kuratierter allgemeiner Lösungshinweis für häufige Regeln; sonst Verweis auf die Regelprüfung. Keine Garantie, dass der Vorschlag für jeden konkreten DOM-Kontext ausreicht.

`violationRules` zählt **Regel-Seiten-Vorkommen**, keine global eindeutigen Regel-IDs. `violationNodes` zählt Elemente pro Regel; dasselbe DOM-Element kann unter mehreren Regeln auftauchen. `reviewRules` zählt Regel-Seiten-Vorkommen aus `incomplete`. `passes` und `inapplicable` sind Regelzahlen je Seite; sie sind keine Prozentbewertung und kein Konformitätsscore.

Status `ok` bedeutet, dass Navigation und axe-Prüfung erfolgreich waren, auch bei Befunden. `error` bedeutet, dass die Seite nicht zuverlässig geprüft wurde. `skipped` wird für bereits geprüfte Redirectziele verwendet. `scope.robotsPolicy` ist jetzt `ignored`, `scope.robotsExcluded` bleibt als leere Liste erhalten. Das Schema akzeptiert weiterhin die frühere Policy `respect-fail-closed`, damit alte Berichte lesbar bleiben. Das Seitenlimit zählt abgearbeitete URLs einschließlich Fehlern; Umleitungsduplikate können daher ebenfalls einen Platz belegen.

`scope.truncated` heißt, dass Seiten-, Tiefen- oder Warteschlangenlimits die Abdeckung beschränkt haben. Auch ohne dieses Flag ist die Website nicht nachweislich vollständig erfasst: nicht verlinkte Seiten und interaktive Zustände bleiben unbekannt. robots.txt kann den Scan nicht verhindern; tatsächliche Ladefehler der Prüfseite werden weiterhin gemeldet.

## Grenzen und Betrieb

Der Scanner-User-Agent ist `A11yScanner/0.1`. robots.txt wird auf ausdrücklichen Nutzerwunsch ignoriert: weder Disallow noch Ladefehler oder Redirects sind eine Scan-Sperre. Nach Auflösung der Startadresse dürfen Seite und Frames nicht außerhalb der endgültigen Crawl-Origin navigieren. Service Worker sind deaktiviert, damit sie die Routenprüfung nicht umgehen. Externe Skripte, Bilder und Stylesheets bleiben zulässig, weil sie für eine realitätsnahe Darstellung benötigt werden. Ein auf externen Frames beruhender Bereich kann dadurch unvollständig bleiben.

Keine Authentifizierungsdaten in der URL, keine Shell aus Nutzereingaben, keine aktiven HTML-Snippets in UI/Bericht. Die Oberfläche nutzt `textContent`; der Rust-Exporter escaped alle Textwerte und begrenzt Dokumentationslinks auf HTTP(S). Tauri stellt keine Shell-/Filesystem-Plugins bereit. Prüfseiten werden ausschließlich im separaten Chromium-Browser geöffnet, niemals in der privilegierten App-WebView.

Das Gesamttimeout wird aus Seitenzahl und Seitenbudgets abgeleitet, auf 15 Minuten begrenzt und durch Rust überwacht. Bei erzwungenem Workerabbruch kann die Aufräumlogik des Workers nicht mehr garantiert laufen; robuste Prozessgruppen-/Job-Object-Verwaltung ist vor einem produktiven Installer vorgesehen. Der Ablauf unterstützt noch keine Benutzer-Abbruchfunktion.

## Distribution

MVP: Entwicklerinstallation mit Node und separat installiertem Chromium, Tauri-Bundling deaktiviert. Kein Netzwerkzugriff der UI nötig, Browserzugriff nur durch den Worker. Ein späterer Installer muss Worker, passende Node-Laufzeit, Browser und Lizenzhinweise pro Plattform mitnehmen oder kontrolliert nachinstallieren. Die heutige Worker-Pfadkonfiguration wird dann durch Tauri-Ressourcen-/Sidecar-Auflösung ersetzt.
