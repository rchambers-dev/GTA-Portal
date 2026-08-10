# Phase 2a — extract text from critical legacy .ppt via PowerPoint COM.
$ErrorActionPreference = "Stop"
$desk = "C:\Users\ReissChambers\OneDrive - Doncaster GTA\Desktop\Autocare Learning Materials\ACS L2 Lesson plans and resources"
$outRoot = "C:\Users\ReissChambers\OneDrive - Doncaster GTA\Documents\Developing\GTA Portal\tests\artifacts\autocare-v1\evidence-enriched\staging\phase2a"
$extractDir = Join-Path $outRoot "ppt-extracts"
New-Item -ItemType Directory -Force -Path $extractDir | Out-Null

$targets = @(
  @{ Theme="tyres";  Priority=1; Rel="G03 Wheels and Tyres\Resources\Tire Changing and Wheel Balancing.ppt"; Why="S9 remove/replace/balance core teaching deck" },
  @{ Theme="tyres";  Priority=1; Rel="G03 Wheels and Tyres\Resources\Tyre Inspection and Repair.ppt"; Why="S9 inspection/repair component" },
  @{ Theme="tyres";  Priority=1; Rel="G03 Wheels and Tyres\Resources\Tyres.ppt"; Why="Tyre knowledge/breadth (legislation, markings, types)" },
  @{ Theme="brakes"; Priority=1; Rel="G04 Basic Braking\Resources\Brake Calipers PP.ppt"; Why="Basic brake component teaching" },
  @{ Theme="brakes"; Priority=1; Rel="G04 Basic Braking\Resources\Brake Drums PP.ppt"; Why="Basic brake component teaching" },
  @{ Theme="brakes"; Priority=2; Rel="G04 Basic Braking\Resources\Brake Lines and Hoses.ppt"; Why="Hydraulic circuit components (K12 breadth)" },
  @{ Theme="brakes"; Priority=1; Rel="G04 Basic Braking\Resources\Wheel Speed Sensors.ppt"; Why="G4 placement of wheel-speed content (early vs advanced)" },
  @{ Theme="brakes"; Priority=1; Rel="G10 Advanced Braking\Resources\Wheel Speed Sensors.ppt"; Why="G10 variant — compare to G4 for progression/ownership" },
  @{ Theme="brakes"; Priority=1; Rel="G10 Advanced Braking\Resources\Anti-Lock Brake Systems.ppt"; Why="Advanced ABS teaching" },
  @{ Theme="brakes"; Priority=2; Rel="G10 Advanced Braking\Resources\Stability Control Systems.ppt"; Why="ESP advanced reinforcement" },
  @{ Theme="ev";     Priority=1; Rel="G02 Electric Hybrid Awareness\Resources\Safety in High Voltage Vehicles.ppt"; Why="HV safe working — G2 placement" },
  @{ Theme="ev";     Priority=1; Rel="G07 Starting and Charging Systems\Resources\Safety in High Voltage Vehicles.ppt"; Why="HV safe working — G7 variant compare" },
  @{ Theme="ev";     Priority=1; Rel="G02 Electric Hybrid Awareness\Resources\Working on High Voltage Vehicles.ppt"; Why="Potential isolation/working procedures vs awareness" },
  @{ Theme="ev";     Priority=1; Rel="G02 Electric Hybrid Awareness\Resources\Features of Hybrid Vehicles.ppt"; Why="Hybrid awareness depth — G2" },
  @{ Theme="ev";     Priority=1; Rel="G07 Starting and Charging Systems\Resources\Features of Hybrid Vehicles.ppt"; Why="Hybrid awareness — G7 variant compare" }
)

function Get-Sha256([string]$path) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $fs = [System.IO.File]::OpenRead($path)
  try { ($sha.ComputeHash($fs) | ForEach-Object { $_.ToString("x2") }) -join "" } finally { $fs.Dispose(); $sha.Dispose() }
}

