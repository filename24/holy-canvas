# ==============================================================================
# holy-canvas (hcvs) - Standalone Installer for Windows (PowerShell)
# Installs holy-canvas without requiring a pre-installed Node.js runtime.
#
# Usage (Online):
#   irm https://raw.githubusercontent.com/holy-canvas/holy-canvas/main/scripts/install.ps1 | iex
#
# Usage (Local repository):
#   powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
# ==============================================================================

#Requires -Version 5.1

[CmdletBinding()]
param(
    [string]$Repo = $(if ($env:HOLY_CANVAS_REPO) { $env:HOLY_CANVAS_REPO } else { "holy-canvas/holy-canvas" }),
    [string]$InstallDir = $(if ($env:HOLY_CANVAS_HOME) { $env:HOLY_CANVAS_HOME } else { Join-Path $env:USERPROFILE ".holy-canvas" }),
    [string]$NodeVersion = $(if ($env:HOLY_CANVAS_NODE_VERSION) { $env:HOLY_CANVAS_NODE_VERSION } else { "v20.18.3" }),
    [string]$Branch = $(if ($env:HOLY_CANVAS_BRANCH) { $env:HOLY_CANVAS_BRANCH } else { "main" })
)

$ErrorActionPreference = "Stop"

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

function Show-Banner {
    Write-Host ""
    Write-Host "    __         __                       __                   " -ForegroundColor Cyan
    Write-Host "   / /  ___   / /__ __ ____ ____ ____ _ / /  __ __ ___ ____  " -ForegroundColor Cyan
    Write-Host "  / _ \/ _ \ / // // //___// __// _ ``// _ \/ // /(_-</___/  " -ForegroundColor Cyan
    Write-Host "  /_//_/\___//_/ \_, /     \__/ \_,_//_//_/\_,_//___/      " -ForegroundColor Cyan
    Write-Host "                /___/                                        " -ForegroundColor Cyan
    Write-Host "  Canvas LMS Terminal Client (hcvs) Windows Installer" -ForegroundColor White
    Write-Host "  Zero Node.js dependency required" -ForegroundColor Cyan
    Write-Host ""
}

Show-Banner

# 1. Detect Architecture
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

# 3. Setup Isolated Standalone Node.js Runtime
$NodeExe = Join-Path $RuntimeDir "node.exe"
$NpmCmd = Join-Path $RuntimeDir "npm.cmd"

if (-not (Test-Path $NodeExe)) {
    Write-Info "Setting up isolated portable Node.js runtime ($NodeVersion) in $RuntimeDir..."
    $NodeZipName = "node-$NodeVersion-win-$Arch.zip"
    $NodeZipUrl = "https://nodejs.org/dist/$NodeVersion/$NodeZipName"

    $TempZip = Join-Path $env:TEMP $NodeZipName
    $TempExtract = Join-Path $env:TEMP "node-extract-$([System.Guid]::NewGuid().ToString())"

    Write-Info "Downloading portable Node.js runtime from $NodeZipUrl..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $NodeZipUrl -OutFile $TempZip -UseBasicParsing

    Write-Info "Extracting runtime..."
    Expand-Archive -Path $TempZip -DestinationPath $TempExtract -Force
    $ExtractedFolder = Get-ChildItem -Path $TempExtract -Directory | Select-Object -First 1

    Copy-Item -Path (Join-Path $ExtractedFolder.FullName "*") -Destination $RuntimeDir -Recurse -Force
    Remove-Item -Path $TempZip -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $TempExtract -Recurse -Force -ErrorAction SilentlyContinue

    Write-Success "Portable Node runtime ready (completely isolated, no global changes)."
}

# 4. Install Application Files
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

