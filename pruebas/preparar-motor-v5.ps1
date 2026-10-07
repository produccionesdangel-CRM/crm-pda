$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\noman\Documents\deepseek-harness\crm-pda'
$lite = 'C:\Users\noman\Documents\CRM Lite Campanas'
$enc  = New-Object System.Text.UTF8Encoding($false)

# ═══════════ 1) Extraer el motor de campanas (Util + Catalogos + motor) del CRM
$html = [System.IO.File]::ReadAllText("$repo\index.html")
$marca = '/* @JS-CAMPANIAS-MOTOR v5.0'
$i = $html.IndexOf($marca)
if ($i -lt 0) { throw 'no encontre el bloque del motor en index.html' }
# El motor termina justo antes del adaptador (que solo existe dentro del CRM).
$fin = $html.IndexOf('/* ─────── Adaptador:', $i)
if ($fin -lt 0) { throw 'no encontre el inicio del adaptador' }
$bloque = $html.Substring($i, $fin - $i).TrimEnd()
if (-not $bloque.EndsWith('})(typeof globalThis !== ''undefined'' ? globalThis : this);')) { throw 'el bloque no cierra como se espera' }
"motor extraido: {0} lineas, {1:N0} caracteres" -f (($bloque -split "`n").Count), $bloque.Length
foreach ($nec in 'var Util = {', 'var Catalogos = {', 'raiz.crearMotor = crearMotor;') {
    if (-not $bloque.Contains($nec)) { throw "el bloque extraido no trae: $nec" }
}
if ($bloque.Contains('almacenCampanias')) { throw 'el bloque trae el adaptador del CRM (no debe)' }

# Encabezado: en el CRM, el nombre del usuario en el rastro de auditoria lo da esta funcion.
$cabeza = @'
/* Generado por pruebas\preparar-motor-v5.ps1 — NO EDITAR A MANO.
   Es el motor de campanas TAL COMO quedo dentro del CRM v5.0: sirve para correrle
   las 224 pruebas originales del CRM Lite y comprobar que el port no cambio nada. */
'use strict';
// En la lite el rastro decia siempre 'Sesion de prueba'; en el CRM lo pone la sesion real.
// Aqui se devuelve el mismo texto de antes para poder comparar contra las pruebas originales.
if (typeof globalThis.usuarioDeSesion !== 'function') {
    globalThis.usuarioDeSesion = function () { return 'Sesión de prueba'; };
}
'@.Replace("`r`n", "`n")
[System.IO.File]::WriteAllText("$repo\pruebas\.motor-v5.js", $cabeza + "`n" + $bloque + "`n", $enc)

# ═══════════ 2) Armar la carpeta que imita a la lite (mismos nombres de archivo)
$shim = "$repo\pruebas\lite-shim"
New-Item -ItemType Directory -Force -Path "$shim\src\js", "$shim\pruebas" | Out-Null
$rutalite = $lite.Replace('\', '\\')
[System.IO.File]::WriteAllText("$shim\src\js\10-datos.js", @"
/* Imita a la lite: carga su 10-datos.js de verdad (Util, Catalogos, SemillaDemo y crearAlmacen).
   Ese archivo es el que arma los datos de prueba y el almacen que el motor espera. */
require('$rutalite\\src\\js\\10-datos.js');
"@.Replace("`r`n", "`n"), $enc)
[System.IO.File]::WriteAllText("$shim\src\js\20-motor.js", @'
/* Aquí está el punto de la prueba: en vez del motor de la lite, se carga
   EL MOTOR QUE QUEDÓ DENTRO DEL CRM v5.0. Todo lo demás es idéntico. */
require('../../../.motor-v5.js');
'@.Replace("`r`n", "`n"), $enc)
Copy-Item "$lite\pruebas\motor.pruebas.js" "$shim\pruebas\motor.pruebas.js" -Force
"carpeta armada: " + $shim

# ═══════════ 3) Correr las 224 pruebas originales contra el motor del CRM
Set-Location $repo
"`n================= 224 PRUEBAS DE LA LITE CONTRA EL MOTOR DE LA v5.0 ================="
$salida = & 'C:\Program Files\nodejs\node.exe' "$shim\pruebas\motor.pruebas.js" 2>&1
$codigo = $LASTEXITCODE
$salida | Select-Object -Last 8 | ForEach-Object { "  " + $_ }
"`n  fallas encontradas: " + (($salida | Select-String -Pattern 'FAIL' | Measure-Object).Count)
if (($salida | Select-String -Pattern 'FAIL').Count -gt 0) {
    "`n  --- detalle de las fallas ---"
    $salida | Select-String -Pattern 'FAIL' | Select-Object -First 10 | ForEach-Object { "  " + $_.Line.Trim() }
}
"  codigo de salida: $codigo"