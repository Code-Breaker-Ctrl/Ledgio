<#
.SYNOPSIS
  Verification script for innerHTML audit table (docs/security/innerhtml-audit.md).
.DESCRIPTION
  Re-greps the codebase for innerHTML across all non-minified JavaScript and HTML entrypoints.
  Asserts that:
  1. Every file:line in docs/security/innerhtml-audit.md contains innerHTML.
  2. The table contains exactly the set of occurrences found by git grep (no missing, no phantoms).
  Exits with code 0 on PASS, throws/exits 1 on FAIL.
#>

$ErrorActionPreference = "Stop"

$baseDir = Split-Path -Parent $PSScriptRoot
if (-not $baseDir) { $baseDir = "." }

$auditFile = Join-Path $baseDir "docs\security\innerhtml-audit.md"
if (-not (Test-Path $auditFile)) {
    throw "Audit file not found: $auditFile"
}

Write-Host "Re-grepping innerHTML occurrences from git repository..." -ForegroundColor Cyan

# Run git grep
Push-Location $baseDir
try {
    $grepResults = git grep -n "innerHTML" -- "assets/js/*.js" ":(exclude)assets/js/*.min.js" index.html dashboard.html login.html signup.html
} finally {
    Pop-Location
}

if (-not $grepResults) {
    throw "git grep returned no results!"
}

# Parse grep output into Set of "file:line"
$greppedMap = @{}
$grepCount = 0
foreach ($line in $grepResults) {
    if ($line -match '^([^:]+):(\d+):(.*)$') {
        $key = "$($Matches[1]):$($Matches[2])"
        $greppedMap[$key] = $Matches[3]
        $grepCount++
    }
}

Write-Host "Found $grepCount innerHTML occurrences in codebase." -ForegroundColor Cyan

# Read docs/security/innerhtml-audit.md and extract audited file:line keys
$auditContent = [System.IO.File]::ReadAllLines($auditFile, [System.Text.Encoding]::UTF8)
$tableKeys = @()
foreach ($line in $auditContent) {
    if ($line -match '^\|\s*\d+\s*\|\s*`([^`:]+:\d+)`') {
        $tableKeys += $Matches[1]
    }
}

Write-Host "Found $($tableKeys.Count) entries in docs\security\innerhtml-audit.md table." -ForegroundColor Cyan

# Assert 1: Counts must match
if ($tableKeys.Count -ne $grepCount) {
    throw "Count mismatch! Table has $($tableKeys.Count) entries, but git grep found $grepCount entries."
}

# Assert 2: Every table entry must exist in grep results and contain innerHTML
$missingInGrep = @()
$contentMismatch = @()
foreach ($key in $tableKeys) {
    if (-not $greppedMap.ContainsKey($key)) {
        $missingInGrep += $key
    } else {
        $codeSnippet = $greppedMap[$key]
        if ($codeSnippet -notmatch 'innerHTML') {
            $contentMismatch += "$key does not contain 'innerHTML'! (Found: $codeSnippet)"
        }
    }
}

if ($missingInGrep.Count -gt 0) {
    throw "The following entries in innerhtml_audit.md do NOT match git grep:`n$($missingInGrep -join "`n")"
}

if ($contentMismatch.Count -gt 0) {
    throw "The following entries in innerhtml_audit.md do NOT contain innerHTML:`n$($contentMismatch -join "`n")"
}

# Assert 3: Every grep result must be in table (no omissions)
$tableSet = [System.Collections.Generic.HashSet[string]]::new([string[]]$tableKeys)
$missingInTable = @()
foreach ($k in $greppedMap.Keys) {
    if (-not $tableSet.Contains($k)) {
        $missingInTable += $k
    }
}

if ($missingInTable.Count -gt 0) {
    throw "The following git grep occurrences are MISSING from innerhtml_audit.md:`n$($missingInTable -join "`n")"
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  >>> INNERHTML AUDIT VERIFIED: $grepCount/$grepCount MATCHED <<<" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
exit 0
