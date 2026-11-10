# barrierefrei-lab

Werkzeuge zur Untersuchung digitaler Barrierefreiheit.

## A11y Scanner

Der [A11y Scanner](a11y-scanner/README.md) ist ein lokaler Website-Scanner mit Rust-CLI und Tauri-Desktop-App. Playwright/Chromium und axe-core liefern automatische Befunde; ein Pruefkatalog unterstuetzt die ergaenzende manuelle Bewertung. Berichte lassen sich als JSON und HTML exportieren.

Das Tool befindet sich im Prototypstadium. Automatische Tests ersetzen kein vollstaendiges manuelles Audit und liefern keinen Konformitaetsnachweis.

- [Installation, Verwendung und Tests](a11y-scanner/README.md)
- [Hinweise zum Mitwirken](a11y-scanner/CONTRIBUTING.md)
- [Architektur](a11y-scanner/docs/architecture.md)
- [Entwicklungsplan](a11y-scanner/docs/roadmap.md)
- [MIT-Lizenz des Scanners](a11y-scanner/LICENSE)

## Struktur

Der Scanner liegt mit Quellcode, Dokumentation und Build-Konfiguration im Unterordner `a11y-scanner/`. Weitere Komponenten, etwa eine Website, koennen spaeter als eigene Ordner daneben hinzukommen. Das Git-Repository umfasst den gesamten Hauptordner.

Entwicklungsbefehle aus der Scanner-Dokumentation werden im Ordner `a11y-scanner` ausgefuehrt.
