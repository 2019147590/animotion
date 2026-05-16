Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$sourcePath = Join-Path (Get-Location) "endmotion.png"
$outDir = Join-Path (Get-Location) "post_parts"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Clear-DarkInkRegions($bitmap, $regions) {
  foreach ($region in $regions) {
    $left = [Math]::Max(0, [int]$region.x)
    $top = [Math]::Max(0, [int]$region.y)
    $right = [Math]::Min($bitmap.Width, [int]($region.x + $region.width))
    $bottom = [Math]::Min($bitmap.Height, [int]($region.y + $region.height))

    for ($y = $top; $y -lt $bottom; $y++) {
      for ($x = $left; $x -lt $right; $x++) {
        $pixel = $bitmap.GetPixel($x, $y)
        if ($pixel.A -gt 0 -and $pixel.R -lt 130 -and $pixel.G -lt 130 -and $pixel.B -lt 130) {
          $bitmap.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
        }
      }
    }
  }
}

$parts = @(
  @{
    name = "attacker_strike_limb"; order = 10; x = 0; y = 78; width = 156; height = 204
    pivot = @{ x = 54; y = 118 }
    polygon = @(0,102, 54,78, 124,84, 156,126, 124,182, 30,204, 0,178)
    eraseInk = @(@{ x = 88; y = 0; width = 68; height = 58 })
  },
  @{
    name = "attacker_torso"; order = 20; x = 62; y = 62; width = 152; height = 128
    pivot = @{ x = 132; y = 116 }
    polygon = @(62,130, 82,72, 160,62, 214,106, 200,164, 126,190, 78,170)
    eraseInk = @(@{ x = 0; y = 0; width = 58; height = 62 })
  },
  @{
    name = "attacker_head"; order = 30; x = 96; y = 18; width = 116; height = 84
    pivot = @{ x = 150; y = 84 }
    polygon = @(108,56, 130,20, 188,18, 212,52, 198,88, 154,102, 112,88)
  },
  @{
    name = "attacker_trailing_arm"; order = 40; x = 144; y = 94; width = 88; height = 92
    pivot = @{ x = 164; y = 122 }
    polygon = @(154,98, 198,108, 232,150, 210,186, 168,158, 144,124)
  },
  @{
    name = "evader_back_leg"; order = 50; x = 0; y = 402; width = 112; height = 246
    pivot = @{ x = 64; y = 450 }
    polygon = @(18,402, 106,430, 112,520, 82,648, 16,636, 0,512)
  },
  @{
    name = "evader_front_leg"; order = 60; x = 72; y = 348; width = 160; height = 240
    pivot = @{ x = 124; y = 398 }
    polygon = @(78,348, 176,370, 232,468, 192,588, 112,560, 72,448)
    eraseInk = @(@{ x = 0; y = 140; width = 112; height = 100 })
  },
  @{
    name = "evader_torso"; order = 70; x = 46; y = 204; width = 158; height = 162
    pivot = @{ x = 118; y = 306 }
    polygon = @(92,204, 168,218, 204,288, 168,364, 76,350, 46,274)
  },
  @{
    name = "evader_head"; order = 80; x = 92; y = 170; width = 82; height = 78
    pivot = @{ x = 126; y = 238 }
    polygon = @(108,174, 154,170, 174,204, 158,238, 118,248, 92,218)
  },
  @{
    name = "evader_back_arm"; order = 90; x = 6; y = 244; width = 116; height = 120
    pivot = @{ x = 84; y = 278 }
    polygon = @(76,244, 122,268, 112,322, 40,364, 6,334, 32,286)
  },
  @{
    name = "evader_front_arm"; order = 100; x = 126; y = 236; width = 114; height = 112
    pivot = @{ x = 154; y = 272 }
    polygon = @(134,236, 186,252, 240,296, 220,348, 158,324, 126,276)
  }
)

$source = [System.Drawing.Image]::FromFile($sourcePath)
try {
  foreach ($part in $parts) {
    $pixelFormat = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    $bitmap = New-Object System.Drawing.Bitmap $part.width, $part.height, $pixelFormat
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.Clear([System.Drawing.Color]::Transparent)

      $points = New-Object System.Collections.Generic.List[System.Drawing.PointF]
      for ($i = 0; $i -lt $part.polygon.Count; $i += 2) {
        $points.Add([System.Drawing.PointF]::new($part.polygon[$i] - $part.x, $part.polygon[$i + 1] - $part.y))
      }

      $path = New-Object System.Drawing.Drawing2D.GraphicsPath
      $path.AddPolygon($points.ToArray())
      $graphics.SetClip($path)
      $graphics.DrawImage($source, -$part.x, -$part.y, $source.Width, $source.Height)
    }
    finally {
      $graphics.Dispose()
    }

    if ($part.ContainsKey("eraseInk")) {
      Clear-DarkInkRegions $bitmap $part.eraseInk
    }

    $filePath = Join-Path $outDir "$($part.name).png"
    $bitmap.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
  }
}
finally {
  $source.Dispose()
}

$manifest = [ordered]@{
  source = "endmotion.png"
  generatedAt = (Get-Date).ToString("s")
  note = "Post-impact dodge rig parts. Attacker drives pressure while evader slips from side dodge into back-lean dodge."
  parts = @()
}

foreach ($part in $parts) {
  $manifest.parts += [ordered]@{
    name = $part.name
    file = "post_parts/$($part.name).png"
    order = $part.order
    polygon = $part.polygon
    bounds = [ordered]@{ x = $part.x; y = $part.y; width = $part.width; height = $part.height }
    pivot = $part.pivot
  }
}

$manifestPath = Join-Path $outDir "manifest.json"
$json = $manifest | ConvertTo-Json -Depth 8 -Compress
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($manifestPath, $json, $utf8NoBom)
