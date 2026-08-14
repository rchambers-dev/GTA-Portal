# Export PowerPoint slides to PNG for GTA Portal in-portal preview.
# Usage: powershell -File scripts/export-resource-preview-slides.ps1 <source> <outDir>
$ErrorActionPreference = "Stop"
if ($args.Count -lt 2) { throw "Usage: export-resource-preview-slides.ps1 <source> <outDir>" }
$src = $args[0]
$outDir = $args[1]
if (-not (Test-Path -LiteralPath $src)) { throw "Source file missing: $src" }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Get-ChildItem -LiteralPath $outDir -Filter "slide-*.png" -ErrorAction SilentlyContinue | Remove-Item -Force

function Get-ShapeText($shape) {
  $parts = New-Object System.Collections.Generic.List[string]
  try {
    if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1) {
      $t = $shape.TextFrame.TextRange.Text
      if ($t) { [void]$parts.Add((($t -replace "`r","").Trim())) }
    }
  } catch {}
  try {
    if ($shape.Type -eq 6) {
      foreach ($s in $shape.GroupItems) { foreach ($x in (Get-ShapeText $s)) { [void]$parts.Add($x) } }
    }
  } catch {}
  return $parts
}

$pp = New-Object -ComObject PowerPoint.Application
try { $pp.Visible = 0 } catch {}
$pres = $null
$slides = @()
try {
  $pres = $pp.Presentations.Open($src, $true, $true, $false)
  $i = 0
  foreach ($slide in $pres.Slides) {
    $i++
    $name = ("slide-{0:000}.png" -f $i)
    $png = Join-Path $outDir $name
    $slide.Export($png, "PNG", 1600, 900)
    $texts = New-Object System.Collections.Generic.List[string]
    foreach ($shape in $slide.Shapes) {
      foreach ($piece in (Get-ShapeText $shape)) {
        if ($piece -and -not $texts.Contains($piece)) { [void]$texts.Add($piece) }
      }
    }
    $slides += [pscustomobject]@{
      index = $i
      file = $name
      text = @($texts)
    }
  }
} finally {
  if ($pres -ne $null) {
    $pres.Close()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($pres)
  }
  $pp.Quit()
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($pp)
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

$manifest = [pscustomobject]@{
  generator = "powerpoint_com_png_v1"
  source = $src
  slideCount = $slides.Count
  slides = $slides
}
$manifestPath = Join-Path $outDir "manifest.json"
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8), $utf8)
Write-Host "exported $($slides.Count) slides"
