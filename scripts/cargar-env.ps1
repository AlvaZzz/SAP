# ─────────────────────────────────────────────────────────────────────────────
# Carga un archivo .env en la sesión ACTUAL de PowerShell.
#
#   . .\scripts\cargar-env.ps1 .env.neon
#     ↑ el punto y el espacio del principio son OBLIGATORIOS: hacen que el
#       script se ejecute EN esta sesión ("dot-sourcing"). Sin ellos corre en
#       una sesión hija y las variables se pierden al terminar.
#
# Por qué existe: en PowerShell 5.1 no hay prefijo `VAR=valor comando` como en
# bash, ni funciona `&&`. Repetir a mano un `$env:X = '...'` por cada variable
# y por cada comando es justo donde se cuela el error de apuntar una migración
# a la base equivocada.
#
# Al terminar imprime a qué HOST apunta DATABASE_URL, sin revelar la contraseña:
# es la última oportunidad de darse cuenta antes de escribir en producción.
# ─────────────────────────────────────────────────────────────────────────────
param(
  [Parameter(Mandatory = $true)]
  [string]$Archivo
)

$ruta = Join-Path (Get-Location) $Archivo
if (-not (Test-Path $ruta)) {
  Write-Host "✖ No existe $ruta" -ForegroundColor Red
  Write-Host "  Créalo primero (ver docs/DESPLIEGUE.md §10)."
  return
}

$cargadas = 0
foreach ($linea in Get-Content $ruta) {
  $t = $linea.Trim()
  if ($t -eq '' -or $t.StartsWith('#')) { continue }
  $i = $t.IndexOf('=')
  if ($i -lt 1) { continue }
  $nombre = $t.Substring(0, $i).Trim()
  $valor = $t.Substring($i + 1).Trim().Trim('"').Trim("'")
  if ($valor -eq '') { continue }
  Set-Item -Path "Env:$nombre" -Value $valor
  $cargadas++
}

Write-Host "✔ $cargadas variable(s) cargadas desde $Archivo" -ForegroundColor Green

if ($env:DATABASE_URL) {
  try {
    $u = [System.Uri]$env:DATABASE_URL
    $esNeon = $u.Host -like '*neon.tech*'
    $color = if ($esNeon) { 'Yellow' } else { 'Cyan' }
    $etiqueta = if ($esNeon) { 'PRODUCCIÓN (Neon)' } else { 'local' }
    Write-Host ""
    Write-Host "  APUNTAS A: $etiqueta" -ForegroundColor $color
    Write-Host "  host: $($u.Host)"
    Write-Host "  base: $($u.AbsolutePath.TrimStart('/'))"
    if ($esNeon) {
      Write-Host ""
      Write-Host "  Los scripts de datos son SIMULACIÓN por defecto." -ForegroundColor Yellow
      Write-Host "  Solo escriben si añades --aplicar." -ForegroundColor Yellow
    }
  } catch {
    Write-Host "  (no se pudo interpretar DATABASE_URL como URL)" -ForegroundColor Yellow
  }
}
