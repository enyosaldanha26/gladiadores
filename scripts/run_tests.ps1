param(
    [string]$WorkspaceRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

$browserPath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path -LiteralPath $browserPath)) {
    $browserPath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
}
if (-not (Test-Path -LiteralPath $browserPath)) {
    Write-Error "Nenhum navegador Chromium encontrado para executar os testes headless."
    exit 1
}

$testHtml = Join-Path $WorkspaceRoot "tests\engine.test.html"
$testUri = ([System.Uri]$testHtml).AbsoluteUri
$guid = [guid]::NewGuid().ToString("N")
$tmpProfile = Join-Path $env:TEMP ("gladiadores_test_profile_" + $guid)
$outFile = Join-Path $env:TEMP ("gladiadores_test_dom_" + $guid + ".html")

try {
    $proc = Start-Process -FilePath $browserPath -ArgumentList @(
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--allow-file-access-from-files",
        "--user-data-dir=`"$tmpProfile`"",
        "--dump-dom",
        "`"$testUri`""
    ) -Wait -PassThru -RedirectStandardOutput $outFile

    if (-not (Test-Path -LiteralPath $outFile)) {
        Write-Error "Falha ao capturar DOM dos testes (ExitCode: $($proc.ExitCode))."
        exit 1
    }

    $rawHtml = Get-Content -LiteralPath $outFile -Raw -Encoding UTF8
    $statusMatch = [regex]::Match($rawHtml, 'data-status="([^"]+)"')
    $preMatch = [regex]::Match($rawHtml, '<pre[^>]*>([\s\S]*?)</pre>')

    if ($preMatch.Success) {
        $decoded = [System.Net.WebUtility]::HtmlDecode($preMatch.Groups[1].Value)
        Write-Output $decoded
    } else {
        Write-Output $rawHtml
    }

    if (-not $statusMatch.Success -or $statusMatch.Groups[1].Value -ne 'passed') {
        Write-Error "Suite de testes falhou ou nao concluiu."
        exit 1
    }
    Write-Host "Todos os testes automatizados passaram!"
}
finally {
    Remove-Item -LiteralPath $outFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $tmpProfile -Recurse -Force -ErrorAction SilentlyContinue
}
