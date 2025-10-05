@echo off
echo ========================================
echo NASA Ecuador - Setup Automatico
echo ========================================

echo.
echo Verificando Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python no encontrado
    echo.
    echo Por favor instala Python desde:
    echo https://www.python.org/downloads/
    echo.
    echo IMPORTANTE: Marca "Add Python to PATH" durante la instalacion
    echo.
    pause
    exit /b 1
)

echo Python encontrado!
echo.
echo Instalando dependencias...
pip install -r "requirements (1).txt"

if %errorlevel% neq 0 (
    echo ERROR: No se pudieron instalar las dependencias
    echo Verifica el archivo requirements.txt
    pause
    exit /b 1
)

echo.
echo ========================================
echo Listo para ejecutar!
echo ========================================
echo.
echo Para iniciar el dashboard:
echo   python hub_central.py
echo.
echo Para ver la portada:
echo   Abre index.html en tu navegador
echo.
echo URLs:
echo   Portada: file:///[ruta]/index.html
echo   Dashboard: http://localhost:7860
echo.
pause