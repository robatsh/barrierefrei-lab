use a11y_engine::{has_violations, render_html, Impact, Report};

fn fixture() -> Report {
    serde_json::from_str(include_str!("../../../examples/report.json")).unwrap()
}

#[test]
fn real_browser_report_roundtrips_and_drives_ci_threshold() {
    let report = fixture();
    assert_eq!(report.schema_version, "1.0");
    assert_eq!(report.summary.scanned, 3);
    assert_eq!(report.summary.errors, 1);
    assert!(has_violations(&report, Impact::Critical));
    let encoded = serde_json::to_value(&report).unwrap();
    let original: serde_json::Value =
        serde_json::from_str(include_str!("../../../examples/report.json")).unwrap();
    assert_eq!(encoded, original);
}

#[test]
fn report_cannot_activate_untrusted_html_or_executable_links() {
    let mut report = fixture();
    report.pages[0].title = "<script>alert('title')</script>".into();
    report.pages[0].violations[0].help_url = "javascript:alert(1)".into();
    report.pages[0].violations[0].nodes[0].html = "<img src=x onerror=alert(1)>".into();
    let html = render_html(&report);
    assert!(!html.contains("<script>"));
    assert!(!html.contains("<img src="));
    assert!(!html.contains("href=\"javascript:"));
    assert!(html.contains("&lt;img src=x onerror=alert(1)&gt;"));
    assert!(html.contains("HTTP 404"));
    assert!(html.contains("Status: Geprüft"));
    assert!(html.contains("Gewichtung: Sehr hoch"));
    assert!(!html.contains("Some(Critical)"));
}

#[test]
fn manual_assessment_survives_json_and_is_escaped_in_html() {
    let mut report = fixture();
    report.coverage = vec![serde_json::json!({
        "id": "2.1.1", "standard": "WCAG 2.1", "level": "A",
        "title": "Tastatur", "enClause": "9.2.1.1", "condition": "Stichprobe",
        "guidance": "Manuell prüfen", "status": "passed", "notes": "<img src=x onerror=alert(1)>",
        "source": "https://www.w3.org/TR/WCAG21/", "findings": []
    })];
    let encoded = serde_json::to_string(&report).unwrap();
    let restored: Report = serde_json::from_str(&encoded).unwrap();
    assert_eq!(restored.coverage, report.coverage);
    let html = render_html(&restored);
    assert!(html.contains("Manuell als erfüllt bewertet"));
    assert!(html.contains("&lt;img src=x onerror=alert(1)&gt;"));
    assert!(!html.contains("<img src=x"));
    assert!(html.contains("<details id=\"page-0\""));
}
