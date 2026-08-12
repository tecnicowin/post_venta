@echo off
chcp 65001 >nul
title Empaquetando Punto de Venta...

echo ========================================
echo   Empaquetando Punto de Venta v1.0.0
echo ========================================
echo.

cd /d "%~dp0electron"

echo [1/3] Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Fallo al instalar dependencias
    pause
    exit /b 1
)

echo.
echo [2/3] Empaquetando aplicacion...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Fallo al empaquetar
    pause
    exit /b 1
)

echo.
echo [3/3] Limpiando archivos temporales...
rmdir /s /q node_modules 2>nul
rmdir /s /q .cache 2>nul

echo.
echo ========================================
echo   BUILD COMPLETADO
echo ========================================
echo.
echo   Archivo: build\PuntoDeVenta.exe
echo   Listo para copiar a USB
echo.

if exist "..\build\PuntoDeVenta.exe" (
    echo Abrir carpeta de salida? (S/N)
    choice /c SN /n /m "> "
    if errorlevel 2 goto :end
    explorer "..\build"
)

:end
pause
