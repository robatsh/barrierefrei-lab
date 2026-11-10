use a11y_engine::{default_worker, has_violations, render_html, scan, Impact, ScanRequest};
use anyhow::{Context, Result};
use clap::{Parser, ValueEnum};
use std::{fs, path::PathBuf, process::ExitCode};

#[derive(Parser)]
#[command(
    name = "a11y",
    version,
    about = "Website-Barrierefreiheit mit Playwright und axe-core prüfen"
)]
struct Args {
    /// Start-URL (HTTP oder HTTPS)
    url: String,
    #[arg(long, default_value_t = 10)]
    max_pages: u32,
    #[arg(long, default_value_t = 2)]
    max_depth: u32,
    #[arg(long, default_value_t = 15000)]
    timeout_ms: u64,
    #[arg(long, default_value_t = 300)]
    settle_ms: u64,
    #[arg(long, default_value_t = 200)]
    delay_ms: u64,
    /// Verzeichnis für report.json und report.html
    #[arg(long, default_value = "reports")]
    output: PathBuf,
    /// CI schlägt ab dieser Gewichtung fehl; ohne Option nur Scanfehler
    #[arg(long, value_enum)]
    fail_on: Option<Threshold>,
    /// Alternativer Pfad zu browser/src/worker.mjs
    #[arg(long)]
    worker: Option<PathBuf>,
}
#[derive(Clone, Copy, ValueEnum)]
enum Threshold {
    Minor,
    Moderate,
    Serious,
    Critical,
}
impl From<Threshold> for Impact {
    fn from(value: Threshold) -> Self {
        match value {
            Threshold::Minor => Self::Minor,
            Threshold::Moderate => Self::Moderate,
            Threshold::Serious => Self::Serious,
            Threshold::Critical => Self::Critical,
        }
    }
}

fn run(args: Args) -> Result<u8> {
    let request = ScanRequest {
        start_url: args.url,
        max_pages: args.max_pages,
        max_depth: args.max_depth,
        timeout_ms: args.timeout_ms,
        settle_ms: args.settle_ms,
        delay_ms: args.delay_ms,
    };
    eprintln!(
        "Prüfe {} (maximal {} Seiten)…",
        request.start_url, request.max_pages
    );
    let report = scan(&request, &args.worker.unwrap_or_else(default_worker))?;
    fs::create_dir_all(&args.output).context("Berichtsverzeichnis nicht anlegbar")?;
    fs::write(
        args.output.join("report.json"),
        serde_json::to_vec_pretty(&report)?,
    )?;
    fs::write(args.output.join("report.html"), render_html(&report))?;
    println!("{} Seiten geprüft, {} Fehlerseiten, {} Regelbefunde, {} Elemente, {} manuelle Prüfbefunde.\nBerichte: {}", report.summary.scanned, report.summary.errors, report.summary.violation_rules, report.summary.violation_nodes, report.summary.review_rules, args.output.display());
    if report.summary.errors > 0 || report.summary.scanned == 0 {
        return Ok(2);
    }
    if args
        .fail_on
        .is_some_and(|t| has_violations(&report, t.into()))
    {
        return Ok(3);
    }
    Ok(0)
}

fn main() -> ExitCode {
    match run(Args::parse()) {
        Ok(code) => ExitCode::from(code),
        Err(error) => {
            eprintln!("Fehler: {error:#}");
            ExitCode::from(1)
        }
    }
}
