@echo off
chcp 65001 >nul
rem ===========================================================================
rem  motor-v5.cmd
rem  Corre las 224 pruebas del motor del CRM Lite CONTRA el motor que quedo
rem  dentro del CRM v5.0. Si todo sale en verde, el port no cambio nada.
rem
rem  Para REGENERAR la copia del motor (si se toca index.html):
rem      powershell -NoProfile -ExecutionPolicy Bypass -File preparar-motor-v5.ps1
rem  (ese script necesita la carpeta del CRM Lite en Documentos)
rem ===========================================================================
setlocal
set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not defined NODE_EXE (
  echo No encontre Node.js en esta PC.
  pause
  exit /b 1
)
echo.
"%NODE_EXE%" "%~dp0lite-shim\pruebas\motor.pruebas.js"
echo.
pause
endlocal