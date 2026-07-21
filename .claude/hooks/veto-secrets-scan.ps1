# Veto hook: scan written files for exposed secrets (no API key needed).
param([string]$File)
if (-not $File -or -not (Test-Path $File)) { exit 0 }
$pattern = '(api[_-]?key|secret[_-]?key|password|passwd|token|access[_-]?key|private[_-]?key)\s*[=:]\s*[A-Za-z0-9+/]{20,}'
if (Select-String -Path $File -Pattern $pattern -Quiet -CaseSensitive:$false) {
  Write-Host "Veto: possible secret detected in $File — run veto_secrets_scan to confirm"
  exit 1
}
exit 0