if ($IsLocal) {
    Write-Info "Installing from local repository at $RepoRoot..."
    Copy-Item -Path $DistDir -Destination $AppDir -Recurse -Force
    Copy-Item -Path (Join-Path $RepoRoot "package.json") -Destination $AppDir -Force

    Write-Info "Installing standalone production dependencies using portable runtime..."
    $npmArgs = @("install", "--prefix", $AppDir, "--omit=dev", "--legacy-peer-deps", "--no-audit", "--no-fund", "--loglevel=error")
    Start-Process -FilePath $NpmCmd -ArgumentList $npmArgs -NoNewWindow -Wait
} else {
    $ReleaseUrl = "https://github.com/$Repo/releases/latest/download/holy-canvas-win-$Arch.zip"
    $DownloadedRelease = $false

    $TempReleaseZip = Join-Path $env:TEMP "holy-canvas-release.zip"
    Write-Info "Checking for pre-built release package..."
    try {
        Invoke-WebRequest -Uri $ReleaseUrl -OutFile $TempReleaseZip -UseBasicParsing -ErrorAction Stop
        Write-Info "Extracting pre-built release package..."
        Expand-Archive -Path $TempReleaseZip -DestinationPath $InstallDir -Force
        Remove-Item -Path $TempReleaseZip -Force -ErrorAction SilentlyContinue
        $DownloadedRelease = $true
    } catch {
        $DownloadedRelease = $false
    }

    if (-not $DownloadedRelease) {
        Write-Info "Fetching latest source code from GitHub ($Repo)..."
        $SourceZipUrl = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
        $TempSourceZip = Join-Path $env:TEMP "holy-canvas-src.zip"
        $TempSourceExtract = Join-Path $env:TEMP "holy-canvas-src-$([System.Guid]::NewGuid().ToString())"

        Invoke-WebRequest -Uri $SourceZipUrl -OutFile $TempSourceZip -UseBasicParsing
        Expand-Archive -Path $TempSourceZip -DestinationPath $TempSourceExtract -Force

        $SrcRoot = (Get-ChildItem -Path $TempSourceExtract -Directory | Select-Object -First 1).FullName
        Copy-Item -Path (Join-Path $SrcRoot "dist") -Destination $AppDir -Recurse -Force
        Copy-Item -Path (Join-Path $SrcRoot "package.json") -Destination $AppDir -Force

        Remove-Item -Path $TempSourceZip -Force -ErrorAction SilentlyContinue
        Remove-Item -Path $TempSourceExtract -Recurse -Force -ErrorAction SilentlyContinue

        Write-Info "Installing production dependencies with portable runtime..."
        $npmArgs = @("install", "--prefix", $AppDir, "--omit=dev", "--legacy-peer-deps", "--no-audit", "--no-fund", "--loglevel=error")
        Start-Process -FilePath $NpmCmd -ArgumentList $npmArgs -NoNewWindow -Wait
    }
}

# 5. Create Command Wrappers in BinDir
$CmdContent = @"
@echo off
setlocal
set "ROOT_DIR=%~dp0.."
set "NODE_EXE=%ROOT_DIR%\runtime\node.exe"
if not exist "%NODE_EXE%" (
    set "NODE_EXE=node"
)
set "CLI_SCRIPT=%ROOT_DIR%\app\dist\cli.js"
"%NODE_EXE%" "%CLI_SCRIPT%" %*
"@

$Ps1Content = @"
`$scriptDir = Split-Path -Parent `$MyInvocation.MyCommand.Definition
`$rootDir = Split-Path -Parent `$scriptDir
`$nodeExe = Join-Path `$rootDir "runtime\node.exe"
if (-not (Test-Path `$nodeExe)) {
    `$nodeExe = "node"
}
`$cliScript = Join-Path `$rootDir "app\dist\cli.js"
& `$nodeExe `$cliScript @args
"@

# Write holy-canvas.cmd & hcvs.cmd
Set-Content -Path (Join-Path $BinDir "holy-canvas.cmd") -Value $CmdContent -Encoding ASCII
Set-Content -Path (Join-Path $BinDir "hcvs.cmd") -Value $CmdContent -Encoding ASCII

# Write holy-canvas.ps1 & hcvs.ps1
Set-Content -Path (Join-Path $BinDir "holy-canvas.ps1") -Value $Ps1Content -Encoding UTF8
Set-Content -Path (Join-Path $BinDir "hcvs.ps1") -Value $Ps1Content -Encoding UTF8

# 6. Update User PATH environment variable
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$PathNeedsUpdate = $false

if ($UserPath -split ";" -notcontains $BinDir) {
    Write-Info "Adding $BinDir to User PATH..."
    $NewUserPath = if ([string]::IsNullOrWhiteSpace($UserPath)) { $BinDir } else { "$UserPath;$BinDir" }
    [Environment]::SetEnvironmentVariable("Path", $NewUserPath, "User")
    $PathNeedsUpdate = $true
}

# Update current session PATH so command works immediately in this session
if ($env:Path -split ";" -notcontains $BinDir) {
    $env:Path = "$env:Path;$BinDir"
}

# 7. Verify Installation
Write-Info "Verifying installation..."
$InstalledVersion = ""
try {
    $VerifyOutput = & (Join-Path $BinDir "holy-canvas.cmd") --version 2>$null
    $InstalledVersion = $VerifyOutput.Trim()
} catch {
    $InstalledVersion = ""
}

if ($InstalledVersion) {
    Write-Success "holy-canvas v$InstalledVersion successfully installed!"
} else {
    Write-Warn "Verification check finished. If holy-canvas is not recognized yet, restart your terminal."
}

# 8. Finished banner & guide
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "🎉 holy-canvas (alias: hcvs) is ready!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installed location: $InstallDir"
Write-Host "Command binaries:   $BinDir\holy-canvas.cmd, $BinDir\hcvs.cmd"
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
Write-Host "  powershell -ExecutionPolicy Bypass -Command `"irm https://raw.githubusercontent.com/$Repo/main/scripts/uninstall.ps1 | iex`""
Write-Host ""
