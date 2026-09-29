# ============================================================
# Pulse Transit - Brand / PWA Asset Generator
# Windows PowerShell compatible
# ============================================================

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = (Get-Location).Path
$publicDir = Join-Path $root "public"
$iconsDir = Join-Path $publicDir "icons"

New-Item -ItemType Directory -Force -Path $publicDir | Out-Null
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

# ============================================================
# HELPERS
# ============================================================

function New-RoundedRectanglePath {
    param(
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )

    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()

    $diameter = [float]($Radius * 2)

    $path.AddArc(
        $X,
        $Y,
        $diameter,
        $diameter,
        180,
        90
    )

    $path.AddArc(
        [float]($X + $Width - $diameter),
        $Y,
        $diameter,
        $diameter,
        270,
        90
    )

    $path.AddArc(
        [float]($X + $Width - $diameter),
        [float]($Y + $Height - $diameter),
        $diameter,
        $diameter,
        0,
        90
    )

    $path.AddArc(
        $X,
        [float]($Y + $Height - $diameter),
        $diameter,
        $diameter,
        90,
        90
    )

    $path.CloseFigure()

    return $path
}


function New-PulseIconBitmap {
    param(
        [int]$Size
    )

    $bitmap = [System.Drawing.Bitmap]::new(
        $Size,
        $Size,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )

    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    $graphics.SmoothingMode =
        [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $graphics.InterpolationMode =
        [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    $graphics.PixelOffsetMode =
        [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $graphics.TextRenderingHint =
        [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $background =
        [System.Drawing.Color]::FromArgb(
            255,
            4,
            8,
            22
        )

    $graphics.Clear($background)

    $padding = [float][Math]::Round($Size * 0.055)
    $radius = [float][Math]::Round($Size * 0.22)

    $innerWidth =
        [float]($Size - ($padding * 2))

    $innerHeight =
        [float]($Size - ($padding * 2))

    $rect =
        [System.Drawing.RectangleF]::new(
            $padding,
            $padding,
            $innerWidth,
            $innerHeight
        )

    $path =
        New-RoundedRectanglePath `
            -X $rect.X `
            -Y $rect.Y `
            -Width $rect.Width `
            -Height $rect.Height `
            -Radius $radius

    $gradientStart =
        [System.Drawing.Color]::FromArgb(
            255,
            15,
            30,
            70
        )

    $gradientEnd =
        [System.Drawing.Color]::FromArgb(
            255,
            79,
            46,
            145
        )

    $gradient =
        [System.Drawing.Drawing2D.LinearGradientBrush]::new(
            $rect,
            $gradientStart,
            $gradientEnd,
            35
        )

    $graphics.FillPath(
        $gradient,
        $path
    )

    # Cyan ambient glow
    $glowBrush =
        [System.Drawing.SolidBrush]::new(
            [System.Drawing.Color]::FromArgb(
                38,
                34,
                211,
                238
            )
        )

    $glowX = [float]($Size * 0.06)
    $glowY = [float]($Size * 0.03)
    $glowSize = [float]($Size * 0.72)

    $graphics.FillEllipse(
        $glowBrush,
        $glowX,
        $glowY,
        $glowSize,
        $glowSize
    )

    # Pulse "P"
    $fontSize =
        [float][Math]::Round(
            $Size * 0.49
        )

    $font =
        [System.Drawing.Font]::new(
            "Segoe UI",
            $fontSize,
            [System.Drawing.FontStyle]::Bold,
            [System.Drawing.GraphicsUnit]::Pixel
        )

    $textBrush =
        [System.Drawing.SolidBrush]::new(
            [System.Drawing.Color]::FromArgb(
                250,
                248,
                252,
                255
            )
        )

    $format =
        [System.Drawing.StringFormat]::new()

    $format.Alignment =
        [System.Drawing.StringAlignment]::Center

    $format.LineAlignment =
        [System.Drawing.StringAlignment]::Center

    $textRect =
        [System.Drawing.RectangleF]::new(
            0,
            [float](-$Size * 0.025),
            [float]$Size,
            [float]$Size
        )

    $graphics.DrawString(
        "P",
        $font,
        $textBrush,
        $textRect,
        $format
    )

    # Live/accent dot
    $dotSize =
        [float]($Size * 0.085)

    $dotBrush =
        [System.Drawing.SolidBrush]::new(
            [System.Drawing.Color]::FromArgb(
                255,
                16,
                185,
                129
            )
        )

    $graphics.FillEllipse(
        $dotBrush,
        [float]($Size * 0.73),
        [float]($Size * 0.20),
        $dotSize,
        $dotSize
    )

    # Fine outer border
    $borderWidth =
        [float][Math]::Max(
            1,
            $Size * 0.004
        )

    $borderPen =
        [System.Drawing.Pen]::new(
            [System.Drawing.Color]::FromArgb(
                38,
                255,
                255,
                255
            ),
            $borderWidth
        )

    $graphics.DrawPath(
        $borderPen,
        $path
    )

    $borderPen.Dispose()
    $dotBrush.Dispose()
    $format.Dispose()
    $textBrush.Dispose()
    $font.Dispose()
    $glowBrush.Dispose()
    $gradient.Dispose()
    $path.Dispose()
    $graphics.Dispose()

    return $bitmap
}


function Save-PulsePng {
    param(
        [int]$Size,
        [string]$Path
    )

    $bitmap =
        New-PulseIconBitmap `
            -Size $Size

    $bitmap.Save(
        $Path,
        [System.Drawing.Imaging.ImageFormat]::Png
    )

    $bitmap.Dispose()

    Write-Host "Created: $Path"
}


# ============================================================
# PWA / APP ICONS
# ============================================================

Save-PulsePng `
    -Size 192 `
    -Path (
        Join-Path $iconsDir "pulse-192.png"
    )

Save-PulsePng `
    -Size 512 `
    -Path (
        Join-Path $iconsDir "pulse-512.png"
    )

Save-PulsePng `
    -Size 180 `
    -Path (
        Join-Path $publicDir "apple-touch-icon.png"
    )


# ============================================================
# FAVICON
# ============================================================

$faviconBitmap =
    New-PulseIconBitmap `
        -Size 64

$faviconHandle =
    $faviconBitmap.GetHicon()

$faviconIcon =
    [System.Drawing.Icon]::FromHandle(
        $faviconHandle
    )

$faviconPath =
    Join-Path $publicDir "favicon.ico"

$faviconStream =
    [System.IO.File]::Create(
        $faviconPath
    )

try {
    $faviconIcon.Save(
        $faviconStream
    )
}
finally {
    $faviconStream.Dispose()
    $faviconIcon.Dispose()
    $faviconBitmap.Dispose()
}

Write-Host "Created: $faviconPath"


# ============================================================
# OPEN GRAPH / SOCIAL PREVIEW
# ============================================================

$ogWidth = 1200
$ogHeight = 630

$ogBitmap =
    [System.Drawing.Bitmap]::new(
        $ogWidth,
        $ogHeight,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )

$ogGraphics =
    [System.Drawing.Graphics]::FromImage(
        $ogBitmap
    )

$ogGraphics.SmoothingMode =
    [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

$ogGraphics.InterpolationMode =
    [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

$ogGraphics.TextRenderingHint =
    [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$backgroundRect =
    [System.Drawing.Rectangle]::new(
        0,
        0,
        $ogWidth,
        $ogHeight
    )

$backgroundGradient =
    [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        $backgroundRect,
        [System.Drawing.Color]::FromArgb(
            255,
            5,
            12,
            30
        ),
        [System.Drawing.Color]::FromArgb(
            255,
            35,
            21,
            78
        ),
        18
    )

$ogGraphics.FillRectangle(
    $backgroundGradient,
    $backgroundRect
)

# Atmospheric glow
$cyanGlow =
    [System.Drawing.SolidBrush]::new(
        [System.Drawing.Color]::FromArgb(
            30,
            34,
            211,
            238
        )
    )

$ogGraphics.FillEllipse(
    $cyanGlow,
    -150,
    -200,
    760,
    760
)

$purpleGlow =
    [System.Drawing.SolidBrush]::new(
        [System.Drawing.Color]::FromArgb(
            38,
            124,
            58,
            237
        )
    )

$ogGraphics.FillEllipse(
    $purpleGlow,
    720,
    130,
    680,
    680
)

# Brand icon
$brandIcon =
    New-PulseIconBitmap `
        -Size 150

$ogGraphics.DrawImage(
    $brandIcon,
    90,
    105,
    150,
    150
)

$titleFont =
    [System.Drawing.Font]::new(
        "Segoe UI",
        62,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel
    )

$subtitleFont =
    [System.Drawing.Font]::new(
        "Segoe UI",
        28,
        [System.Drawing.FontStyle]::Regular,
        [System.Drawing.GraphicsUnit]::Pixel
    )

$eyebrowFont =
    [System.Drawing.Font]::new(
        "Segoe UI",
        19,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel
    )

$whiteBrush =
    [System.Drawing.SolidBrush]::new(
        [System.Drawing.Color]::FromArgb(
            248,
            255,
            255,
            255
        )
    )

$secondaryBrush =
    [System.Drawing.SolidBrush]::new(
        [System.Drawing.Color]::FromArgb(
            190,
            211,
            221,
            238
        )
    )

$cyanBrush =
    [System.Drawing.SolidBrush]::new(
        [System.Drawing.Color]::FromArgb(
            255,
            103,
            232,
            249
        )
    )

$ogGraphics.DrawString(
    "COMMUTER INTELLIGENCE",
    $eyebrowFont,
    $cyanBrush,
    285,
    118
)

$ogGraphics.DrawString(
    "Pulse Transit",
    $titleFont,
    $whiteBrush,
    275,
    165
)

$ogGraphics.DrawString(
    "Smarter journeys across South Africa.",
    $subtitleFont,
    $secondaryBrush,
    285,
    260
)

$ogGraphics.DrawString(
    "Evidence-aware routes  |  Real GPS  |  Clearer transport choices",
    $subtitleFont,
    $secondaryBrush,
    92,
    410
)

$accentPen =
    [System.Drawing.Pen]::new(
        [System.Drawing.Color]::FromArgb(
            220,
            34,
            211,
            238
        ),
        5
    )

$ogGraphics.DrawLine(
    $accentPen,
    92,
    505,
    405,
    505
)

$ogPath =
    Join-Path $publicDir "og-image.png"

$ogBitmap.Save(
    $ogPath,
    [System.Drawing.Imaging.ImageFormat]::Png
)

$accentPen.Dispose()
$cyanBrush.Dispose()
$secondaryBrush.Dispose()
$whiteBrush.Dispose()
$eyebrowFont.Dispose()
$subtitleFont.Dispose()
$titleFont.Dispose()
$brandIcon.Dispose()
$purpleGlow.Dispose()
$cyanGlow.Dispose()
$backgroundGradient.Dispose()
$ogGraphics.Dispose()
$ogBitmap.Dispose()

Write-Host "Created: $ogPath"


# ============================================================
# ROBOTS.TXT
# ============================================================

$robotsPath =
    Join-Path $publicDir "robots.txt"

@"
User-agent: *
Allow: /
"@ |
    Set-Content `
        -Path $robotsPath `
        -Encoding UTF8

Write-Host "Created: $robotsPath"


# ============================================================
# FINAL VERIFICATION
# ============================================================

Write-Host ""
Write-Host "============================================"
Write-Host " Pulse Transit brand assets created"
Write-Host "============================================"
Write-Host ""

$requiredAssets = @(
    (Join-Path $publicDir "favicon.ico"),
    (Join-Path $publicDir "apple-touch-icon.png"),
    (Join-Path $iconsDir "pulse-192.png"),
    (Join-Path $iconsDir "pulse-512.png"),
    (Join-Path $publicDir "og-image.png"),
    (Join-Path $publicDir "robots.txt")
)

$allGood = $true

foreach ($asset in $requiredAssets) {
    if (Test-Path $asset) {
        $item = Get-Item $asset

        Write-Host (
            "OK  {0}  ({1} bytes)" -f
            $item.FullName,
            $item.Length
        )
    }
    else {
        Write-Host "MISSING  $asset"
        $allGood = $false
    }
}

Write-Host ""

if (-not $allGood) {
    throw "One or more Pulse assets were not created."
}

Write-Host "All Pulse brand assets created successfully."