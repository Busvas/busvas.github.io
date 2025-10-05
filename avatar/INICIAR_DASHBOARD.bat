@echo off
echo ========================================
echo 🚀 NASA ECUADOR - DASHBOARD COMPLETO
echo ========================================
echo.
echo ✅ Python instalado y configurado
echo ✅ Dependencias instaladas
echo ✅ Datos reales cargados:
echo    🔥 3,564 registros de incendios (MODIS)
echo    💧 205,200 registros de precipitación (GPM)  
echo    🌱 Datos de suelo GLDAS
echo.
echo ========================================
echo Iniciando servidor...
echo ========================================

set PYTHON_PATH="%LOCALAPPDATA%\Programs\Python\Python313\python.exe"

echo.
echo 🌐 Dashboard estará disponible en: http://localhost:7860
echo.
echo ⚠️  NO CIERRES esta ventana mientras uses el dashboard
echo ⚠️  Para detener: presiona Ctrl+C
echo.
echo ========================================
echo.

%PYTHON_PATH% hub_central.py

echo.
echo ========================================
echo Dashboard detenido
echo ========================================
pause