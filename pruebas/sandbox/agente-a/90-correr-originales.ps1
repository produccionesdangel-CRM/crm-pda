/* 90-correr-originales.ps1 — corre mis 10 familias ORIGINALES contra el sello .25,
   guardando en resultados-p2-originales/ para no pisar las corridas del equipo azul. */
$env:AGENTE_A_RESULTADOS = 'resultados-p2-originales'
$base = 'C:\Users\noman\Documents\deepseek-harness\crm-pda'
Set-Location $base
$familias = @('02-fechas','03-telefonos','04-tareas','05-prospectos','06-clientes','07-contratos','08-pagos','09-campanias','10-concurrencia','11-integridad')
foreach ($f in $familias) {
  Write-Host "########## $f ##########"
  node "pruebas\sandbox\agente-a\$f.mjs" 2>&1 | Select-Object -Last 40
}
Write-Host "########## FIN ##########"
