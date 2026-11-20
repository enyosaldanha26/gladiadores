param(
    [string]$WorkspaceRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing

# WinRT async helpers
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
$asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
})[0]

function Await-WinRtOp {
    param($WinRtTask, [Type]$ResultType)
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

function Await-WinRtAction {
    param($WinRtTask)
    $netTask = $asTaskAction.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
}

# Explicit WinRT type loading
[void][Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
[void][Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType=WindowsRuntime]
[void][Windows.Data.Pdf.PdfPageRenderOptions, Windows.Data.Pdf, ContentType=WindowsRuntime]
[void][Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime]

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1

function Save-JpegWithQuality {
    param(
        [System.Drawing.Image]$Image,
        [string]$OutPath,
        [long]$Quality = 90
    )
    $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $Quality)
    try {
        $Image.Save($OutPath, $jpegCodec, $encParams)
    }
    finally {
        $encParams.Dispose()
    }
}

function CropAndResize-Bitmap {
    param(
        [System.Drawing.Bitmap]$Source,
        [int]$CropX,
        [int]$CropY,
        [int]$CropW,
        [int]$CropH,
        [int]$DestW,
        [int]$DestH,
        [System.Drawing.Imaging.PixelFormat]$PixelFormat = [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
    )
    $dest = New-Object System.Drawing.Bitmap($DestW, $DestH, $PixelFormat)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    try {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        if ($PixelFormat -eq [System.Drawing.Imaging.PixelFormat]::Format32bppArgb) {
            $g.Clear([System.Drawing.Color]::Transparent)
        }
        $srcRect = New-Object System.Drawing.Rectangle($CropX, $CropY, $CropW, $CropH)
        $dstRect = New-Object System.Drawing.Rectangle(0, 0, $DestW, $DestH)
        $g.DrawImage($Source, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    }
    finally {
        $g.Dispose()
    }
    return $dest
}

function Render-PdfPageToBitmap {
    param(
        [Windows.Data.Pdf.PdfDocument]$Doc,
        [uint32]$PageIndexZeroBased,
        [uint32]$DestWidth,
        [uint32]$DestHeight
    )
    $page = $Doc.GetPage($PageIndexZeroBased)
    $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    $opts = New-Object Windows.Data.Pdf.PdfPageRenderOptions
    $opts.DestinationWidth = $DestWidth
    $opts.DestinationHeight = $DestHeight
    $netStream = $null
    $tempBmp = $null
    try {
        Await-WinRtAction ($page.RenderToStreamAsync($stream, $opts))
        $stream.Seek(0)
        $netStream = [System.IO.WindowsRuntimeStreamExtensions]::AsStream($stream)
        $tempBmp = [System.Drawing.Bitmap]::FromStream($netStream)
        # Clone into an independent bitmap so stream can be safely disposed
        return (New-Object System.Drawing.Bitmap($tempBmp))
    }
    finally {
        if ($tempBmp) { $tempBmp.Dispose() }
        if ($netStream) { $netStream.Dispose() }
        $stream.Dispose()
        $page.Dispose()
    }
}

$arquivosDir = Join-Path $WorkspaceRoot "arquivos"
$cardsDir    = Join-Path $WorkspaceRoot "assets\cards"
$boardsDir   = Join-Path $WorkspaceRoot "assets\boards"
$uiDir       = Join-Path $WorkspaceRoot "assets\ui"

New-Item -ItemType Directory -Force -Path $cardsDir, $boardsDir, $uiDir | Out-Null

Write-Host "Extraindo cartas da frente (GLD_cards_front.pdf)..."
$frontPdfPath = Join-Path $arquivosDir "GLD_cards_front.pdf"
$frontFile = Await-WinRtOp ([Windows.Storage.StorageFile]::GetFileFromPathAsync($frontPdfPath)) ([Windows.Storage.StorageFile])
$frontDoc  = Await-WinRtOp ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($frontFile)) ([Windows.Data.Pdf.PdfDocument])

$cardRenderW = 522
$cardRenderH = 711
$cardCropX = [int][Math]::Round(0.0435 * $cardRenderW)
$cardCropY = [int][Math]::Round(0.0319 * $cardRenderH)
$cardCropW = [int][Math]::Round(0.9130 * $cardRenderW)
$cardCropH = [int][Math]::Round(0.9362 * $cardRenderH)
$cardOutW = 380
$cardOutH = 530

# Pages 2..51 (1-based) -> indices 1..50 -> GL001..GL050
for ($p = 1; $p -le 50; $p++) {
    $code = "GL{0:D3}.jpg" -f $p
    $outPath = Join-Path $cardsDir $code
    $rawBmp = Render-PdfPageToBitmap -Doc $frontDoc -PageIndexZeroBased $p -DestWidth $cardRenderW -DestHeight $cardRenderH
    $finalBmp = CropAndResize-Bitmap -Source $rawBmp -CropX $cardCropX -CropY $cardCropY -CropW $cardCropW -CropH $cardCropH -DestW $cardOutW -DestH $cardOutH
    try {
        Save-JpegWithQuality -Image $finalBmp -OutPath $outPath -Quality 90
    }
    finally {
        $finalBmp.Dispose()
        $rawBmp.Dispose()
    }
}

# Page 52 (index 51) -> first_player.jpg
$fpPath = Join-Path $cardsDir "first_player.jpg"
$rawFp = Render-PdfPageToBitmap -Doc $frontDoc -PageIndexZeroBased 51 -DestWidth $cardRenderW -DestHeight $cardRenderH
$finalFp = CropAndResize-Bitmap -Source $rawFp -CropX $cardCropX -CropY $cardCropY -CropW $cardCropW -CropH $cardCropH -DestW $cardOutW -DestH $cardOutH
try {
    Save-JpegWithQuality -Image $finalFp -OutPath $fpPath -Quality 90
}
finally {
    $finalFp.Dispose()
    $rawFp.Dispose()
}

Write-Host "Extraindo verso das cartas (GLD_cards_back.pdf)..."
$backPdfPath = Join-Path $arquivosDir "GLD_cards_back.pdf"
$backFile = Await-WinRtOp ([Windows.Storage.StorageFile]::GetFileFromPathAsync($backPdfPath)) ([Windows.Storage.StorageFile])
$backDoc  = Await-WinRtOp ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($backFile)) ([Windows.Data.Pdf.PdfDocument])

$backPath = Join-Path $cardsDir "card_back.jpg"
$rawBack = Render-PdfPageToBitmap -Doc $backDoc -PageIndexZeroBased 1 -DestWidth $cardRenderW -DestHeight $cardRenderH
$finalBack = CropAndResize-Bitmap -Source $rawBack -CropX $cardCropX -CropY $cardCropY -CropW $cardCropW -CropH $cardCropH -DestW $cardOutW -DestH $cardOutH
try {
    Save-JpegWithQuality -Image $finalBack -OutPath $backPath -Quality 90
}
finally {
    $finalBack.Dispose()
    $rawBack.Dispose()
}

Write-Host "Extraindo tabuleiros Lado A e Lado B (GLD_foldable_board.pdf)..."
$boardPdfPath = Join-Path $arquivosDir "GLD_foldable_board.pdf"
$boardFile = Await-WinRtOp ([Windows.Storage.StorageFile]::GetFileFromPathAsync($boardPdfPath)) ([Windows.Storage.StorageFile])
$boardDoc  = Await-WinRtOp ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($boardFile)) ([Windows.Data.Pdf.PdfDocument])

