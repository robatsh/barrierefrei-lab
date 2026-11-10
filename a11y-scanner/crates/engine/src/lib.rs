use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::Duration,
};
use wait_timeout::ChildExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScanRequest {
    pub start_url: String,
    pub max_pages: u32,
    pub max_depth: u32,
    pub timeout_ms: u64,
    pub settle_ms: u64,
    pub delay_ms: u64,
}

impl ScanRequest {
    pub fn new(start_url: String) -> Self {
        Self {
            start_url,
            max_pages: 10,
            max_depth: 2,
            timeout_ms: 15000,
            settle_ms: 300,
            delay_ms: 200,
        }
    }
    pub fn validate(&self) -> Result<()> {
        let url = url::Url::parse(&self.start_url).context("Ungültige Start-URL")?;
        if !matches!(url.scheme(), "http" | "https")
            || url.host_str().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
        {
            bail!("Nur HTTP(S)-URLs ohne Zugangsdaten sind erlaubt");
        }
        if !(1..=100).contains(&self.max_pages)
            || self.max_depth > 5
            || !(1000..=60000).contains(&self.timeout_ms)
            || self.settle_ms > 5000
            || self.delay_ms > 5000
        {
            bail!("Grenzen: 1–100 Seiten, Tiefe 0–5, Timeout 1000–60000 ms, Wartezeiten 0–5000 ms");
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub schema_version: String,
    pub tool: Tool,
    pub started_at: String,
    pub finished_at: String,
    pub request: ScanRequest,
    pub scope: Scope,
    pub summary: Summary,
    pub pages: Vec<Page>,
    pub limitations: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub coverage: Vec<serde_json::Value>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tool {
    pub name: String,
    pub version: String,
    pub axe_version: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Scope {
    pub origin: String,
    pub tags: Vec<String>,
    pub viewport: Viewport,
    pub robots_policy: String,
    pub robots_excluded: Vec<String>,
    pub truncated: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Viewport {
    pub width: u32,
    pub height: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub scanned: u32,
    pub errors: u32,
    pub skipped: u32,
    pub violation_rules: u32,
    pub violation_nodes: u32,
    pub review_rules: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub url: String,
    pub final_url: Option<String>,
    pub depth: u32,
    pub status: PageStatus,
    pub http_status: Option<u16>,
    pub title: String,
    pub error: Option<String>,
    pub violations: Vec<Rule>,
    pub incomplete: Vec<Rule>,
    pub passes: u32,
    pub inapplicable: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PageStatus {
    Ok,
    Error,
    Skipped,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rule {
    pub id: String,
    pub impact: Option<Impact>,
    pub help: String,
    pub description: String,
    pub help_url: String,
    pub tags: Vec<String>,
    pub suggestion: String,
    pub nodes: Vec<Node>,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum Impact {
    Minor,
    Moderate,
    Serious,
    Critical,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Node {
    // axe may return nested arrays for shadow roots / iframe selectors.
    pub target: Vec<serde_json::Value>,
    pub html: String,
    pub failure_summary: String,
    pub checks: Vec<Check>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Check {
    pub id: String,
    pub message: String,
}

/// Find the shared Node worker relative to the running program or working directory.
/// No build-machine path is embedded, so moving the project also moves its default worker.
pub fn default_worker() -> PathBuf {
    std::env::var_os("A11Y_WORKER")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            let executable = std::env::current_exe().ok();
            let cwd = std::env::current_dir().ok();
            find_worker(executable.as_deref(), cwd.as_deref()).unwrap_or_else(|| {
                cwd.unwrap_or_else(|| PathBuf::from("."))
                    .join("browser/src/worker.mjs")
            })
        })
}

fn find_worker(executable: Option<&Path>, cwd: Option<&Path>) -> Option<PathBuf> {
    executable
        .and_then(Path::parent)
        .into_iter()
        .chain(cwd)
        .flat_map(Path::ancestors)
        .map(|directory| directory.join("browser/src/worker.mjs"))
        .find(|candidate| candidate.is_file())
}

pub fn scan(request: &ScanRequest, worker: &Path) -> Result<Report> {
    request.validate()?;
    if !worker.is_file() {
        bail!(
            "Browser-Worker fehlt: {} (A11Y_WORKER setzen)",
            worker.display()
        );
    }
    let node = std::env::var_os("A11Y_NODE").unwrap_or_else(|| "node".into());
    let mut command = Command::new(node);
    command
        .arg(worker)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let mut child = command
        .spawn()
        .context("Node.js nicht startbar; Node >=22 installieren oder A11Y_NODE setzen")?;
    let mut stdin = child.stdin.take().context("Worker stdin fehlt")?;
    let mut stdout = child.stdout.take().context("Worker stdout fehlt")?;
    let mut stderr = child.stderr.take().context("Worker stderr fehlt")?;
    // Drain both pipes concurrently: large reports must not deadlock the worker.
    let out = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        stdout.read_to_end(&mut bytes).map(|_| bytes)
    });
    let err = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        stderr.read_to_end(&mut bytes).map(|_| bytes)
    });
    if let Err(error) = stdin.write_all(&serde_json::to_vec(request)?) {
        let _ = child.kill();
        let _ = child.wait();
        bail!("Worker-Eingabe fehlgeschlagen: {error}");
    }
    drop(stdin);
    let seconds = (request.max_pages as u64
        * (request.timeout_ms * 3 + request.settle_ms + request.delay_ms)
        / 1000
        + 30)
        .min(900);
    let status = match child.wait_timeout(Duration::from_secs(seconds))? {
        Some(status) => status,
        None => {
            let _ = child.kill();
            let _ = child.wait();
            bail!("Gesamtscan hat sein Zeitlimit ({seconds} s) überschritten");
        }
    };
    let output = out
        .join()
        .map_err(|_| anyhow::anyhow!("Ausgabe-Thread fehlgeschlagen"))??;
    let errors = err
        .join()
        .map_err(|_| anyhow::anyhow!("Fehler-Thread fehlgeschlagen"))??;
    if !status.success() {
        bail!("{}", String::from_utf8_lossy(&errors).trim());
    }
    let report: Report =
        serde_json::from_slice(&output).context("Ungültiges JSON vom Browser-Worker")?;
    if report.schema_version != "1.0" {
        bail!(
            "Nicht unterstützte Berichtsversion: {}",
            report.schema_version
        );
    }
    Ok(report)
}

pub fn has_violations(report: &Report, threshold: Impact) -> bool {
    report
        .pages
        .iter()
        .flat_map(|p| &p.violations)
        .any(|r| r.impact.map(|i| i >= threshold).unwrap_or(false))
}

fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn page_status_label(status: &PageStatus) -> &'static str {
    match status {
        PageStatus::Ok => "Geprüft",
        PageStatus::Error => "Fehler",
        PageStatus::Skipped => "Übersprungen",
    }
}
fn impact_label(impact: Option<Impact>) -> &'static str {
    match impact {
        Some(Impact::Critical) => "Sehr hoch",
        Some(Impact::Serious) => "Hoch",
        Some(Impact::Moderate) => "Mittel",
        Some(Impact::Minor) => "Gering",
        None => "Ohne Gewichtung",
    }
}

pub fn render_html(report: &Report) -> String {
    let mut html = String::from("<!doctype html><html lang=\"de\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'\"><title>Barrierefreiheitsbericht</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:1000px;margin:2rem auto;padding:0 1rem;color:#172b3a;background:#f4f7fa}article,section{background:white;padding:1rem 1.5rem;margin:1rem 0;border:1px solid #b4c4d0;border-radius:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#edf2f6;padding:1rem}a{color:#064d96}h1,h2,h3{line-height:1.25}.status{font-weight:bold}code{overflow-wrap:anywhere}details{background:white;border:1px solid #b4c4d0;border-radius:8px;padding:1rem;margin:.6rem 0}summary{cursor:pointer;font-weight:650}summary:focus-visible,a:focus-visible{outline:3px solid #a04400;outline-offset:3px}nav{display:flex;gap:1rem;flex-wrap:wrap}.metrics{display:flex;gap:1rem;flex-wrap:wrap}.metrics strong{background:#e0f1f4;padding:1rem;border-radius:8px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:.6rem;border-bottom:1px solid #b4c4d0}@media print{details{break-inside:avoid}details>*{display:block!important}}</style></head><body><main><h1>Barrierefreiheitsbericht</h1>");
    html.push_str(&format!("<p>Start: <code>{}</code><br>Erstellt: {} · axe-core {}</p><p><strong>{} Seiten geprüft · {} Fehlerseiten · {} Regelbefunde · {} betroffene Elemente · {} manuell zu prüfende Regeln</strong></p>", escape(&report.request.start_url), escape(&report.finished_at), escape(&report.tool.axe_version), report.summary.scanned, report.summary.errors, report.summary.violation_rules, report.summary.violation_nodes, report.summary.review_rules));
    html.push_str("<nav aria-label=\"Berichtsbereiche\"><a href=\"#overview\">Seitenübersicht</a><a href=\"#criteria\">Prüfkatalog</a><a href=\"#findings\">Befunde</a></nav>");
    if report.scope.truncated {
        html.push_str("<p class=\"status\">Seitenprüfung durch eine Obergrenze für Seiten, Linktiefe oder Warteschlange begrenzt.</p>");
    }
    html.push_str("<section><h2>Prüfumfang und Grenzen</h2><ul>");
    for text in &report.limitations {
        html.push_str(&format!("<li>{}</li>", escape(text)));
    }
    html.push_str(&format!(
        "</ul><p>Ansicht: {} × {} · Regeln: {}</p>",
        report.scope.viewport.width,
        report.scope.viewport.height,
        escape(&report.scope.tags.join(", "))
    ));
    for url in &report.scope.robots_excluded {
        html.push_str(&format!(
            "<p>robots.txt: <code>{}</code> ausgeschlossen.</p>",
            escape(url)
        ));
    }
    if report.scope.robots_policy == "ignored" {
        html.push_str("<p>robots.txt wird nicht als Pr?fsperre verwendet.</p>");
    }
    html.push_str("</section>");
    html.push_str("<section id=\"overview\"><h2>Seitenübersicht</h2><p>Details gezielt über die jeweilige Seite öffnen.</p><ul>");
    for (index, page) in report.pages.iter().enumerate() {
        html.push_str(&format!(
            "<li><a href=\"#page-{}\">{}</a> · {} Fehlerregeln · {} Hinweise · {:?}</li>",
            index,
            escape(&page.url),
            page.violations.len(),
            page.incomplete.len(),
            page_status_label(&page.status)
        ));
    }
    html.push_str("</ul></section><section id=\"criteria\"><h2>Prüfkatalog und manuelle Bewertung</h2><p>50 Kriterien WCAG 2.1 A/AA einschließlich des für EN V3.2.1 relevanten Parsing-Kriteriums. EN-Zusätze sind ein Web-Prüfplan; Kapitel 10 enthält einzelne manuelle Prüfaufträge für Dokumente; Dokumente werden nicht automatisch untersucht. Keine vollständige Produktzertifizierung. Ein fehlender automatischer Befund bedeutet nicht bestanden. Bewertungen gelten für die dokumentierte Stichprobe. Notizen und Bewertungen können in der Desktop-App erfasst und exportiert werden.</p>");
    for standard in ["WCAG 2.1", "EN 301 549 V3.2.1"] {
        html.push_str(&format!("<details><summary>{}</summary>", standard));
        for criterion in report.coverage.iter().filter(|c| c["standard"] == standard) {
            let field = |key: &str| escape(criterion[key].as_str().unwrap_or(""));
            let status = match criterion["status"].as_str().unwrap_or("unreviewed") {
                "failed" => "Nicht erfüllt / automatischer Fehler",
                "passed" => "Manuell als erfüllt bewertet",
                "notApplicable" => "Manuell als nicht anwendbar bewertet",
                _ => "Manuelle Prüfung offen",
            };
            html.push_str(&format!("<details><summary>{} · {} · {} · {}</summary><p>EN-Klausel: {} · Anwendbarkeit: {}</p><p>{}</p><p>Prüfnotizen: {}</p></details>", field("id"), field("level"), field("title"), status, field("enClause"), field("condition"), field("guidance"), field("notes")));
        }
        html.push_str("</details>");
    }
    if report.coverage.is_empty() {
        html.push_str("<p>Dieser ältere Bericht enthält noch keinen Prüfkatalog. Für die Abdeckung einen neuen Scan ausführen.</p>");
    }
    html.push_str("</section><h2 id=\"findings\">Befunde nach Seite</h2>");
    for (index, page) in report.pages.iter().enumerate() {
        html.push_str(&format!(
            "<details id=\"page-{}\"><summary>{} · {} Fehlerregeln · {} Prüfhinweise</summary>",
            index,
            escape(&page.url),
            page.violations.len(),
            page.incomplete.len()
        ));
        html.push_str(&format!("<section><h2>{}</h2><p><code>{}</code></p><p class=\"status\">Status: {} · HTTP {}</p>", escape(&page.title), escape(&page.url), page_status_label(&page.status), page.http_status.map(|code| code.to_string()).unwrap_or_else(|| "–".into())));
        if let Some(final_url) = &page.final_url {
            html.push_str(&format!(
                "<p>Endgültige URL: <code>{}</code></p>",
                escape(final_url)
            ));
        }
        if let Some(error) = &page.error {
            html.push_str(&format!("<p>{}</p>", escape(error)));
        }
        if page.status == PageStatus::Ok && page.violations.is_empty() {
            html.push_str("<p>Keine automatischen Regelverstöße erkannt. Manuelle Prüfung bleibt erforderlich.</p>");
        }
        for (label, rules) in [
            ("Automatischer Fehler", &page.violations),
            ("Manuell prüfen", &page.incomplete),
        ] {
            for rule in rules {
                html.push_str(&format!("<details><summary>{}: {}</summary><p>Regel: <code>{}</code> · Gewichtung: {}</p><p>{}</p><p><strong>Mögliche Behebung:</strong> {}</p><p>Tags: {}</p>", label, escape(&rule.help), escape(&rule.id), impact_label(rule.impact), escape(&rule.description), escape(&rule.suggestion), escape(&rule.tags.join(", "))));
                // Only link to HTTP(S) documentation, never untrusted executable URLs.
                if url::Url::parse(&rule.help_url)
                    .is_ok_and(|u| matches!(u.scheme(), "http" | "https"))
                {
                    html.push_str(&format!(
                        "<p><a href=\"{}\" rel=\"noreferrer\">Regeldokumentation</a></p>",
                        escape(&rule.help_url)
                    ));
                }
                for (index, node) in rule.nodes.iter().enumerate() {
                    html.push_str(&format!(
                        "<details><summary>Betroffenes Element {}</summary>",
                        index + 1
                    ));
                    html.push_str(&format!(
                        "<h4>Betroffenes Element</h4><pre>{}</pre><pre>{}</pre><p>{}</p>",
                        escape(&serde_json::to_string(&node.target).unwrap_or_default()),
                        escape(&node.html),
                        escape(&node.failure_summary)
                    ));
                    for check in &node.checks {
                        html.push_str(&format!(
                            "<p>{}: {}</p>",
                            escape(&check.id),
                            escape(&check.message)
                        ));
                    }
                    html.push_str("</details>");
                }
                html.push_str("</details>");
            }
        }
        html.push_str("</section></details>");
    }
    html.push_str("</main></body></html>");
    html
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn worker_follows_relocated_executable_and_falls_back_to_working_directory() {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let temporary =
            std::env::temp_dir().join(format!("a11y paths {} {unique}", std::process::id()));
        let original = temporary.join("original project");
        let relocated = temporary.join("relocated project");
        std::fs::create_dir_all(original.join("browser/src")).unwrap();
        std::fs::create_dir_all(original.join("target/debug")).unwrap();
        std::fs::write(original.join("browser/src/worker.mjs"), "").unwrap();
        std::fs::rename(&original, &relocated).unwrap();
        let executable = relocated.join("target/debug/a11y.exe");
        let worker = relocated.join("browser/src/worker.mjs");
        assert_eq!(
            find_worker(Some(&executable), Some(&temporary)),
            Some(worker.clone())
        );
        assert_eq!(
            find_worker(None, Some(&relocated.join("browser/src"))),
            Some(worker)
        );
        assert_eq!(find_worker(None, Some(&temporary)), None);
        std::fs::remove_dir_all(temporary).unwrap();
    }

    #[test]
    fn request_rejects_unsafe_or_unbounded_inputs() {
        for url in [
            "file:///tmp/test",
            "javascript:alert(1)",
            "https://user:pw@example.org",
            "broken",
        ] {
            assert!(ScanRequest::new(url.into()).validate().is_err());
        }
        let mut request = ScanRequest::new("http://localhost:4179".into());
        assert!(request.validate().is_ok());
        request.max_pages = 0;
        assert!(request.validate().is_err());
        request.max_pages = 101;
        assert!(request.validate().is_err());
    }
    #[test]
    fn escapes_untrusted_page_content() {
        assert_eq!(escape("<script>\"&'"), "&lt;script&gt;&quot;&amp;&#39;");
    }
    #[test]
    fn impact_order_matches_ci_threshold() {
        assert!(Impact::Critical > Impact::Serious);
        assert!(Impact::Serious > Impact::Moderate);
        assert!(Impact::Moderate > Impact::Minor);
    }
}
