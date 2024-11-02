import select
import subprocess
import time
from iplocal import get_ip, get_ip_public
import psycopg2
import config
import dbConnection
import boto3
import env 


script_path = "./pm2.sh"
redVPC = "10.20.30.0"
ip_local = get_ip(redVPC)
linode_id = ""
ip_public = ""


def obtener_ip_publica(instance_id, region):
    # Inicializar el cliente EC2 con credenciales
    ec2_client = boto3.client(
        'ec2',
        region_name=region,
        aws_access_key_id=env.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=env.AWS_SECRET_ACCESS_KEY
    )

    try:
        # Obtener la información de la instancia por su ID
        response = ec2_client.describe_instances(InstanceIds=[instance_id])

        # Extraer la IP pública
        instances = response['Reservations'][0]['Instances']
        if instances:
            public_ip = instances[0].get('PublicIpAddress')
            return public_ip if public_ip else ""
        else:
            return ""

    except Exception as e:
        print(f"Error al obtener la información de la instancia: {e}")
        return ""
        
def ejecutar_notificacion(msg):
    try:
        ip, comando = msg.split("|")
        if ip == ip_local:
            # Verificar si el comando tiene algo más y procesarlo
            if len(comando) > 1:
                print("nuevo comando")
                bots = f"{comando}1,{comando}2"
                procesar_comando(bots)
            else:
                try:
                    # Ejecutar script
                    result = subprocess.run([script_path], check=True, capture_output=True, text=True)
                    print("Comando ejecutado correctamente: N", result.stdout)
                except subprocess.CalledProcessError as e:
                    print("Error al ejecutar el comando:", e.stderr)

    except ValueError:
        print(f"Formato de mensaje incorrecto: {msg}")


def procesar_comando(comando):
    print(f"Procesando comando: S{comando}")
    try:
        result = subprocess.run([script_path, comando], check=True, capture_output=True, text=True)
        print("Comando ejecutado correctamente: C", result.stdout)
    except subprocess.CalledProcessError as e:
        print("Error al ejecutar el comando:", e.stderr)


def main():
    global linode_id
    print("inicio")
    ip_public = get_ip_public()
    db_host = obtener_ip_publica('i-087fc052d68642f7e', 'us-east-1')
    print("la ip de la base de datos es:")
    print(db_host)

    # Escribir la configuración en el archivo config.py
    contenidoPY = f"""DATABASE_HOST = "{db_host}"
DATABASE_USER = "shaka_desyng"
DATABASE_PASSWORD = "Shaka_Profamilia"
DATABASE_NAME = "botsprofamilia"
VPC_BASE = "10.20.30"
PASSWORD_CRYPTO = "Shaka_Profamilia"
SHAREPOINT_BASE = "Archivos"
"""
    with open('/home/devbots/profamilia/botCargar/config.py', 'w') as file:
        file.write(contenidoPY)

    connection_pool = dbConnection.crear_pool_conexiones(db_host)
    try:
        connection = dbConnection.get_connection(connection_pool)  # Asumiendo que tienes una función get_connection definida en otro lugar
        cursor = connection.cursor()

        # Seleccionar y bloquear la fila con FOR UPDATE
        sql_select = """
            SELECT id, linode_id
            FROM ec2 
            WHERE ip_public = %s
            FOR UPDATE
            LIMIT 1;
        """
        cursor.execute(sql_select, (ip_public,))
        select_result = cursor.fetchone()

        if select_result is None:
            print("No se encontró ninguna fila con el IP proporcionado.")
        else:
            linode_id = select_result[1]
            id = select_result[0]

            # Actualizar la IP local
            sql_update = """
                UPDATE ec2 SET ip_address=%s, updated_at=now()
                WHERE id = %s
            """
            cursor.execute(sql_update, (ip_local, id))

            # Confirmar la transacción para asegurar que el cambio se aplique
            connection.commit()

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"Error en la consulta: {error}")
        if connection:
            connection.rollback()  # Revertir cualquier cambio en caso de error
    finally:
        # Cerrar el cursor y devolver la conexión al pool
        if cursor:
            cursor.close()
        if connection:
            dbConnection.release_connection(connection_pool, connection)



    # Escribir la configuración en el archivo config.js
    contenidoJS = f"""module.exports = {{
    DATABASE_HOST: "{db_host}",
    DATABASE_USER: "shaka_desyng",
    DATABASE_PASSWORD: "Shaka_Profamilia",
    DATABASE_NAME: "botsprofamilia",
    VPC_BASE: "10.20.30",
    PASSWORD_CRYPTO: "Shaka_Profamilia",
    SHAREPOINT_BASE: "Archivos",
    LINODE_ID:"{linode_id}"
}};"""
    with open('/home/devbots/supervisor/.env/config.js', 'w') as file:
        file.write(contenidoJS)

    print(f"IP local: {ip_local}")

    # Conexión a la base de datos para LISTEN/NOTIFY
    try:
        conn = psycopg2.connect(
            dbname=config.DATABASE_NAME,
            user=config.DATABASE_USER,
            password=config.DATABASE_PASSWORD,
            host=db_host,
            port="5432",
            keepalives=1,         # Habilita keepalive
            keepalives_idle=30,   # Envío de keepalive después de 30 segundos de inactividad
            keepalives_interval=10,  # Reenvía keepalive cada 10 segundos si no hay respuesta
            keepalives_count=5    # Número máximo de keepalive sin respuesta antes de cerrar
        )
        conn.autocommit = True  # Importante para LISTEN/NOTIFY
        cur = conn.cursor()
        cur.execute("LISTEN bot_notifications;")
        print("Esperando notificaciones en el canal 'bot_notifications'...")


        # Ejecutar consulta y procesar comandos
        try:
            # Obtener una conexión desde el pool
            connection = dbConnection.get_connection(connection_pool)  # Utilizar la función get_connection del pool
            cursor = connection.cursor()

            # Seleccionar y bloquear la fila con FOR UPDATE
            sql_select = """
                SELECT COALESCE(b.nombre, '') AS comando
                FROM ec2 v
                LEFT JOIN bots b ON v.bot_id = b.id
                WHERE v.linode_id = %s
                AND b.nombre IS NOT NULL
                AND v.bot_id != 0
                LIMIT 1;
            """
            cursor.execute(sql_select, (linode_id,))
            select_result = cursor.fetchone()

            if select_result is None:
                print("No se encontró ninguna fila con el IP proporcionado.")
            else:
                comando = select_result[0]
                bots = f"{comando}1,{comando}2"
                procesar_comando(bots)

        except (Exception, psycopg2.DatabaseError) as error:
            print(f"Error en la consulta: {error}")
            if connection:
                connection.rollback()
        finally:
            if cursor:
                cursor.close()
            if connection:
                dbConnection.release_connection(connection_pool, connection)


        # Loop infinito para esperar notificaciones
        while True:
            # Esperar hasta que haya una notificación o se alcance el timeout
            if select.select([conn], [], [], 5) == ([], [], []):
                pass
            else:
                conn.poll()
                while conn.notifies:
                    notify = conn.notifies.pop(0)
                    print(f"Notificación recibida: {notify.payload}")
                    ejecutar_notificacion(notify.payload)

    except Exception as e:
        print(f"Error en la conexión a la base de datos: {e}")

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


if __name__ == "__main__":
    main()
