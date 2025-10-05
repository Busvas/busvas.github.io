# 🚀 NASA Ecuador - Dashboard - Guía Rápida

## ⚠️ PROBLEMA COMÚN: "La página no se carga"

### 🔍 DIAGNÓSTICO:
- ✅ Los botones funcionan (muestran pantalla de carga)
- ❌ El dashboard no se abre o muestra error de conexión
- **CAUSA:** El servidor Python no está ejecutándose

### ✅ SOLUCIÓN PASO A PASO:

#### 🐍 PASO 1: Verificar Python
```bash
python --version
```
**¿No funciona?** ➜ Instala Python desde https://python.org/downloads/
**IMPORTANTE:** ✅ Marca "Add Python to PATH" durante la instalación

#### 🚀 PASO 2: Iniciar el servidor
```bash
# Opción 1: Archivo por lotes (MÁS FÁCIL)
start_dashboard.bat

# Opción 2: Comando directo
python hub_central.py
```

3. **Verás algo como esto:**
```
Dash is running on http://127.0.0.1:7860/
```

4. **Ahora regresa a index.html y haz clic en cualquier botón** 
   - Los indicadores cambiarán de 🔴 Offline a 🟢 Online
   - Los dashboards se abrirán correctamente

---

## 🔧 Si tienes problemas con Python

### Instalar dependencias:
```bash
pip install -r "requirements (1).txt"
```

### Si no tienes Python:
1. Descarga desde: https://python.org/downloads/
2. ✅ IMPORTANTE: Marca "Add Python to PATH"
3. Reinicia el terminal

---

## 🐳 Alternativa con Docker

```bash
docker build -t nasa-ecuador .
docker run -p 7860:7860 nasa-ecuador
```

---

## 📋 ¿Cómo funciona?

1. **index.html** = Portada bonita con modelo 3D de la Tierra
2. **hub_central.py** = Servidor Python con los dashboards
3. **Los botones** = Conectan la portada con el servidor

### URLs importantes:
- 🌍 Portada: `file://[esta-carpeta]/index.html`
- 📊 Dashboard: `http://localhost:7860`

---

## ✨ Características de los dashboards:

- 🔥 **Incendios**: Datos MODIS de hotspots en Ecuador
- 💧 **Precipitación**: Datos GPM de lluvia satelital  
- 🌱 **Suelo & Clima**: Variables GLDAS ambientales

---

¡Listo! Una vez que el servidor Python esté corriendo, todo funcionará perfectamente. 🎯