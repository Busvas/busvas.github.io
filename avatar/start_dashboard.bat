@echo off
echo ========================================
echo NASA Ecuador - Iniciando Dashboard
echo ========================================

echo.
echo Verificando Python...

REM Primero intentar python desde PATH
python --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=python
    goto :python_found
)

REM Intentar con py
py --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=py
    goto :python_found
)

REM Buscar Python en ubicaciones comunes del usuario
set PYTHON_PATH=%LOCALAPPDATA%\Programs\Python\Python313\python.exe
if exist "%PYTHON_PATH%" (
    set PYTHON_CMD="%PYTHON_PATH%"
    goto :python_found
)

set PYTHON_PATH=%LOCALAPPDATA%\Programs\Python\Python312\python.exe
if exist "%PYTHON_PATH%" (
    set PYTHON_CMD="%PYTHON_PATH%"
    goto :python_found
)

set PYTHON_PATH=%LOCALAPPDATA%\Programs\Python\Python311\python.exe
if exist "%PYTHON_PATH%" (
    set PYTHON_CMD="%PYTHON_PATH%"
    goto :python_found
)

echo.
echo ==========================================
echo ERROR: Python no encontrado en el sistema
echo ==========================================
echo.
echo Python parece estar instalado pero no configurado correctamente.
echo.
echo SOLUCION RAPIDA:
echo 1. Reinstala Python desde: https://python.org/downloads/
echo 2. Durante la instalacion, marca "Add Python to PATH"
echo 3. Reinicia el PC
echo 4. Ejecuta este archivo nuevamente
echo.
pause
exit /b 1

:python_found
echo Python encontrado: %PYTHON_CMD%
%PYTHON_CMD% --version

echo.
echo Verificando dependencias...
%PYTHON_CMD% -c "import dash" >nul 2>&1
if %errorlevel% neq 0 (
    echo Instalando dependencias...
    %PYTHON_CMD% -m pip install -r "requirements (1).txt"
)

echo.
echo ========================================
echo Iniciando Dashboard NASA Ecuador...
echo ========================================
echo.
echo Dashboard disponible en: http://localhost:7860
echo.
echo Presiona Ctrl+C para detener el servidor
echo.

%PYTHON_CMD% hub_central.py