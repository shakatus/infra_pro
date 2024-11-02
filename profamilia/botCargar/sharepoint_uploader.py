import os
import logging
import time
from pathlib import Path
from azure.identity import ClientSecretCredential
import requests
from credenciales import obtener_credenciales
import config 

SHAREPOINT_BASE = config.SHAREPOINT_BASE
print(SHAREPOINT_BASE)
DELAY = 1  # Retraso en segundos para evitar sobrecarga en las solicitudes al servidor
access_token = None
SHARE_DOMINIO = ""
SHARE_SITIO = ""
tenant_id = ""
client_id = ""
client_secret = ""

# Configuración de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def iniciar():
    global access_token, SHARE_DOMINIO, SHARE_SITIO, tenant_id, client_id, client_secret
    try:
        # Asegurarse de que las credenciales estén configuradas
        if not all([tenant_id, client_id, client_secret]):
            raise ValueError("Faltan credenciales necesarias. Asegúrate de asignar tenant_id, client_id, y client_secret.")

        # Inicializar las credenciales
        credential = ClientSecretCredential(tenant_id, client_id, client_secret)
        token_response = credential.get_token('https://graph.microsoft.com/.default')
        access_token = token_response.token

        if not access_token:
            raise ValueError("No se pudo obtener el token de acceso.")
    except Exception as e:
        logging.error(f"Error al inicializar el cliente de Graph: {e}")
        raise

def get_site_id(site_url):
    global access_token
    if not access_token:
        iniciar()

    try:
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        response = requests.get(f'https://graph.microsoft.com/v1.0/sites/{site_url}', headers=headers)
        if response.status_code == 200:
            site_id = response.json().get('id')
            if not site_id:
                raise ValueError("No se pudo obtener un Site ID válido.")
            logging.info(f"Site ID obtenido: {site_id}")
            return site_id
        else:
            logging.error(f"Error al obtener el Site ID: {response.status_code} - {response.text}")
            response.raise_for_status()
    except Exception as e:
        logging.error(f"Error al obtener el Site ID: {e}")
        raise

def get_drive_id(site_id):
    global access_token, SHAREPOINT_BASE
    if not access_token:
        iniciar()

    if not site_id:
        raise ValueError("El Site ID proporcionado no es válido.")

    try:
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        response = requests.get(f'https://graph.microsoft.com/v1.0/sites/{site_id}/drives', headers=headers)
        if response.status_code == 200:
            drives = response.json().get('value', [])
            drive_carpeta = next((item for item in drives if item['name'] == SHAREPOINT_BASE), None)
            if drive_carpeta:
                logging.info(f"Drive ID obtenido: {drive_carpeta['id']}")
                return drive_carpeta['id']
            else:
                logging.error("No se encontró un drive con el nombre especificado.")
                raise ValueError("Drive no encontrado")
        else:
            logging.error(f"Error al obtener el Drive ID: {response.status_code} - {response.text}")
            response.raise_for_status()
    except Exception as e:
        logging.error(f"Error al obtener el Drive ID: {e}")
        raise

def folder_exists(drive_id, folder_path):
    global access_token
    if not access_token:
        iniciar()

    try:
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        url = f'https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{folder_path}'
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            logging.info(f"Carpeta ya existe: {folder_path}")
            return True
        else:
            logging.info(f"La carpeta no existe: {folder_path}")
            return False
    except Exception as e:
        logging.error(f"Error al verificar si la carpeta existe: {e}")
        raise

def create_folder(drive_id, folder_path):
    global access_token
    if not access_token:
        iniciar()

    # Verificar si el nombre de la carpeta está vacío
    if not folder_path.strip():
        logging.error("El nombre de la carpeta no puede estar vacío.")
        raise ValueError("El nombre de la carpeta no puede estar vacío.")

    # Eliminar cualquier carácter '/' del nombre de la carpeta, ya que no está permitido
    folder_name = folder_path.split('/')[-1].replace('/', '_')
    parent_path = '/'.join(folder_path.split('/')[:-1])
    
    if parent_path:
        parent_path = f'/root:/{parent_path}:'
    else:
        parent_path = '/root'

    try:
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        url = f'https://graph.microsoft.com/v1.0/drives/{drive_id}{parent_path}/children'
        data = {
            "name": folder_name,
            "folder": {},
            "@microsoft.graph.conflictBehavior": "rename"
        }
        response = requests.post(url, headers=headers, json=data)

        if response.status_code == 201:
            logging.info(f"Carpeta creada exitosamente: {folder_path}")
        elif response.status_code == 400:
            logging.error(f"Error al crear la carpeta: Verifique el formato del nombre de la carpeta o si hay caracteres no permitidos. {response.status_code} - {response.text}")
            raise ValueError("Error en la solicitud para crear la carpeta. Verifique el nombre y la ruta.")
        else:
            logging.error(f"Error al crear la carpeta: {response.status_code} - {response.text}")
            response.raise_for_status()
    except Exception as e:
        logging.error(f"Error al crear la carpeta {folder_path}: {e}")
        raise

