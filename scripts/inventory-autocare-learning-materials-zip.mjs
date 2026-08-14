/**
 * Inventory Autocare Learning Materials.zip (source Groups G01–G14).
 * Does not write to the database. Does not treat Groups as Blocks.
 *
 *   node scripts/inventory-autocare-learning-materials-zip.mjs
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ZIP =
  process.env.AUTOCARE_LM_ZIP?.trim() ||
  "C:\\Users\\ReissChambers\\OneDrive - Doncaster GTA\\Desktop\\Autocare Learning Materials.zip";
const OUT_DIR = path.resolve(".tmp/source-pack-inventory");
const OUT = path.join(OUT_DIR, "zip-inventory.json");
const PS1 = path.join(OUT_DIR, "_inventory.ps1");

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (!fs.existsSync(ZIP)) die(`ZIP not found: ${ZIP}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const ps = `
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = $args[0]
$outPath = $args[1]
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
$sha = [System.Security.Cryptography.SHA256]::Create()
$files = New-Object System.Collections.Generic.List[object]
$dirs = New-Object "System.Collections.Generic.HashSet[string]"
try {
  foreach ($e in $zip.Entries) {
    $name = $e.FullName.Replace("\\","/")
    if ($name.EndsWith("/")) {
      [void]$dirs.Add($name.TrimEnd("/"))
      continue
    }
    $parent = [System.IO.Path]::GetDirectoryName($name)
    if ($parent) { [void]$dirs.Add($parent.Replace("\\","/")) }
    $stream = $e.Open()
    try {
      $sha.Initialize()
      $buf = New-Object byte[] 1048576
      while (($n = $stream.Read($buf, 0, $buf.Length)) -gt 0) {
        $sha.TransformBlock($buf, 0, $n, $null, 0) | Out-Null
      }
      $sha.TransformFinalBlock([byte[]]@(), 0, 0) | Out-Null
      $hash = ([System.BitConverter]::ToString($sha.Hash)).Replace("-","").ToLowerInvariant()
    } finally { $stream.Dispose() }
    $base = [System.IO.Path]::GetFileName($name)
    $ext = [System.IO.Path]::GetExtension($name).ToLowerInvariant()
    if (-not $ext) { $ext = "(none)" }
    $files.Add([pscustomobject]@{
      path = $name
      filename = $base
      ext = $ext
      size = [int64]$e.Length
      compressedSize = [int64]$e.CompressedLength
      sha256 = $hash
    })
  }
} finally { $zip.Dispose(); $sha.Dispose() }

$payload = [pscustomobject]@{
  zipPath = $zipPath
  zipBytes = (Get-Item -LiteralPath $zipPath).Length
  files = $files
  directories = @($dirs)
}
$json = $payload | ConvertTo-Json -Depth 6 -Compress
[System.IO.File]::WriteAllText($outPath, $json)
Write-Output ("COUNTED=" + $files.Count)
`;

fs.writeFileSync(PS1, ps, "utf8");
console.log("Hashing ZIP entries…");
const result = spawnSync(
  "powershell",
  ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS1, ZIP, OUT],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
if (result.status !== 0) {
  die(result.stderr || result.stdout || "PowerShell inventory failed");
}
process.stdout.write(result.stdout || "");

const raw = JSON.parse(fs.readFileSync(OUT, "utf8"));
const files = raw.files || [];
const GROUPS = [
  { code: "G01", folder: "G01 Foundation Skills" },
  { code: "G02", folder: "G02 Electric Hybrid Awareness" },
  { code: "G03", folder: "G03 Wheels and Tyres" },
  { code: "G04", folder: "G04 Basic Braking" },
  { code: "G05", folder: "G05 Basic Steering and Suspension" },
  { code: "G06", folder: "G06 Cooling, Lubrication and Filters" },
  { code: "G07", folder: "G07 Starting and Charging Systems" },
  { code: "G08", folder: "G08 Customer Service and Sales" },
  { code: "G09", folder: "G09 Stock (Now not needed)" },
  { code: "G10", folder: "G10 Advanced Braking" },
  { code: "G11", folder: "G11 Advance Steering and Suspension" },
  { code: "G12", folder: "G12 Exhaust and Emissions" },
  { code: "G13", folder: "G13 Air Conditioning" },
  { code: "G14", folder: "G14 Vehicle Inspection" },
];

function groupOf(p) {
  const n = String(p).replace(/\\/g, "/");
  for (const g of GROUPS) {
    if (n.toLowerCase().includes(g.folder.toLowerCase())) return g;
    const re = new RegExp(`(^|/)${g.code}(\\b|[\\s_\\-])`, "i");
    if (re.test(n)) return g;
  }
  return null;
}

const byExt = {};
const byGroup = Object.fromEntries(
  GROUPS.map((g) => [
    g.code,
    { ...g, fileCount: 0, bytes: 0, extensions: {}, files: [] },
  ]),
);
const ungrouped = [];
const nameMap = {};
const hashMap = {};
const fileParents = new Set();

for (const f of files) {
  const g = groupOf(f.path);
  f.sourceGroupCode = g?.code || null;
  f.sourceGroupFolder = g?.folder || null;
  byExt[f.ext] = (byExt[f.ext] || 0) + 1;
  const key = f.filename.toLowerCase();
  nameMap[key] = nameMap[key] || [];
  nameMap[key].push(f.path);
  hashMap[f.sha256] = hashMap[f.sha256] || [];
  hashMap[f.sha256].push(f.path);
  let p = path.posix.dirname(f.path.replace(/\\/g, "/"));
  while (p && p !== "." && p !== "/") {
    fileParents.add(p);
    p = path.posix.dirname(p);
  }
  if (g) {
    const row = byGroup[g.code];
    row.fileCount += 1;
    row.bytes += Number(f.size) || 0;
    row.extensions[f.ext] = (row.extensions[f.ext] || 0) + 1;
    row.files.push(f.path);
  } else {
    ungrouped.push(f.path);
  }
}

const dirs = (raw.directories || []).map((d) => String(d).replace(/\\/g, "/"));
const emptyDirectories = dirs.filter((d) => !fileParents.has(d) && !files.some((f) => f.path.replace(/\\/g, "/").startsWith(d + "/")));

const inventory = {
  zipPath: ZIP,
  zipBytes: raw.zipBytes,
  entryCount: files.length,
  directoryCount: dirs.length,
  emptyDirectories,
  extensionCounts: Object.fromEntries(
    Object.entries(byExt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  ),
  groups: GROUPS.map((g) => {
    const row = byGroup[g.code];
    return {
      code: g.code,
      folder: g.folder,
      empty: row.fileCount === 0,
      fileCount: row.fileCount,
      bytes: row.bytes,
      extensions: row.extensions,
    };
  }),
  ungroupedFileCount: ungrouped.length,
  ungroupedFiles: ungrouped,
  duplicateFilenames: Object.fromEntries(
    Object.entries(nameMap).filter(([, v]) => v.length > 1),
  ),
  duplicateBinaries: Object.fromEntries(
    Object.entries(hashMap).filter(([, v]) => v.length > 1),
  ),
  files,
};

fs.writeFileSync(OUT, JSON.stringify(inventory, null, 2));
console.log(
  JSON.stringify(
    {
      ok: true,
      entryCount: files.length,
      groups: inventory.groups.map((g) => ({
        code: g.code,
        folder: g.folder,
        empty: g.empty,
        fileCount: g.fileCount,
      })),
      extensionCounts: inventory.extensionCounts,
      duplicateFilenameCount: Object.keys(inventory.duplicateFilenames).length,
      duplicateBinaryCount: Object.keys(inventory.duplicateBinaries).length,
      emptyDirectories: inventory.emptyDirectories.slice(0, 40),
      out: OUT,
    },
    null,
    2,
  ),
);
