param(
    [int]$Port = 8765,
    [switch]$OpenApp,
    [string]$StartPage = "",
    [string]$WorkspaceRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

$rootFull = [System.IO.Path]::GetFullPath($WorkspaceRoot)
if (-not $rootFull.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
    $rootFull += [System.IO.Path]::DirectorySeparatorChar
}

$mimeMap = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.png'  = 'image/png'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.pdf'  = 'application/pdf'
}

$listener = $null
$boundPort = $Port
for ($try = 0; $try -lt 20; $try++) {
    $candidatePort = $Port + $try
    $candidate = New-Object System.Net.HttpListener
    $candidate.Prefixes.Add("http://127.0.0.1:$candidatePort/")
    try {
        $candidate.Start()
        $listener = $candidate
        $boundPort = $candidatePort
        break
    }
    catch {
        try { $candidate.Close() } catch {}
    }
}

if (-not $listener) {
    Write-Error "Nao foi possivel iniciar o servidor HTTP entre as portas $Port e $($Port + 19)."
    exit 1
}

$baseUrl = "http://127.0.0.1:$boundPort/"
$cleanStartPage = $StartPage.TrimStart('/')
$appUrl = if ([string]::IsNullOrWhiteSpace($cleanStartPage)) { $baseUrl } else { "$baseUrl$cleanStartPage" }
Write-Host "Gladiadores rodando em: $appUrl"
Write-Host "Pressione Ctrl+C ou feche esta janela para encerrar o jogo."

if ($OpenApp) {
    $edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    $chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    if (Test-Path -LiteralPath $edgePath) {
        Start-Process -FilePath $edgePath -ArgumentList @("--app=$appUrl", "--window-size=1440,900")
    }
    elseif (Test-Path -LiteralPath $chromePath) {
        Start-Process -FilePath $chromePath -ArgumentList @("--app=$appUrl", "--window-size=1440,900")
    }
    else {
        Start-Process $appUrl
    }
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response
        try {
            $relPath = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
            if ([string]::IsNullOrWhiteSpace($relPath)) {
                $relPath = 'index.html'
            }
            $relPath = $relPath -replace '/', '\'
            $targetPath = [System.IO.Path]::GetFullPath((Join-Path $rootFull $relPath))

            # Protecao contra path traversal
            if (-not $targetPath.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
                $res.StatusCode = 403
                $bytes = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden")
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
                continue
            }

            if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
                $res.StatusCode = 404
                $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
                continue
            }

            $ext = [System.IO.Path]::GetExtension($targetPath).ToLowerInvariant()
            $res.ContentType = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { 'application/octet-stream' }
            $res.AddHeader('Cache-Control', 'no-cache')

            $fileBytes = [System.IO.File]::ReadAllBytes($targetPath)
            $res.ContentLength64 = $fileBytes.Length
            $res.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
        }
        catch {
            try { $res.StatusCode = 500 } catch {}
        }
        finally {
            try { $res.OutputStream.Close() } catch {}
        }
    }
}
finally {
    if ($listener) {
        try { $listener.Stop() } catch {}
        try { $listener.Close() } catch {}
    }
}
