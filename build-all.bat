@echo off
chcp 65001 >nul
title Construyendo Apps Portables...

echo ==========================================
echo   CONSTRUYENDO APPS PORTABLES
echo   Punto de Venta + Generador Licencias
echo ==========================================
echo.

:: ============================================
:: 1. BUILD PUNTO DE VENTA
:: ============================================
echo [1/4] Instalando dependencias POS...
cd /d "%~dp0electron"
call npm install --production=false
if %errorlevel% neq 0 (
    echo ERROR: Fallo al instalar dependencias POS
    pause
    exit /b 1
)

echo.
echo [2/4] Empaquetando Punto de Venta...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Fallo al empaquetar POS
    pause
    exit /b 1
)

echo.
echo [2b/4] Limpiando node_modules POS...
rmdir /s /q node_modules 2>nul
rmdir /s /q .cache 2>nul

:: ============================================
:: 2. BUILD GENERADOR DE LICENCIAS
:: ============================================
echo.
echo [3/4] Instalando dependencias Generador...
cd /d "%~dp0tools\licensing-electron"
call npm install --production=false
if %errorlevel% neq 0 (
    echo ERROR: Fallo al instalar dependencias Generador
    pause
    exit /b 1
)

echo.
echo [3b/4] Empaquetando Generador de Licencias...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Fallo al empaquetar Generador
    pause
    exit /b 1
)

echo.
echo [3c/4] Limpiando node_modules Generador...
rmdir /s /q node_modules 2>nul
rmdir /s /q .cache 2>nul

:: ============================================
:: 3. COMPRIMIR PARA COMPARTIR
:: ============================================
echo.
echo [4/4] Comprimiendo archivos para compartir...

cd /d "%~dp0"

:: Crear carpeta de distribución
if not exist "dist" mkdir dist

:: Comprimir POS
if exist "build\PuntoDeVenta.exe" (
    echo   Comprimiendo PuntoDeVenta.exe...
    powershell -Command "Compress-Archive -Path 'build\PuntoDeVenta.exe' -DestinationPath 'dist\PuntoDeVenta.zip' -CompressionLevel Optimal -Force"
    echo   OK: dist\PuntoDeVenta.zip
)

:: Comprimir Generador
if exist "tools\build-licenses\GeneradorLicencias.exe" (
    echo   Comprimiendo GeneradorLicencias.exe...
    powershell -Command "Compress-Archive -Path 'tools\build-licenses\GeneradorLicencias.exe' -DestinationPath 'dist\GeneradorLicencias.zip' -CompressionLevel Optimal -Force"
    echo   OK: dist\GeneradorLicencias.zip
)

:: ============================================
:: 4. RESUMEN
:: ============================================
echo.
echo ==========================================
echo   BUILD COMPLETADO
echo ==========================================
echo.

if exist "build\PuntoDeVenta.exe" (
    for %%A in (build\PuntoDeVenta.exe) do echo   POS:     %%~zA bytes
)
if exist "dist\PuntoDeVenta.zip" (
    for %%A in (dist\PuntoDeVenta.zip) do echo   POS ZIP: %%~zA bytes
)
if exist "tools\build-licenses\GeneradorLicencias.exe" (
    for %%A in (tools\build-licenses\GeneradorLicencias.exe) do echo   LIC:     %%~zA bytes
)
if exist "dist\GeneradorLicencias.zip" (
    for %%A in (dist\GeneradorLicencias.zip) do echo   LIC ZIP: %%~zA bytes
)

echo.
echo   Ejecutables:
echo     build\PuntoDeVenta.exe
echo     tools\build-licenses\GeneradorLicencias.exe
echo.
echo   Para compartir (comprimidos):
echo     dist\PuntoDeVenta.zip
echo     dist\GeneradorLicencias.zip
echo.
echo   Copia los .zip para enviar por correo/WhatsApp
echo.

if exist "dist" (
    echo Abrir carpeta dist? (S/N)
    choice /c SN /n /m "> "
    if errorlevel 2 goto :end
    explorer "dist"
)

:end
pause
