# holy-canvas (hcvs) - Uninstaller for Windows (PowerShell)
$ErrorActionPreference = "Continue"
Write-Host "[INFO] Uninstalling holy-canvas..." -ForegroundColor Cyan
$InstallDir = if ($env:HOLY_CANVAS_HOME) { $env:HOLY_CANVAS_HOME } else { Join-Path $env:USERPROFILE ".holy-canvas" }
if (Test-Path $InstallDir) { Remove-Item -Path $InstallDir -Recurse -Force; Write-Host "[SUCCESS] Removed $InstallDir" -ForegroundColor Green }
$BinDir = Join-Path $InstallDir "bin"
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -split ";" -contains $BinDir) { $NewPaths = ($UserPath -split ";" | Where-Object { $_ -ne $BinDir }) -join ";"; [Environment]::SetEnvironmentVariable("Path", $NewPaths, "User"); Write-Host "[SUCCESS] Removed $BinDir from User PATH" -ForegroundColor Green }
Write-Host ""
Write-Host "holy-canvas (hcvs) has been successfully uninstalled." -ForegroundColor Green
