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
call npm install electron-packager@17 electron@33 --save-dev 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Fallo al instalar dependencias POS
    pause
    exit /b 1
)

echo.
echo [2/5] Empaquetando Punto de Venta...
npx electron-packager . PuntoDeVenta --platform=win32 --arch=x64 --out=../build --overwrite --ignore="node_modules" --ignore=".git" --asar
if %errorlevel% neq 0 (
    echo ERROR: Fallo al empaquetar POS
    pause
    exit /b 1
)

:: ============================================
:: 2. BUILD GENERADOR DE LICENCIAS
:: ============================================
echo.
echo [3/5] Instalando dependencias Generador...
cd /d "%~dp0tools\licensing-electron"
call npm install electron-packager@17 electron@33 --save-dev 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Fallo al instalar dependencias Generador
    pause
    exit /b 1
)

echo.
echo [3b/5] Empaquetando Generador de Licencias...
npx electron-packager . GeneradorLicencias --platform=win32 --arch=x64 --out=../build-licenses --overwrite --ignore="node_modules" --ignore=".git" --asar
if %errorlevel% neq 0 (
    echo   Nota: Si esta bloqueado, usando directorio alternativo...
    npx electron-packager . GeneradorLicencias --platform=win32 --arch=x64 --out=../build-licenses-v2 --overwrite --ignore="node_modules" --ignore=".git" --asar
)

:: ============================================
:: 3. BUILD INSTALADOR
:: ============================================
echo.
echo [4/5] Instalando dependencias Instalador...
cd /d "%~dp0tools\installer"
call npm install electron-packager@17 electron@33 --save-dev 2>nul
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

:: ============================================
:: 4. RESUMEN
:: ============================================
echo.
echo ==========================================
echo   BUILD COMPLETADO
echo ==========================================
echo.

cd /d "%~dp0"

if exist "build\PuntoDeVenta-win32-x64\PuntoDeVenta.exe" (
    echo   [OK] POS:     build\PuntoDeVenta-win32-x64\PuntoDeVenta.exe
) else (
    echo   [FALLO] POS no encontrado
)

if exist "tools\build-licenses\GeneradorLicencias-win32-x64\GeneradorLicencias.exe" (
    echo   [OK] LIC:     tools\build-licenses\GeneradorLicencias-win32-x64\GeneradorLicencias.exe
) else if exist "tools\build-licenses-v2\GeneradorLicencias-win32-x64\GeneradorLicencias.exe" (
    echo   [OK] LIC:     tools\build-licenses-v2\GeneradorLicencias-win32-x64\GeneradorLicencias.exe
) else (
    echo   [FALLO] Generador no encontrado
)

if exist "tools\installer\build\Instalar Punto de Venta-win32-x64\Instalar Punto de Venta.exe" (
    echo   [OK] INST:    tools\installer\build\Instalar Punto de Venta-win32-x64\Instalar Punto de Venta.exe
) else (
    echo   [FALLO] Instalador no encontrado
)

echo.
echo   Para usar:
echo     1. Copiar la carpeta PuntoDeVenta-win32-x64 al equipo del cliente
echo     2. Ejecutar PuntoDeVenta.exe directamente
echo     3. O usar el Instalador para copiar automaticamente
echo.
pause
