#!/bin/bash
# Crear un directorio temporal personalizado en /tmp basado en "$@"
TEMP_DIR="/tmp/$@"
mkdir -p "$TEMP_DIR"
# Ejecutar xvfb-run con un directorio temporal específico
TMPDIR="$TEMP_DIR" xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" node /home/devbots/sura/sura.js "$@"