#!/bin/bash
# ==============================================================================
# SCRIPT DE INICIO RÁPIDO PARA EL ERP / POS LOCAL
# ==============================================================================

# Detener la ejecución en caso de error
set -e

echo "======================================================================"
echo "          INICIALIZANDO SISTEMA ERP / POS LOCAL (EG)"
echo "======================================================================"

# 1. Crear entorno virtual si no existe
if [ ! -d "venv" ]; then
    echo "[1/4] Creando entorno virtual de Python (venv)..."
    python3 -m venv venv
else
    echo "[1/4] Entorno virtual 'venv' detectado."
fi

# 2. Activar entorno virtual
echo "[2/4] Activando entorno virtual..."
source venv/bin/activate || true

# 3. Instalar dependencias
echo "[3/4] Instalando dependencias de Python..."
venv/bin/pip install --upgrade pip
venv/bin/pip install -r server/requirements.txt

# 4. Inicializar base de datos SQLite y poblar semillas
echo "[4/4] Inicializando base de datos SQLite y semillas..."
venv/bin/python3 database/db_manager.py

echo "======================================================================"
echo "¡SISTEMA LISTO!"
echo "Levantando servidor local en http://127.0.0.1:5000"
echo "Para detener el servidor, presione Ctrl+C"
echo "======================================================================"

# Abrir el navegador por defecto (compatible con macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    sleep 1 && open -a "Google Chrome" "http://127.0.0.1:5000" &
fi

# 5. Ejecutar la aplicación
venv/bin/python3 server/app.py