function Get-ShapeText($shape) {
  $parts = New-Object System.Collections.Generic.List[string]
  try {
    if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1) {
      $t = $shape.TextFrame.TextRange.Text
      if ($t) { [void]$parts.Add(($t -replace "`r","").Trim()) }
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

$manifest = @()
try {
  foreach ($t in $targets) {
    $src = Join-Path $desk $t.Rel
    $safe = ($t.Theme + "__" + ($t.Rel -replace "[\\/:*?`"<>| ]","_"))
    $txtOut = Join-Path $extractDir ($safe + ".txt")
    $metaOut = Join-Path $extractDir ($safe + ".json")
    $rec = [ordered]@{
      theme=$t.Theme; priority=$t.Priority; whySelected=$t.Why
      originalPath=$src; relativePath=$t.Rel; sourceFilename=[IO.Path]::GetFileName($t.Rel)
      exists=(Test-Path -LiteralPath $src); contentHashSha256=$null; byteLength=$null
      extractionMethod="powerpoint_com_slidetext_v1"; extractionStatus="PENDING"
      extractionNotes=@(); slideCount=0; extractedCharCount=0; extractedTextPath=$txtOut
      extractedAt=(Get-Date).ToString("o")
    }
    if (-not $rec.exists) { $rec.extractionStatus="FAILED"; $rec.extractionNotes+="missing"; $manifest+=[pscustomobject]$rec; continue }
    $rec.contentHashSha256 = Get-Sha256 $src
    $rec.byteLength = (Get-Item -LiteralPath $src).Length
    Write-Host "Extracting $($t.Rel) ..."
    $pres = $null
    try {
      $pres = $pp.Presentations.Open($src, $true, $true, $false)
      $sb = New-Object System.Text.StringBuilder
      [void]$sb.AppendLine("SOURCE: $($t.Rel)")
      [void]$sb.AppendLine("HASH: $($rec.contentHashSha256)")
      [void]$sb.AppendLine("METHOD: powerpoint_com_slidetext_v1")
      [void]$sb.AppendLine("")
      $slideN = 0
      foreach ($slide in $pres.Slides) {
        $slideN++
        [void]$sb.AppendLine("===== SLIDE $slideN =====")
        $slideTexts = New-Object System.Collections.Generic.List[string]
        foreach ($shape in $slide.Shapes) {
          foreach ($piece in (Get-ShapeText $shape)) {
            if ($piece -and -not $slideTexts.Contains($piece)) { [void]$slideTexts.Add($piece) }
          }
        }
        if ($slideTexts.Count -eq 0) {
          [void]$sb.AppendLine("[NO EXTRACTABLE TEXT ON SLIDE — may be image-only]")
          $rec.extractionNotes += "Slide $slideN no text"
        } else {
          foreach ($line in $slideTexts) { [void]$sb.AppendLine($line); [void]$sb.AppendLine("") }
        }
      }
      $rec.slideCount = $slideN
      $text = $sb.ToString()
      $rec.extractedCharCount = $text.Length
      [IO.File]::WriteAllText($txtOut, $text, [Text.UTF8Encoding]::new($false))
      $emptySlides = @($rec.extractionNotes | Where-Object { $_ -match "no text" }).Count
      if ($rec.extractedCharCount -lt 200) { $rec.extractionStatus = "PARTIAL_OR_UNRELIABLE" }
      elseif ($emptySlides -gt ($slideN/2)) { $rec.extractionStatus = "PARTIAL_OR_UNRELIABLE" }
      else { $rec.extractionStatus = "EXTRACTED" }
    } catch {
      $rec.extractionStatus = "FAILED"
      $rec.extractionNotes += $_.Exception.Message
      Write-Host "  FAIL" $_.Exception.Message
    } finally {
      if ($pres -ne $null) { $pres.Close(); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($pres) }
    }
    ($rec | ConvertTo-Json -Depth 6) | Set-Content -LiteralPath $metaOut -Encoding UTF8
    $manifest += [pscustomobject]$rec
  }
} finally {
  $pp.Quit()
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($pp)
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}

$manifestPath = Join-Path $outRoot "critical-ppt-manifest.json"
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Host "Wrote $manifestPath"
$manifest | Select-Object theme, extractionStatus, slideCount, extractedCharCount, sourceFilename | Format-Table -AutoSize
