# Server lokal Rumah Mungil versi PowerShell (bawaan Windows, tanpa Python).
# Dipakai otomatis oleh jalankan.bat kalau Python tidak ada.
param([int]$Port = 8000)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$groups = 'walls','windows','doors','roofs','lamps','foliage','trunks','extras','aksesoris_pintu','aksesoris_jendela','ruko','papan','papan_menyala','vandal','hiasan'

function Write-Manifest {
  $parts = foreach ($g in $groups) {
    $dir = Join-Path $root "assets\$g"
    $files = @()
    if (Test-Path $dir) {
      $files = @(Get-ChildItem -Path $dir -File |
        Where-Object { $_.Extension -match '^\.(png|webp)$' -and $_.BaseName -notmatch '_malam$' } |
        Sort-Object Name |
        ForEach-Object { "  `"assets/$g/$($_.Name)`"" })
    }
    " `"$g`": [`n" + ($files -join ",`n") + "`n ]"
  }
  $text = "// Dibuat otomatis oleh tools/server.ps1. Jangan diedit.`nwindow.ASSET_MANIFEST = {`n" + ($parts -join ",`n") + "`n};`n"
  [IO.File]::WriteAllText((Join-Path $root 'assets\manifest.js'), $text, (New-Object Text.UTF8Encoding $false))
  return $text
}

$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.png' = 'image/png'; '.webp' = 'image/webp'
  '.json' = 'application/json'; '.txt' = 'text/plain; charset=utf-8'; '.svg' = 'image/svg+xml'
}

$null = Write-Manifest
$listener = $null
foreach ($p in $Port..($Port + 19)) {
  $l = New-Object System.Net.HttpListener
  $l.Prefixes.Add("http://localhost:$p/")
  try { $l.Start(); $listener = $l; $Port = $p; break }
  catch { Write-Host "Port $p sedang dipakai, mencoba port berikutnya..."; $l.Close() }
}
if (-not $listener) { throw 'Tidak ada port kosong. Tutup jendela server lama, lalu coba lagi.' }

Write-Host "Rumah Mungil jalan di http://localhost:$Port  (tutup jendela ini untuk berhenti)"
Start-Process "http://localhost:$Port"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $res = $ctx.Response
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '') { $rel = 'index.html' }
    $res.Headers.Add('Cache-Control', 'no-store')
    if ($rel -eq 'assets/manifest.js') {
      $bytes = [Text.Encoding]::UTF8.GetBytes((Write-Manifest)); $type = $mime['.js']
    } else {
      $full = [IO.Path]::GetFullPath((Join-Path $root ($rel -replace '/', '\')))
      if ((-not $full.StartsWith($root)) -or (-not (Test-Path $full -PathType Leaf))) {
        $res.StatusCode = 404; $bytes = [byte[]]@(); $type = 'text/plain'
      } else {
        $bytes = [IO.File]::ReadAllBytes($full)
        $ext = [IO.Path]::GetExtension($full).ToLower()
        $type = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      }
    }
    $res.ContentType = $type
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch { }
  finally { $ctx.Response.Close() }
}
