# Bellaquitas Fest / Cloudflare D1 — solo Windows, sin proveedor anterior.
# Modo -Check: validación offline, sin claves ni red, compatible con CI.
# Sin -Check: solicita token Cloudflare PRIVADO en consola y ejecuta una
# copia cifrada real de D1 staging, SHA, verificación y restauración LOCAL.
# No comparte claves, SQL, GPG ni datos de socios con GitHub/ChatGPT.
param([switch]$Check)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$base = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot "backup_d1_solo.py"

if (!(Test-Path -LiteralPath $script -PathType Leaf)) {
    throw "Falta backup_d1_solo.py en la misma carpeta."
}
function Run-Backup([string[]]$ArgsList) {
    & python $script @ArgsList
    if ($LASTEXITCODE -ne 0) {
        throw "Fallo de la herramienta de respaldo D1: $($ArgsList[0]). No se han migrado saldos."
    }
}

# Siempre comenzar sin tokens ni consultas reales.
Run-Backup @("--check")
Run-Backup @("--self-test")
if ($Check) {
    Write-Host "OK: comprobación offline con seis cuentas ficticias; no se ha exportado nada."
    exit 0
}
if ($env:CI -or $env:GITHUB_ACTIONS) {
    throw "Operación REAL bloqueada en sistemas de CI. Usar el ordenador privado del propietario."
}
if (!(Get-Command gpg -ErrorAction SilentlyContinue)) {
    throw "Instala GnuPG gratuito (gpg) antes de ejecutar la copia."
}
if (!(Get-Command wrangler -ErrorAction SilentlyContinue)) {
    throw "Instala Wrangler gratuito antes de ejecutar la copia."
}

Write-Host ""
Write-Host "BELLAQUITAS FEST — COPIA D1 CIFRADA Y RESTAURACIÓN LOCAL"
Write-Host "La base de destino es bellaquitas-staging. NO se modificarán puntos o visitas."
Write-Host "Necesitas una carpeta fuera de Git, OneDrive, Dropbox y Google Drive."
$rawFolder = Read-Host "Ruta ABSOLUTA de tu carpeta privada (p. ej. D:\RespaldoBellaquitas)"
if ([string]::IsNullOrWhiteSpace($rawFolder) -or ![System.IO.Path]::IsPathRooted($rawFolder)) {
    throw "Se requiere una ruta absoluta, local y privada."
}
$folder = [System.IO.Path]::GetFullPath($rawFolder)
$env:BELLAQUITAS_BACKUP_DIR = $folder

Write-Host "Introduce el token Cloudflare (NO se mostrará en pantalla, no lo envíes por chat)."
$secureToken = Read-Host "CLOUDFLARE_API_TOKEN" -AsSecureString
$buffer = [IntPtr]::Zero
try {
    $buffer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    $env:CLOUDFLARE_API_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($buffer)
} finally {
    if ($buffer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($buffer)
    }
    $secureToken.Dispose()
}
try {
    if ([string]::IsNullOrWhiteSpace($env:CLOUDFLARE_API_TOKEN)) {
        throw "Token vacío. No se puede exportar."
    }
    $preexisting = @{}
    if (Test-Path -LiteralPath $folder -PathType Container) {
        foreach ($x in Get-ChildItem -LiteralPath $folder -Filter "bellaquitas-d1-*.tar.gz.gpg" -File) {
            $preexisting[$x.FullName] = $true
        }
    }
    Write-Host ""
    Write-Host "Wrangler exportará D1, y GnuPG te pedirá una contraseña SOLO en tu equipo."
    Run-Backup @("--run")

    $created = @(Get-ChildItem -LiteralPath $folder -Filter "bellaquitas-d1-*.tar.gz.gpg" -File |
        Where-Object { -not $preexisting.ContainsKey($_.FullName) } |
        Sort-Object LastWriteTimeUtc -Descending)
    if ($created.Count -ne 1) {
        throw "No se encontró exactamente un nuevo archivo cifrado; NO continuar con migraciones."
    }
    $archive = $created[0].FullName

    Write-Host "Verificando archivo cifrado, perfiles y huellas SHA-256..."
    Run-Backup @("--verify", $archive)

    $newDb = Join-Path $folder ("bellaquitas-restauracion-" +
        ([DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ")) + ".sqlite")
    if (Test-Path -LiteralPath $newDb) {
        throw "El destino de restauración ya existe: operación cancelada."
    }
    Write-Host "Creando restauración SQLite LOCAL en un archivo nuevo..."
    Run-Backup @("--restore-local", $archive, $newDb)
    if (!(Test-Path -LiteralPath $newDb -PathType Leaf)) {
        throw "No existe la base restaurada. La operación no se ha completado."
    }
    Write-Host ""
    Write-Host "OK: exportación D1 REAL, copia GPG AES256 y restauración local verificadas."
    Write-Host "Guarda el .gpg en un SEGUNDO soporte privado y separado."
    Write-Host "Nunca subas .gpg, .sqlite, SQL, contraseña ni token a GitHub o un chat."
    Write-Host "NO se han ejecutado migraciones ni modificado datos de la base remota."
} finally {
    Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
    Remove-Item Env:BELLAQUITAS_BACKUP_DIR -ErrorAction SilentlyContinue
}
