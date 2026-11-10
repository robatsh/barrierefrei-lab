param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

# Refresh installed tools even when the parent application has an older PATH.
$cargoHome = if ($env:CARGO_HOME) { $env:CARGO_HOME } else { Join-Path $env:USERPROFILE '.cargo' }
$env:Path = (Join-Path $cargoHome 'bin') + ';' + [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + $env:Path

$node = if ($env:A11Y_NODE) { Get-Command $env:A11Y_NODE -CommandType Application -ErrorAction SilentlyContinue } else { Get-Command node -CommandType Application -ErrorAction SilentlyContinue }
if (-not $node) { throw 'Node.js ab Version 22 fehlt. Node installieren bzw. A11Y_NODE auf node.exe setzen.' }
$nodeVersion = & $node.Source --version
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 22) {
    throw 'Node.js ab Version 22 wird benoetigt.'
}
$env:A11Y_NODE = $node.Source
# Runtime paths must follow the moved project, including for an older binary.
if (-not $env:A11Y_WORKER) { $env:A11Y_WORKER = Join-Path $projectRoot 'browser\src\worker.mjs' }
if (-not [IO.Path]::IsPathRooted($env:A11Y_WORKER)) { $env:A11Y_WORKER = Join-Path $projectRoot $env:A11Y_WORKER }
$env:A11Y_WORKER = [IO.Path]::GetFullPath($env:A11Y_WORKER)
if (-not (Test-Path -LiteralPath $env:A11Y_WORKER -PathType Leaf)) {
    throw "Browser-Worker fehlt: $env:A11Y_WORKER. A11Y_WORKER pruefen."
}
& $node.Source (Join-Path $PSScriptRoot 'check-runtime.mjs') $env:A11Y_WORKER
if ($LASTEXITCODE -ne 0) { throw 'Browser-Abhaengigkeiten fehlen. Bitte npm ci und npm run setup im Projektordner ausfuehren.' }

$targetDir = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { Join-Path $projectRoot 'target' }
if (-not [IO.Path]::IsPathRooted($targetDir)) { $targetDir = Join-Path $projectRoot $targetDir }
$targetDir = [IO.Path]::GetFullPath($targetDir)
$binary = Join-Path $targetDir 'debug\a11y-desktop.exe'
if ($CheckOnly) {
    Write-Output "Projekt: $projectRoot"
    Write-Output "Node: $env:A11Y_NODE ($nodeVersion)"
    Write-Output "Worker: $env:A11Y_WORKER"
    Write-Output "Desktop: $binary"
    exit 0
}
$needsBuild = -not (Test-Path -LiteralPath $binary -PathType Leaf)
if (-not $needsBuild) {
    $binaryTime = (Get-Item -LiteralPath $binary).LastWriteTimeUtc
    $sourcePaths = @('desktop\ui', 'desktop\src-tauri\src', 'desktop\src-tauri\Cargo.toml', 'desktop\src-tauri\build.rs', 'desktop\src-tauri\tauri.conf.json', 'Cargo.toml', 'Cargo.lock', 'crates')
    foreach ($sourcePath in $sourcePaths) {
        $newerSource = Get-ChildItem -LiteralPath (Join-Path $projectRoot $sourcePath) -File -Recurse |
            Where-Object { $_.LastWriteTimeUtc -gt $binaryTime } |
            Select-Object -First 1
        if ($newerSource) { $needsBuild = $true; break }
    }
}
if ($needsBuild) {
    if (-not (Get-Command cargo -CommandType Application -ErrorAction SilentlyContinue)) { throw 'Cargo fehlt. Rust installieren, um die Desktop-App zu bauen.' }
    & cargo build --locked -p a11y-desktop --target-dir $targetDir
    if ($LASTEXITCODE -ne 0) { throw 'Desktop-Build fehlgeschlagen.' }
}
& $binary
exit $LASTEXITCODE
