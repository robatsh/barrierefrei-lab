# MVP-first: erledigter Kern und nächste Schritte

## Schritt 1 – Vertikaler Scan

Start-URL → Chromium → axe → versioniertes JSON. Lokale gute und fehlerhafte Fixture-Seiten sichern das Verhalten ab. Häufige Regeln erhalten konkrete allgemeine Korrekturhinweise. Automatische und unentschiedene Befunde werden getrennt gespeichert.

## Schritt 2 – Gemeinsame Rust-Engine und CLI

Validierte Anfrage, externer Worker ohne Shell, Timeout, typisierte Ergebnisse, HTML-/JSON-Export und CI-Fehlerschwellen. Crawl mit Deduplizierung, Auflösung von Start-Weiterleitungen sowie Origin-, Seiten- und Tiefengrenzen. robots.txt ist keine Scan-Sperre. Tests prüfen den realen Browser statt nur Mockdaten.

## Schritt 3 – Desktop-MVP

Tauri-App bindet dieselbe Engine an. URL/Parameter, verständlicher Scanstatus, Zusammenfassung, Filter, aufklappbare Elementbefunde und Exporte. Die Engine läuft auf einem Hintergrundthread. Entwickler-Build für Windows; dieselbe Quellstruktur für Linux.

## Nächster kleiner Ausbau

1. Fortschrittsereignisse pro Seite und Abbrechen; Worker-Prozessgruppe sauber beenden, auch beim Schließen der Desktop-App.
2. Sitemap-Import, konfigurierbarer URL-Bereich/Queryfilter und konfigurierbare Crawl-Pausen.
3. Authentifizierung über bewusst importierten lokalen Browserzustand; sichere Behandlung und Löschung dieser Daten.
4. Stabile Befund-Fingerprints und Vergleich zweier Läufe. Exakte WCAG-Kriteriumzuordnung und deutsche axe-Texte.
5. Mobile Ansichten und auswählbare Nutzerabläufe, etwa geöffnete Menüs und Validierungsfehler.
6. Installer mit pro Plattform gepinnter Node-/Browser-Laufzeit und Lizenzübersicht. Linux-Laufzeitprüfung, Signierung, Updates.

Keine parallelen Scans, keine automatische Reparatur und kein „100 % barrierefrei“-Score im MVP. Zuerst zuverlässige Abdeckung und ehrliche Berichte, danach Komfort und größere Crawls.
