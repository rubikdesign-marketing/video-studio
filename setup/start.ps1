# One step from an unzipped download to a ready studio, on Windows. No admin rights. Safe to run again.
#   powershell -ExecutionPolicy Bypass -File setup\start.ps1
#   powershell -ExecutionPolicy Bypass -File setup\start.ps1 --import-from <old folder>
#
# 1. Removes the "downloaded from the internet" mark from this folder's files, so Windows does not block them.
# 2. Finds Node 22.13+ (or 24+). If there is none, downloads the official portable Node (win-x64; Windows on Arm runs
#    it under emulation, which Remotion needs) into .runtime\node, checked against nodejs.org's SHA-256 list.
# 3. Hands over to setup\runtime\start.mjs: hidden files, core install, quick check.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root
$NodeVersion = '22.23.1'

Get-ChildItem -LiteralPath $Root -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue

function Test-NodeOk($exe) {
  try {
    $v = (& $exe -v).TrimStart('v').Split('.')
    $major = [int]$v[0]; $minor = [int]$v[1]
    return (($major -eq 22 -and $minor -ge 13) -or $major -ge 24)
  } catch { return $false }
}

$Portable = Join-Path $Root '.runtime\node\node.exe'
$Node = $null
if ((Test-Path -LiteralPath $Portable) -and (Test-NodeOk $Portable)) { $Node = $Portable }
else {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd -and (Test-NodeOk $cmd.Source)) { $Node = $cmd.Source }
}

if (-not $Node) {
  $Name = "node-v$NodeVersion-win-x64"
  $Base = "https://nodejs.org/dist/v$NodeVersion"
  $Tmp = Join-Path $Root '.runtime\download'
  Write-Host "Node 22.13 or newer was not found. Downloading the portable Node $NodeVersion into this folder (about 35 MB, no admin)..."
  if (Test-Path -LiteralPath $Tmp) { Remove-Item -LiteralPath $Tmp -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $Tmp | Out-Null
  try {
    Invoke-WebRequest -UseBasicParsing -Uri "$Base/$Name.zip" -OutFile (Join-Path $Tmp "$Name.zip")
    Invoke-WebRequest -UseBasicParsing -Uri "$Base/SHASUMS256.txt" -OutFile (Join-Path $Tmp 'SHASUMS256.txt')
  } catch {
    Write-Host 'The download did not work. Check the internet connection and run this again, or install Node 22 LTS from https://nodejs.org.'
    exit 1
  }
  $line = Get-Content (Join-Path $Tmp 'SHASUMS256.txt') | Where-Object { $_ -match " $([regex]::Escape("$Name.zip"))$" } | Select-Object -First 1
  $want = if ($line) { $line.Split(' ')[0] } else { '' }
  $got = (Get-FileHash -Algorithm SHA256 (Join-Path $Tmp "$Name.zip")).Hash.ToLower()
  if (-not $want -or $want -ne $got) {
    Write-Host "The downloaded Node did not match nodejs.org's checksum, so it was not used. Run this again."
    Remove-Item -LiteralPath $Tmp -Recurse -Force; exit 1
  }
  Expand-Archive -LiteralPath (Join-Path $Tmp "$Name.zip") -DestinationPath $Tmp -Force
  $Dest = Join-Path $Root '.runtime\node'
  if (Test-Path -LiteralPath $Dest) { Remove-Item -LiteralPath $Dest -Recurse -Force }
  Move-Item -LiteralPath (Join-Path $Tmp $Name) -Destination $Dest
  Remove-Item -LiteralPath $Tmp -Recurse -Force
  $Node = $Portable
}

# npx and package scripts look Node up on PATH, so this Node goes first.
$env:Path = (Split-Path -Parent $Node) + ';' + $env:Path
& $Node (Join-Path $Root 'setup\runtime\start.mjs') @args
exit $LASTEXITCODE
