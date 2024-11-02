#!/bin/bash

# Verificar si se ha pasado un parámetro
if [ -z "$1" ]; then
  # Si el parámetro es vacío
  echo "nada"
  pm2 stop all
else
  # Si el parámetro no es vacío
  echo "todo"
  if pm2 list | grep -q "online"; then
    pm2 stop all && pm2 start /home/devbots/supervisor/ecosystem.config.js --only $1
  else
    pm2 start /home/devbots/supervisor/ecosystem.config.js --only $1
  fi  
fi