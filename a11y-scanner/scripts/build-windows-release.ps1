param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
if (-not $SkipBuild) {
    & cargo build --release --locked -p a11y-desktop -p a11y-cli
    if ($LASTEXITCODE -ne 0) { throw 'Release-Build fehlgeschlagen.' }
}
$node = (Get-Command node -CommandType Application).Source
if ((& $node -p 'process.platform.concat(String.fromCharCode(47),process.arch)') -ne 'win32/x64') { throw 'Windows x64 Node erforderlich.' }
$target = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { Join-Path $root 'target' }
$output = Join-Path $root 'dist/A11y-Scanner-Windows-x64'
if (Test-Path -LiteralPath $output) { throw "Ziel existiert bereits: $output. Vorher umbenennen, um es zu behalten." }
New-Item -ItemType Directory -Path "$output/runtime", "$output/browser/node_modules", "$output/desktop/ui", "$output/browsers" -Force | Out-Null
Copy-Item -LiteralPath "$target/release/a11y-desktop.exe", "$target/release/a11y.exe" -Destination $output
Copy-Item -LiteralPath $node -Destination "$output/runtime/node.exe"
Copy-Item -LiteralPath "$root/browser/src" -Destination "$output/browser" -Recurse
Copy-Item -LiteralPath "$root/browser/package.json" -Destination "$output/browser"
Copy-Item -LiteralPath "$root/desktop/ui/criteria.json" -Destination "$output/desktop/ui"
foreach ($dependency in @('playwright', 'playwright-core', 'axe-core')) {
    Copy-Item -LiteralPath "$root/browser/node_modules/$dependency" -Destination "$output/browser/node_modules" -Recurse
}
$cache = if ($env:PLAYWRIGHT_BROWSERS_PATH) { $env:PLAYWRIGHT_BROWSERS_PATH } else { Join-Path $env:LOCALAPPDATA 'ms-playwright' }
$browserSpec = Get-Content -LiteralPath "$root/browser/node_modules/playwright-core/browsers.json" -Raw | ConvertFrom-Json
foreach ($browser in $browserSpec.browsers | Where-Object { $_.name -in @('chromium', 'chromium-headless-shell', 'ffmpeg') }) {
    $folder = $browser.name.Replace('-', '_') + '-' + $browser.revision
    Copy-Item -LiteralPath (Join-Path $cache $folder) -Destination "$output/browsers" -Recurse
}
$launcher = @'
@echo off
setlocal
cd /d "%~dp0"
set "A11Y_NODE=%~dp0runtime\node.exe"
set "A11Y_WORKER=%~dp0browser\src\worker.mjs"
set "PLAYWRIGHT_BROWSERS_PATH=%~dp0browsers"
"%~dp0a11y-desktop.exe"
if errorlevel 1 (
  echo Start fehlgeschlagen. Bitte Microsoft Edge WebView2 Runtime pruefen.
  pause
)
'@
Set-Content -LiteralPath "$output/Start-A11y-Scanner.cmd" -Value $launcher -Encoding ascii
$cli = $launcher.Replace('"%~dp0a11y-desktop.exe"', '"%~dp0a11y.exe" %*')
Set-Content -LiteralPath "$output/Scan-Kommandozeile.cmd" -Value $cli.Substring(0, $cli.IndexOf('if errorlevel')) -Encoding ascii
Copy-Item -LiteralPath "$root/LICENSE" -Destination $output
Copy-Item -LiteralPath "$root/NOTICE.md" -Destination $output
& $node -p 'process.release' | Set-Content -LiteralPath "$output/runtime/node-version.txt"
$nodeVersion = & $node --version
$cachedLicense = Join-Path $PSScriptRoot "licenses/node-$nodeVersion-LICENSE.txt"
if (Test-Path -LiteralPath $cachedLicense) {
    Copy-Item -LiteralPath $cachedLicense -Destination "$output/runtime/LICENSE.txt"
} else {
    Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/nodejs/node/$nodeVersion/LICENSE" -OutFile "$output/runtime/LICENSE.txt"
}
@'
A11y Scanner - Windows x64

1. Den gesamten Ordner auf den Windows-PC kopieren bzw. ZIP komplett entpacken.
2. Start-A11y-Scanner.cmd doppelklicken.
3. Website-Adresse eingeben und Scan starten.

Windows 10/11 (64 Bit). Microsoft Edge WebView2 Runtime muss installiert sein:
https://developer.microsoft.com/microsoft-edge/webview2/
Node.js und Chromium sind enthalten. Rust, npm und Build Tools sind nicht erforderlich.
Die Unterordner muessen zusammenbleiben. Nicht nur die EXE weitergeben.
Die App ist nicht digital signiert.

Projekte werden im lokalen App-Speicher des jeweiligen Windows-Benutzers gesichert.
Fuer eine weitergebbare Sicherung Berichte als JSON/HTML exportieren.
Automatische Scans ersetzen keine manuelle Barrierefreiheitspruefung.

Mit Unterstuetzung kuenstlicher Intelligenz entwickelt.
Open Source unter MIT: private und kommerzielle Nutzung, Weiterentwicklung,
Weitergabe und Einbau in andere Projekte erlaubt. Lizenztext und Urhebervermerk
erhalten. Bedingungen und Haftungsausschluss: LICENSE. Hinweise: NOTICE.md.

Optional im Terminal: Scan-Kommandozeile.cmd https://example.org --output reports
Lizenzen: LICENSE, runtime/LICENSE.txt, browser/node_modules/*/LICENSE*,
sowie die mitgelieferten Chromium-Lizenzdateien in browsers.
'@ | Set-Content -LiteralPath "$output/LIESMICH.txt" -Encoding utf8
Write-Output "Release-Ordner: $output"
