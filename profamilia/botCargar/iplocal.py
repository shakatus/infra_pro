import os
import socket

def get_ip(red, bot, id):
    interfaces = os.popen('ip addr show').read()  # Usamos 'ip addr show' para obtener las interfaces de red
    ip = None

    # Buscar la IP que contenga "10.20.30"
    for line in interfaces.split('\n'):
        if '10.20.30' in line:
            ip = line.strip().split()[1].split('/')[0]
            break

    if ip is None:
        raise Exception("No se encontró una IP que contenga '10.20.30'.")

    # Obtener el último número de la dirección IP
    ultimo_numero = ip.split('.')[-1]

    # Generar el identificador
    identificador = f"{bot}{ultimo_numero.zfill(3)}{id}"
    
    return identificador
