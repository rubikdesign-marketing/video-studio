# Windows launcher. Opens Claude Code with the video menu as the first thing you see.
#   .\setup\start.ps1                   starts:  claude "/video-menu"
#   .\setup\start.ps1 <extra args>      passes them on to claude
#   .\setup\start.ps1 --print-command   prints the command instead of running it
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

if ($args.Count -gt 0 -and $args[0] -eq '--print-command') {
  $rest = @($args | Select-Object -Skip 1)
  Write-Output ((@('claude', '"/video-menu"') + $rest) -join ' ')
  exit 0
}

$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude) {
  Write-Host 'Claude Code is not installed or not on PATH. In the Claude desktop app, open this folder and type /video-menu instead.'
  exit 1
}
& $claude.Source '/video-menu' @args
exit $LASTEXITCODE
