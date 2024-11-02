import os
import socket
import requests

def get_ip(red):
    interfaces = os.popen('ip addr show').read()  # Usamos 'ip addr show' para obtener las interfaces de red
    ip = None

    # Buscar la IP que contenga "10.20.30"
    for line in interfaces.split('\n'):
        if '10.20.30' in line:
            ip = line.strip().split()[1].split('/')[0]
            break

    if ip is None:
        raise Exception("No se encontró una IP que contenga '10.20.30'.")

    return ip

def get_ip_public():
    try:
        respuesta = requests.get("https://api.ipify.org?format=json")
        if respuesta.status_code == 200:
            return respuesta.json()["ip"]
        else:
            print("Error al obtener la IP pública:", respuesta.status_code)
    except requests.RequestException as e:
        print(f"Error al hacer la solicitud: {e}")