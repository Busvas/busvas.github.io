@echo off
echo ========================================
echo NASA Ecuador - Instalador Automatico
echo ========================================
echo.

echo Verificando si Python esta instalado...
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Python ya esta instalado!
    python --version
    echo.
    echo Instalando dependencias del proyecto...
    pip install -r "requirements (1).txt"
    echo.
    echo ¡Listo! Ahora puedes ejecutar:
    echo   python hub_central.py
    echo.
    pause
    exit /b 0
)

echo.
echo ❌ Python no detectado en el sistema
echo.
echo ========================================
echo INSTALACION AUTOMATICA DE PYTHON
echo ========================================
echo.
echo Este script descargara e instalara Python automaticamente.
echo.
set /p respuesta="¿Continuar con la instalacion? (s/n): "
if /i "%respuesta%" neq "s" (
    echo Instalacion cancelada.
    pause
    exit /b 1
)

echo.
echo Descargando Python 3.11...
echo.

REM Crear directorio temporal
if not exist temp mkdir temp
cd temp

REM Descargar Python 3.11 (64-bit)
echo Descargando instalador de Python...
powershell -Command "& {Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.6/python-3.11.6-amd64.exe' -OutFile 'python-installer.exe'}"

if not exist "python-installer.exe" (
    echo ERROR: No se pudo descargar el instalador de Python
    echo.
    echo Por favor descarga manualmente desde:
    echo https://python.org/downloads/
    echo.
    pause
    cd ..
    exit /b 1
)

echo.
echo Instalando Python...
echo ⚠️  IMPORTANTE: Se marcara automaticamente "Add Python to PATH"
echo.

REM Instalar Python con PATH automatico
python-installer.exe /quiet InstallAllUsers=0 PrependPath=1 Include_test=0

echo.
echo Esperando a que termine la instalacion...
timeout /t 30 /nobreak >nul

echo.
echo Verificando instalacion...
cd ..

REM Refrescar variables de entorno
call refreshenv >nul 2>&1

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ⚠️  La instalacion puede haberse completado pero necesitas:
    echo 1. Reiniciar esta ventana de comandos
    echo 2. O reiniciar el PC
    echo.
    echo Luego ejecuta este archivo nuevamente para instalar las dependencias.
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ ¡Python instalado correctamente!
python --version
echo.

echo Instalando dependencias del proyecto...
pip install -r "requirements (1).txt"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo 🎉 ¡INSTALACION COMPLETADA!
    echo ========================================
    echo.
    echo Para iniciar el dashboard:
    echo   1. Ejecuta: python hub_central.py
    echo   2. O haz doble clic en: start_dashboard.bat
    echo.
    echo URLs:
    echo   - Portada: index.html
    echo   - Dashboard: http://localhost:7860
    echo.
) else (
    echo.
    echo ⚠️  Hubo un problema instalando las dependencias.
    echo Intenta ejecutar manualmente:
    echo   pip install -r "requirements (1).txt"
    echo.
)

REM Limpiar archivos temporales
if exist temp (
    echo Limpiando archivos temporales...
    rmdir /s /q temp
)

echo.
pause