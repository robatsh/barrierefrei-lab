#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use a11y_engine::{Report, ScanRequest};
use std::sync::atomic::{AtomicBool, Ordering};

static SCANNING: AtomicBool = AtomicBool::new(false);
struct ScanGuard;
impl Drop for ScanGuard {
    fn drop(&mut self) {
        SCANNING.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
async fn scan_website(request: ScanRequest) -> Result<Report, String> {
    request.validate().map_err(|e| e.to_string())?;
    if SCANNING.swap(true, Ordering::SeqCst) {
        return Err("Es läuft bereits ein Scan.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = ScanGuard;
        a11y_engine::scan(&request, &a11y_engine::default_worker()).map_err(|e| format!("{e:#}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn html_report(report: Report) -> String {
    a11y_engine::render_html(&report)
}

fn documentation_url(value: &str) -> Result<tauri::Url, String> {
    let url = tauri::Url::parse(value).map_err(|_| "Ungültige Dokumentationsadresse")?;
    let allowed = match url.host_str() {
        Some("www.w3.org") => url.path().starts_with("/WAI/"),
        Some("developer.mozilla.org") => url
            .path()
            .starts_with("/en-US/docs/Web/HTML/Reference/Elements/"),
        _ => false,
    };
    if !allowed
        || url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
    {
        return Err("Diese Dokumentationsadresse ist nicht freigegeben.".into());
    }
    Ok(url)
}

#[tauri::command]
fn open_documentation(url: String) -> Result<(), String> {
    let url = documentation_url(&url)?;
    #[cfg(target_os = "windows")]
    let program = "explorer.exe";
    #[cfg(target_os = "macos")]
    let program = "open";
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let program = "xdg-open";
    std::process::Command::new(program)
        .arg(url.as_str())
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            scan_website,
            html_report,
            open_documentation
        ])
        .run(tauri::generate_context!())
        .expect("Desktop-App konnte nicht gestartet werden");
}

#[cfg(test)]
mod tests {
    use super::documentation_url;

    #[test]
    fn documentation_is_restricted_to_reference_sites() {
        assert!(documentation_url("https://www.w3.org/WAI/tutorials/images/").is_ok());
        assert!(documentation_url(
            "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img"
        )
        .is_ok());
        for value in [
            "javascript:alert(1)",
            "https://www.w3.org.evil.example/WAI/",
            "https://example.org/",
            "https://user@www.w3.org/WAI/",
            "http://www.w3.org/WAI/",
            "https://www.w3.org:8443/WAI/",
        ] {
            assert!(documentation_url(value).is_err(), "{value}");
        }
    }
}
