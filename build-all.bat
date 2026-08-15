@echo off
chcp 65001 >nul
title Construyendo Apps Portables...

echo ==========================================
echo   CONSTRUYENDO APPS PORTABLES
echo   Punto de Venta + Generador Licencias + Instalador
echo ==========================================
echo.

:: ============================================
:: 1. BUILD PUNTO DE VENTA
:: ============================================
echo [1/5] Instalando dependencias POS...
cd /d "%~dp0electron"
call npm install --production=false
if %errorlevel% neq 0 (
    echo ERROR: Fallo al instalar dependencias POS
    pause
    exit /b 1
)

echo.
echo [2/5] Empaquetando Punto de Venta...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Fallo al empaquetar POS
    pause
    exit /b 1
)

echo.
echo [2b/5] Limpiando node_modules POS...
rmdir /s /q node_modules 2>nul
rmdir /s /q .cache 2>nul

:: ============================================
:: 2. BUILD GENERADOR DE LICENCIAS
:: ============================================
echo.
echo [3/5] Instalando dependencias Generador...
cd /d "%~dp0tools\licensing-electron"
call npm install --production=false
if %errorlevel% neq 0 (
    echo ERROR: Fallo al instalar dependencias Generador
    pause
    exit /b 1
)

echo.
echo [3b/5] Empaquetando Generador de Licencias...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Fallo al empaquetar Generador
    pause
    exit /b 1
)

echo.
echo [3c/5] Limpiando node_modules Generador...
rmdir /s /q node_modules 2>nul
rmdir /s /q .cache 2>nul

:: ============================================
:: 3. BUILD INSTALADOR
:: ============================================
echo.
echo [4/5] Instalando dependencias Instalador...
cd /d "%~dp0tools\installer"
call npm install --production=false
if %errorlevel% neq 0 (
    echo ERROR: Fallo al instalar dependencias Instalador
    pause
    exit /b 1
)

echo.
echo [4b/5] Empaquetando Instalador...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Fallo al empaquetar Instalador
    pause
    exit /b 1
)

echo.
echo [4c/5] Limpiando node_modules Instalador...
rmdir /s /q node_modules 2>nul
rmdir /s /q .cache 2>nul

:: ============================================
:: 4. COMPRIMIR PARA COMPARTIR
:: ============================================
echo.
echo [5/5] Comprimiendo archivos para compartir...

cd /d "%~dp0"

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

:: Comprimir Instalador
if exist "tools\installer\build\Instalar Punto de Venta-win32-x64\Instalar Punto de Venta.exe" (
    echo   Comprimiendo Instalador...
    powershell -Command "Compress-Archive -Path 'tools\installer\build\Instalar Punto de Venta-win32-x64\Instalar Punto de Venta.exe' -DestinationPath 'dist\Instalador.zip' -CompressionLevel Optimal -Force"
    echo   OK: dist\Instalador.zip
)

:: ============================================
:: 5. RESUMEN
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
if exist "tools\installer\build\Instalar Punto de Venta-win32-x64\Instalar Punto de Venta.exe" (
    for %%A in (tools\installer\build\Instalar Punto de Venta-win32-x64\Instalar Punto de Venta.exe) do echo   INST:    %%~zA bytes
)
if exist "dist\Instalador.zip" (
    for %%A in (dist\Instalador.zip) do echo   INST ZIP:%%~zA bytes
)

echo.
echo   Ejecutables:
echo     build\PuntoDeVenta.exe
echo     tools\build-licenses\GeneradorLicencias.exe
echo     tools\installer\build\Instalar Punto de Venta-win32-x64\Instalar Punto de Venta.exe
echo.
echo   Para compartir (comprimidos):
echo     dist\PuntoDeVenta.zip
echo     dist\GeneradorLicencias.zip
echo     dist\Instalador.zip
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
