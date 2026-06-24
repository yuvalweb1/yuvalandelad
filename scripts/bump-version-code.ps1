# Increments `versionCode` in android/app/build.gradle by 1.
# Called by build_release_for_android.bat before each release build.
$ErrorActionPreference = 'Stop'

$gradle = (Resolve-Path (Join-Path $PSScriptRoot '..\android\app\build.gradle')).Path
$content = [System.IO.File]::ReadAllText($gradle)

if ($content -notmatch 'versionCode\s+(\d+)') {
    throw "versionCode not found in $gradle"
}

$current = [int]$Matches[1]
$next = $current + 1
$content = $content -replace 'versionCode\s+\d+', "versionCode $next"

# WriteAllText keeps UTF-8 without a BOM, which Gradle expects.
[System.IO.File]::WriteAllText($gradle, $content)

Write-Host "versionCode: $current -> $next"
