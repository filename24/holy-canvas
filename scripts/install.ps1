# ==============================================================================
# holy-canvas (hcvs) - Standalone Installer for Windows (PowerShell)
# Installs standalone binary compiled with Bun, with zero pre-installed runtime.
#
# Usage (Online):
#   irm https://raw.githubusercontent.com/filename24/holy-canvas/stable/scripts/install.ps1 | iex
#
# Usage (Local repository):
#   powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"

$Repo = if ($env:HOLY_CANVAS_REPO) { $env:HOLY_CANVAS_REPO } else { "filename24/holy-canvas" }
$InstallDir = if ($env:HOLY_CANVAS_HOME) { $env:HOLY_CANVAS_HOME } else { Join-Path $env:USERPROFILE ".holy-canvas" }
$NodeVersion = if ($env:HOLY_CANVAS_NODE_VERSION) { $env:HOLY_CANVAS_NODE_VERSION } else { "v20.18.3" }
$Branch = if ($env:HOLY_CANVAS_BRANCH) { $env:HOLY_CANVAS_BRANCH } else { "stable" }

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "holy-canvas (hcvs) - Windows Standalone Installer" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Detect architecture
$Arch = "x64"
if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") {
    $Arch = "arm64"
} elseif (-not [System.Environment]::Is64BitOperatingSystem) {
    Write-ErrorMsg "32-bit Windows is not supported. Please use a 64-bit operating system."
    exit 1
}

Write-Info "Detected Platform: win-$Arch"

# 2. Directory structure
$BinDir = Join-Path $InstallDir "bin"
$RuntimeDir = Join-Path $InstallDir "runtime"
$AppDir = Join-Path $InstallDir "app"

New-Item -ItemType Directory -Force -Path $InstallDir, $BinDir, $RuntimeDir, $AppDir | Out-Null

# Check if running locally in git repository
$IsLocal = $false
$ScriptDir = ""
try {
    if ($PSScriptRoot) {
        $ScriptDir = $PSScriptRoot
    }
} catch {
    $ScriptDir = ""
}

if ($ScriptDir) {
    $RepoRoot = (Get-Item $ScriptDir).Parent.FullName
    $PkgJson = Join-Path $RepoRoot "package.json"
    $DistDir = Join-Path $RepoRoot "dist"
    if ((Test-Path $PkgJson) -and (Test-Path $DistDir)) {
        $IsLocal = $true
    }
}

# 3. Check for pre-built standalone release package (Built by GitHub CI via Bun)
$DownloadedRelease = $false
if (-not $IsLocal) {
    $ReleaseZipUrl = "https://github.com/$Repo/releases/latest/download/holy-canvas-win-$Arch.zip"
    $ReleaseExeUrl = "https://github.com/$Repo/releases/latest/download/holy-canvas-win-$Arch.exe"

    Write-Info "Checking for pre-built standalone release from GitHub CI..."
    $TempReleaseZip = Join-Path $env:TEMP "holy-canvas-release.zip"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $ReleaseZipUrl -OutFile $TempReleaseZip -UseBasicParsing -ErrorAction Stop
        Write-Info "Extracting standalone release package..."
        Expand-Archive -Path $TempReleaseZip -DestinationPath $InstallDir -Force
        Remove-Item -Path $TempReleaseZip -Force -ErrorAction SilentlyContinue
        $LocalExe = Join-Path $BinDir "holy-canvas.exe"
        if (Test-Path $LocalExe) {
            Copy-Item -Path $LocalExe -Destination (Join-Path $BinDir "hcvs.exe") -Force -ErrorAction SilentlyContinue
        }
        $DownloadedRelease = $true
        Write-Success "Standalone release package extracted successfully."
    } catch {
        # Fallback to direct .exe download if zip is unavailable
        try {
            Write-Info "Trying direct standalone executable download..."
            $TargetExe = Join-Path $BinDir "holy-canvas.exe"
            Invoke-WebRequest -Uri $ReleaseExeUrl -OutFile $TargetExe -UseBasicParsing -ErrorAction Stop
            Copy-Item -Path $TargetExe -Destination (Join-Path $BinDir "hcvs.exe") -Force
            $DownloadedRelease = $true
            Write-Success "Standalone executable downloaded successfully."
        } catch {
            $DownloadedRelease = $false
        }
    }
}

