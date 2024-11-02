import os
import sys
#import logging
from office365.sharepoint.client_context import ClientContext
from office365.runtime.auth.user_credential import UserCredential
from pathlib import Path
import config 
from urllib.parse import urljoin

# Configuración de logging
#logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def authenticate_sharepoint(site_url, username, password):
    """
    Autentica y retorna el contexto del cliente de SharePoint.
    """
    try:
        ctx = ClientContext(site_url).with_credentials(UserCredential(username, password))
        # Verificar la conexión
        web = ctx.web
        ctx.load(web)
        ctx.execute_query()
        #logging.info(f"Conectado exitosamente a SharePoint: {web.properties['Title']}")
        return ctx
    except Exception as e:
        #logging.error(f"Error al autenticar en SharePoint: {e}")
        raise

def file_exists(ctx: ClientContext, file_url: str) -> bool:
    try:
        file = ctx.web.get_file_by_server_relative_url(file_url)
        ctx.load(file)
        ctx.execute_query()
        #logging.info(f"Archivo ya existe: {file_url}")
        return True
    except Exception as e:
        return False


def upload_file(ctx: ClientContext, folder_url: str, local_file_path: str, overwrite: bool = False) -> None:
    """
    Sube un archivo a SharePoint.
    
    Args:
        ctx (ClientContext): Contexto autenticado de SharePoint.
        folder_url (str): URL relativa de la carpeta en SharePoint donde se subirá el archivo.
        local_file_path (str): Ruta local del archivo a subir.
        overwrite (bool): Si es True, sobrescribe el archivo si ya existe. Por defecto es False.
    """
    try:
        file_name = Path(local_file_path).name
        target_file_url = f"{folder_url.rstrip('/')}/{file_name}"
        #logging.info(f"Preparando para subir el archivo: {file_name} a {target_file_url}")
        
        if not overwrite:
            if file_exists(ctx, target_file_url):
                #logging.info(f"El archivo {target_file_url} ya existe y 'overwrite' está desactivado. No se subirá.")
                return
        
        with open(local_file_path, 'rb') as content_file:
            file_content = content_file.read()
        
        ctx.web.get_folder_by_server_relative_url(folder_url).upload_file(file_name, file_content).execute_query()
        #logging.info(f"Archivo subido exitosamente: {target_file_url}")
    except Exception as e:
        #logging.error(f"Error al subir el archivo {local_file_path}: {e}")
        raise

def folder_exists(ctx: ClientContext, folder_url: str) -> bool:
    """
    Verifica si una carpeta existe en SharePoint.
    Retorna True si existe, False si no.
    
    Args:
        ctx (ClientContext): Contexto autenticado de SharePoint.
        folder_url (str): URL relativa de la carpeta en SharePoint.
        
    Returns:
        bool: True si la carpeta existe, False si no.
    """
    try:
        folder = ctx.web.get_folder_by_server_relative_url(folder_url)
        ctx.load(folder)
        ctx.execute_query()
        #logging.info(f"Carpeta ya existe: {folder_url}")
        return True
    except Exception as e:
        return False

def create_folder(ctx: ClientContext, folder_url: str) -> None:
    """
    Crea una carpeta en SharePoint.
    
    Args:
        ctx (ClientContext): Contexto autenticado de SharePoint.
        folder_url (str): URL relativa de la carpeta en SharePoint.
    """
    try:
        ctx.web.folders.add(folder_url)
        ctx.execute_query()
        #logging.info(f"Carpeta creada exitosamente: {folder_url}")
    except Exception as e:
        #logging.error(f"Error al crear la carpeta {folder_url}: {e}")
        raise

def creacion_de_carpetas(ctx, base, ruta):
    carpetas = base
    partes = ruta.split('/')
    for index, parte in enumerate(partes, start=1):
        carpetas = carpetas + "/" + parte  # Concatenar solo la parte actual
        respuesta = folder_exists(ctx,carpetas)
        if(respuesta):
            #print("existe")
            pass
        else:
            create_folder(ctx,carpetas)


def recorrer_carpeta(ctx, ruta, base):
    profundidad_inicial = ruta.count(os.sep)
    for dirpath, dirnames, filenames in os.walk(ruta):
        profundidad_actual = dirpath.count(os.sep) - profundidad_inicial
        indent = ' ' * 4 * profundidad_actual  # Espacios para indentación según el nivel
        ubicacion = dirpath + "/"  # Asignas la ruta con indentación
        ubicacion = ubicacion.replace(ruta,"")
        #print("-->"+base+"/"+ubicacion)  # Imprimes la ruta de la carpeta
        respuesta = folder_exists(ctx,base+"/"+ubicacion)
        if(respuesta):
            #print("")
            pass
        else:
            #print("")
            create_folder(ctx,base+"/"+ubicacion)

        for filename in filenames:
            #print(f"{ubicacion}{indent}{filename}")  # Imprime los archivos con indentación
            #print("--> "+base+ubicacion+filename)
            respuestaFile = file_exists(ctx,base+ubicacion+filename)
            if(respuestaFile):
                pass
                #print("ya existe")
            else:
                upload_file(ctx, base+"/"+ubicacion, dirpath+"/"+filename, False )

def enviarPDF(local_folder_path, sharepoint_folder_url):

    # Configuración desde variables de entorno
    site_url = config.SHAREPOINT_URL
    username = config.SHAREPOINT_USERNAME
    password = config.SHAREPOINT_PASSWORD
    base = config.SHAREPOINT_BASE

    # Verificar que todas las variables estén definidas
    if not all([site_url, username, password, local_folder_path, sharepoint_folder_url]):
        #logging.error("Error: Todas las variables de entorno deben estar definidas en el archivo .env.")
        return

    try:        
        ctx = authenticate_sharepoint(site_url, username, password)
        creacion_de_carpetas(ctx, base, sharepoint_folder_url)
        upload_file(ctx,  base+"/"+sharepoint_folder_url, local_folder_path, False )
        return True
    except:
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: python script.py <param1> <param2>")
    else:
        enviarPDF(sys.argv[1], sys.argv[2])