def file_exists(drive_id, file_path):
    global access_token
    if not access_token:
        iniciar()

    try:
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        url = f'https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{file_path}'
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            logging.info(f"Archivo ya existe: {file_path}")
            return True
        elif response.status_code == 404:
            logging.info(f"El archivo no existe: {file_path}")
            return False
        else:
            logging.error(f"Error al verificar si el archivo existe: {response.status_code} - {response.text}")
            response.raise_for_status()
    except Exception as e:
        logging.error(f"Error al verificar si el archivo existe: {e}")
        raise

def upload_file(drive_id, folder_path, local_file_path, overwrite=False):
    global access_token
    if not access_token:
        iniciar()

    try:
        file_name = Path(local_file_path).name
        target_file_path = f"{folder_path}/{file_name}"
        
        if not overwrite and file_exists(drive_id, target_file_path):
            logging.info(f"El archivo {target_file_path} ya existe y 'overwrite' está desactivado. No se subirá.")
            return

        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/octet-stream'
        }
        url = f'https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{target_file_path}:/content'
        
        with open(local_file_path, 'rb') as file:
            response = requests.put(url, headers=headers, data=file)

        if response.status_code in (200, 201):
            logging.info(f"Archivo subido exitosamente: {target_file_path}")
        else:
            logging.error(f"Error al subir el archivo: {response.status_code} - {response.text}")
            response.raise_for_status()
    except Exception as e:
        logging.error(f"Error al subir el archivo {local_file_path}: {e}")
        raise

def upload_to_sharepoint(sharepoint_folder_path, local_folder_path):
    global SHARE_DOMINIO, SHARE_SITIO, tenant_id, client_id, client_secret
    datos = obtener_credenciales(1, 0)
    
    # Credenciales de ejemplo, deberías obtenerlas desde tu fuente segura de credenciales
    tenant_id = next((dato['valor_descifrado'] for dato in datos if dato['etiqueta'] == "SHARE_TENANT_ID"), None)
    client_id = next((dato['valor_descifrado'] for dato in datos if dato['etiqueta'] == "SHARE_CLIENT_ID"), None)
    client_secret = next((dato['valor_descifrado'] for dato in datos if dato['etiqueta'] == "SHARE_CLIENT_SECRET"), None)
    SHARE_DOMINIO = next((dato['valor_descifrado'] for dato in datos if dato['etiqueta'] == "SHARE_DOMINIO"), None)
    SHARE_SITIO = next((dato['valor_descifrado'] for dato in datos if dato['etiqueta'] == "SHARE_SITIO"), None)

    site_url = f"{SHARE_DOMINIO}:/{SHARE_SITIO}"

    site_id = get_site_id(site_url)
    if not site_id:
        raise ValueError("No se pudo obtener un Site ID válido.")
    drive_id = get_drive_id(site_id)
    if not drive_id:
        raise ValueError("No se pudo obtener un Drive ID válido.")
    logging.info("Iniciando la carga de archivos y carpetas a SharePoint...")

    # Crear la estructura de carpetas anidadas en SharePoint
    partes_ruta = sharepoint_folder_path.split('/')
    ruta_actual = ""
    for parte in partes_ruta:
        ruta_actual = f"{ruta_actual}/{parte}" if ruta_actual else parte
        if not folder_exists(drive_id, ruta_actual):
            create_folder(drive_id, ruta_actual)

    # Recorrer la carpeta local y subir archivos
    for dirpath, dirnames, filenames in os.walk(local_folder_path):
        relative_path = os.path.relpath(dirpath, local_folder_path)
        if relative_path == ".":
            relative_path = ""
        sharepoint_path = f"{sharepoint_folder_path}/{relative_path}".replace('\\', '/')

        # Crear subcarpetas
        for dirname in dirnames:
            subfolder_path = f"{sharepoint_path}/{dirname}"
            if not folder_exists(drive_id, subfolder_path):
                create_folder(drive_id, subfolder_path)

        # Subir archivos
        for filename in filenames:
            local_file_path = os.path.join(dirpath, filename)
            sharepoint_file_path = f"{sharepoint_path}/{filename}"
            if not file_exists(drive_id, sharepoint_file_path):
                upload_file(drive_id, sharepoint_path, local_file_path, True)
