#!/bin/bash
# ==============================================================================
# Script de inicio para backend Flask en ambiente de producción con Gunicorn
# ==============================================================================

# Obtener ruta absoluta de la carpeta del proyecto
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( dirname "$DIR" )"

echo "Iniciando servidor de producción backend ERP..."
cd "$PROJECT_DIR"

# Activar entorno virtual
if [ -d "venv" ]; then
    echo "Activando entorno virtual venv..."
    source venv/bin/activate
else
    echo "ERROR: Entorno virtual 'venv' no encontrado. Por favor corre run.sh primero."
    exit 1
fi

# Instalar dependencias si falta alguna (incluyendo gunicorn)
pip install -r server/requirements.txt

# Iniciar Gunicorn en puerto 5000 con 4 workers (ajusta según el número de núcleos de CPU)
# Nota: La base de datos SQLite puede bloquearse si hay escrituras altamente concurrentes,
# por lo que --threads y --workers se configuran de forma equilibrada.
echo "Levantando Gunicorn en http://127.0.0.1:5000 ..."
gunicorn --workers 2 --threads 4 --bind 127.0.0.1:5000 server.app:app