$boardRenderW = 2302
$boardRenderH = 828
$boardCropX = [int][Math]::Round((11.0 / 1534.0) * $boardRenderW)
$boardCropY = [int][Math]::Round((11.0 / 552.0)  * $boardRenderH)
$boardCropW = [int][Math]::Round((1512.0 / 1534.0) * $boardRenderW)
$boardCropH = [int][Math]::Round((530.0 / 552.0)   * $boardRenderH)
$boardOutW = 2268
$boardOutH = 795

foreach ($entry in @(@{Idx=0; Name="board_a.jpg"}, @{Idx=1; Name="board_b.jpg"})) {
    $rawBoard = Render-PdfPageToBitmap -Doc $boardDoc -PageIndexZeroBased $entry.Idx -DestWidth $boardRenderW -DestHeight $boardRenderH
    $finalBoard = CropAndResize-Bitmap -Source $rawBoard -CropX $boardCropX -CropY $boardCropY -CropW $boardCropW -CropH $boardCropH -DestW $boardOutW -DestH $boardOutH
    try {
        Save-JpegWithQuality -Image $finalBoard -OutPath (Join-Path $boardsDir $entry.Name) -Quality 92
    }
    finally {
        $finalBoard.Dispose()
        $rawBoard.Dispose()
    }
}

Write-Host "Processando artes de UI (logo.png, box.png, cover_bg.jpg)..."
$logoSrcPath = Join-Path $arquivosDir "logoPTBR (1).png"
$logoSrc = [System.Drawing.Bitmap]::FromFile($logoSrcPath)
try {
    $logoCropW = 2810
    $logoCropH = 1205
    $logoOutW = 960
    $logoOutH = [int][Math]::Round($logoCropH * ($logoOutW / $logoCropW))
    $logoOut = CropAndResize-Bitmap -Source $logoSrc -CropX 0 -CropY 0 -CropW $logoCropW -CropH $logoCropH -DestW $logoOutW -DestH $logoOutH -PixelFormat ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $logoOut.Save((Join-Path $uiDir "logo.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $logoOut.Dispose()
    }
}
finally {
    $logoSrc.Dispose()
}

$boxSrcPath = Join-Path $arquivosDir "BoxPTBR.png"
$boxSrc = [System.Drawing.Bitmap]::FromFile($boxSrcPath)
try {
    $boxOutW = 640
    $boxOutH = [int][Math]::Round($boxSrc.Height * ($boxOutW / $boxSrc.Width))
    $boxOut = CropAndResize-Bitmap -Source $boxSrc -CropX 0 -CropY 0 -CropW $boxSrc.Width -CropH $boxSrc.Height -DestW $boxOutW -DestH $boxOutH -PixelFormat ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $boxOut.Save((Join-Path $uiDir "box.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $boxOut.Dispose()
    }
}
finally {
    $boxSrc.Dispose()
}

$manualPdfPath = Join-Path $arquivosDir "Coliseu_Manual_25-09-30.pdf"
$manualFile = Await-WinRtOp ([Windows.Storage.StorageFile]::GetFileFromPathAsync($manualPdfPath)) ([Windows.Storage.StorageFile])
$manualDoc  = Await-WinRtOp ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($manualFile)) ([Windows.Data.Pdf.PdfDocument])
$coverBmp = Render-PdfPageToBitmap -Doc $manualDoc -PageIndexZeroBased 0 -DestWidth 1145 -DestHeight 1655
try {
    Save-JpegWithQuality -Image $coverBmp -OutPath (Join-Path $uiDir "cover_bg.jpg") -Quality 88
}
finally {
    $coverBmp.Dispose()
}

Write-Host "Concluido!"
Write-Host "  assets/cards : $((Get-ChildItem $cardsDir).Count) arquivos"
Write-Host "  assets/boards: $((Get-ChildItem $boardsDir).Count) arquivos"
Write-Host "  assets/ui    : $((Get-ChildItem $uiDir).Count) arquivos"
