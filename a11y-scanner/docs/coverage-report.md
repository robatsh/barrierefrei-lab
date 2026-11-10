# Prüfkatalog und Reportausgabe

Normprofil: WCAG 2.1 A/AA mit EN 301 549 V3.2.1 (2021-03), ausdrücklich kein pauschales Profil für neuere EN-Ausgaben.

139 Katalogeinträge: 50 Web-Erfolgskriterien einschließlich 4.1.1, 43 EN-Web-Ergänzungen, 46 dokumentbezogene Prüfaufträge. Kapitel 10 übernimmt die entsprechenden Kriterien mit dokumentbezogenen Anpassungen; die leeren Klauseln 10.2.4.1, 10.2.4.5, 10.3.2.3 und 10.3.2.4 werden ausgelassen. Live-Untertitel bleiben enthalten, da hier das Normprofil und nicht eine gesetzliche Ausnahme abgebildet wird.

Der Worker ordnet automatische Befunde anhand ihrer WCAG-Tags zu. Nur ein automatischer Verstoß setzt `failed`; `incomplete` und Abwesenheit eines Befunds bleiben `unreviewed`. Dokumentprüfungen übernehmen keine Web-Ergebnisse. Der additive optionale JSON-Schlüssel `coverage` bewahrt die Kompatibilität mit alten 1.0-Berichten; die Rust-Engine erhält die Einträge beim JSON-Roundtrip und HTML-Export. Alte Berichte erhalten keine erfundene Bewertung.

Manuelle Zustände: `unreviewed`, `failed`, `passed`, `notApplicable`; `notes` dokumentiert Stichprobe und Nachweise. Eine Bewertung im Desktop ist eine menschliche Aussage. Der Export ist kein signiertes Zertifikat. Für die normative Beurteilung gelten die verlinkten Originalquellen.

Quellen:

- https://www.w3.org/TR/WCAG21/
- https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf
- https://digital-strategy.ec.europa.eu/en/policies/latest-changes-accessibility-standard

Die Implementierung verwendet eigene Prüfhilfen und übernimmt keine BIK-Bewertungen oder Inhalte aus bezahlten Berichten. Das optional genannte GitHub-Projekt war für diese Erweiterung nicht erforderlich.
