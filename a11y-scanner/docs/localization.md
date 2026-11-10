# Sprache der Anwendung

Die Anwendung verwendet ausdrücklich Deutsch (`de`, Datumsformat `de-DE`), unabhängig von der Sprache des Betriebssystems.

Oberflächentexte stehen in `desktop/ui/locales/de.js`. `desktop/ui/i18n.js` liefert Texte über `t(key, values)` und übersetzt technische Statuswerte über `label(group, value)`. Platzhalter wie `{0}` werden durch Werte ersetzt; die Oberfläche setzt Texte mit `textContent` ein. Statische HTML-Texte besitzen `data-i18n`-Schlüssel, übersetzbare Attribute `data-i18n-placeholder` beziehungsweise `data-i18n-aria-label`.

Für eine zusätzliche Sprache einen Katalog mit denselben Schlüsseln ergänzen, in `i18n.js` registrieren und die Sprachauswahl erweitern. Fehlende Einträge fallen auf Deutsch zurück. Die fachlichen Prüfkataloge (`criteria.json`), Hinweise des Browser-Workers und Texte des Rust-HTML-Exports müssen für eine weitere Sprache ebenfalls einen passenden Katalog erhalten. Dort werden derzeit deutsche Inhalte verwendet.

Neue Browserprüfungen konfigurieren axe-core mit dessen mitgeliefertem deutschen Sprachpaket. Bei einer weiteren Sprache muss auch dieses Sprachpaket ausgewählt werden. Alte gespeicherte Berichte enthalten ihre ursprünglichen Regeltexte; eine erneute Prüfung erzeugt deutsche Regelbeschreibungen und Elementhinweise. Inhalte untersuchter Websites, Quelltext, URLs und technische Regelkennungen bleiben Originaldaten.

Die JSON-Schnittstelle behält ihre technischen Schlüssel und Statuswerte, damit gespeicherte Projekte und Berichte kompatibel bleiben. Nur ihre Darstellung wird übersetzt.

Prüfung: `npm test`, `npm run test:browser`, `npm run test:report-ui` und `cargo test -p a11y-engine`.
