use anyhow::{Context, Result};
fn main() -> Result<()> {
    let worker = a11y_engine::default_worker();
    let root = worker
        .parent()
        .and_then(std::path::Path::parent)
        .and_then(std::path::Path::parent)
        .context(
            "Projektverzeichnis nicht gefunden; A11Y_WORKER auf browser/src/worker.mjs setzen",
        )?;
    let report: a11y_engine::Report = serde_json::from_slice(
        &std::fs::read(root.join("examples/report.json"))
            .context("Zuerst Beispielbericht erzeugen")?,
    )?;
    std::fs::write(
        root.join("examples/report.html"),
        a11y_engine::render_html(&report),
    )?;
    Ok(())
}
