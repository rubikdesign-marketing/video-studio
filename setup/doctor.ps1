# Windows launcher. Needs Node 22.13 or newer; no admin rights. Same arguments as the runtime: .\setup\doctor.ps1 [--json]
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Node = $null
$cmd = Get-Command node -ErrorAction SilentlyContinue
if ($cmd) { $Node = $cmd.Source }
else {
  $portable = Join-Path (Join-Path (Join-Path $Root '.runtime') 'node') 'node.exe'
  if (Test-Path -LiteralPath $portable) { $Node = $portable }
}
function Fail-Node($why) {
  Write-Host $why
  Write-Host 'Install Node 22 LTS, no admin needed for the portable zip:'
  Write-Host '  winget install OpenJS.NodeJS.LTS'
  Write-Host '  or download the Windows .zip from https://nodejs.org, unzip it to .runtime\node inside the studio folder, and run this again.'
  exit 1
}
if (-not $Node) { Fail-Node 'Node.js was not found, and the studio needs Node 22.13 or newer.' }
$v = (& $Node -v).TrimStart('v').Split('.')
$major = [int]$v[0]; $minor = [int]$v[1]
if (-not (($major -eq 22 -and $minor -ge 13) -or $major -ge 24)) { Fail-Node "Node $($v -join '.') is too old. The studio needs Node 22.13 or newer (not 23)." }
Set-Location -LiteralPath $Root
& $Node (Join-Path (Join-Path $PSScriptRoot 'runtime') 'doctor.mjs') @args
exit $LASTEXITCODE
