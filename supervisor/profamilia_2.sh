#!/bin/bash

# Definir la ruta del proyecto donde está el entorno virtual y el script Python
PATHPY="/home/devbots/profamilia/botCargar"

# Activar el entorno virtual
source "$PATHPY/venv/bin/activate"

# Ejecutar el script Python
python "$PATHPY/main.py"

# Desactivar el entorno virtual
deactivate