# 4. Fallback: Local install or build from source with portable Node
if (-not $DownloadedRelease) {
    if ($IsLocal) {
        Write-Info "Installing from local repository at $RepoRoot..."
        Copy-Item -Path $DistDir -Destination $AppDir -Recurse -Force
        Copy-Item -Path (Join-Path $RepoRoot "package.json") -Destination $AppDir -Force
    } else {
        $NodeExe = Join-Path $RuntimeDir "node.exe"
        if (-not (Test-Path $NodeExe)) {
            Write-Info "Setting up fallback portable Node.js runtime ($NodeVersion)..."
            $NodeZipName = "node-$NodeVersion-win-$Arch.zip"
            $NodeZipUrl = "https://nodejs.org/dist/$NodeVersion/$NodeZipName"
            $TempZip = Join-Path $env:TEMP $NodeZipName
            $TempExtract = Join-Path $env:TEMP "node-extract-$([System.Guid]::NewGuid().ToString())"
            Invoke-WebRequest -Uri $NodeZipUrl -OutFile $TempZip -UseBasicParsing
            Expand-Archive -Path $TempZip -DestinationPath $TempExtract -Force
            $ExtractedFolder = Get-ChildItem -Path $TempExtract -Directory | Select-Object -First 1
            Copy-Item -Path (Join-Path $ExtractedFolder.FullName "*") -Destination $RuntimeDir -Recurse -Force
            Remove-Item -Path $TempZip, $TempExtract -Recurse -Force -ErrorAction SilentlyContinue
        }

        Write-Info "Fetching latest source code from GitHub ($Repo)..."
        $SourceZipUrl = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
        $TempSourceZip = Join-Path $env:TEMP "holy-canvas-src.zip"
        $TempSourceExtract = Join-Path $env:TEMP "holy-canvas-src-$([System.Guid]::NewGuid().ToString())"
        Invoke-WebRequest -Uri $SourceZipUrl -OutFile $TempSourceZip -UseBasicParsing
        Expand-Archive -Path $TempSourceZip -DestinationPath $TempSourceExtract -Force
        $SrcRoot = (Get-ChildItem -Path $TempSourceExtract -Directory | Select-Object -First 1).FullName
        Copy-Item -Path (Join-Path $SrcRoot "dist") -Destination $AppDir -Recurse -Force
        Copy-Item -Path (Join-Path $SrcRoot "package.json") -Destination $AppDir -Force
        Remove-Item -Path $TempSourceZip, $TempSourceExtract -Recurse -Force -ErrorAction SilentlyContinue
    }

    $CmdContent = @"
@echo off
setlocal
set "ROOT_DIR=%~dp0.."
set "NODE_EXE=%ROOT_DIR%\runtime\node.exe"
if not exist "%NODE_EXE%" (set "NODE_EXE=node")
"%NODE_EXE%" "%ROOT_DIR%\app\dist\cli.js" %*
"@

    if (-not (Test-Path (Join-Path $BinDir "holy-canvas.exe"))) {
        Set-Content -Path (Join-Path $BinDir "holy-canvas.cmd") -Value $CmdContent -Encoding ASCII
        Set-Content -Path (Join-Path $BinDir "hcvs.cmd") -Value $CmdContent -Encoding ASCII
    }
}

# 5. Update User PATH environment variable
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$PathNeedsUpdate = $false

if ($UserPath -split ";" -notcontains $BinDir) {
    Write-Info "Adding $BinDir to User PATH..."
    $NewUserPath = if ([string]::IsNullOrWhiteSpace($UserPath)) { $BinDir } else { "$UserPath;$BinDir" }
    [Environment]::SetEnvironmentVariable("Path", $NewUserPath, "User")
    $PathNeedsUpdate = $true
}

if ($env:Path -split ";" -notcontains $BinDir) {
    $env:Path = "$env:Path;$BinDir"
}

# 6. Verify Installation
Write-Info "Verifying installation..."
$InstalledVersion = ""
try {
    $ExePath = Join-Path $BinDir "holy-canvas.exe"
    $CmdPath = Join-Path $BinDir "holy-canvas.cmd"
    if (Test-Path $ExePath) {
        $VerifyOutput = & $ExePath --version 2>$null
    } elseif (Test-Path $CmdPath) {
        $VerifyOutput = & $CmdPath --version 2>$null
    }
    $InstalledVersion = $VerifyOutput.Trim()
} catch {
    $InstalledVersion = ""
}

if ($InstalledVersion) {
    Write-Success "holy-canvas v$InstalledVersion successfully installed!"
} else {
    Write-Warn "Verification check finished. If holy-canvas is not recognized yet, restart your terminal."
}

# 7. Finished banner & guide
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "holy-canvas (alias: hcvs) is ready!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installed location: $InstallDir"
if (Test-Path (Join-Path $BinDir "holy-canvas.exe")) {
    Write-Host "Command binaries:   $BinDir\holy-canvas.exe, $BinDir\hcvs.exe"
} else {
    Write-Host "Command binaries:   $BinDir\holy-canvas.cmd, $BinDir\hcvs.cmd"
}
Write-Host ""

if ($PathNeedsUpdate) {
    Write-Host "NOTE: To use 'hcvs' in existing command prompts, restart your terminal or PowerShell window." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Quick Start:" -ForegroundColor White
Write-Host "  1. Run setup to connect your Canvas account:"
Write-Host "     hcvs setup  (or holy-canvas setup)" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Launch interactive terminal interface (TUI):"
Write-Host "     hcvs" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Or use direct CLI commands:"
Write-Host "     hcvs courses" -ForegroundColor Cyan
Write-Host "     hcvs grades" -ForegroundColor Cyan
Write-Host "     hcvs quizzes" -ForegroundColor Cyan
Write-Host "     hcvs files --all --sync" -ForegroundColor Cyan
Write-Host ""
Write-Host "To uninstall:"
Write-Host "  powershell -ExecutionPolicy Bypass -Command `"irm https://raw.githubusercontent.com/$Repo/stable/scripts/uninstall.ps1 | iex`""
Write-Host ""
