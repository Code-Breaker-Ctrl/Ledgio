$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $scriptDir "check_unstyled.js")
if ($LASTEXITCODE -ne 0) {
    exit 1
}
