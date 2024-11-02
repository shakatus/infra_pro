from iplocal import get_ip
from dbConnection import get_connection, release_connection
from sharepoint_uploader import upload_to_sharepoint
import time
import signal
import sys
import psycopg2

redVPC = "10.20.30.0";
idBOT = "4";
idWork = "1";
nameBOT = "";

# Manejador para las señales de interrupción
def signal_handler(sig, frame):
    print('Se recibió la señal para detener el programa. Saliendo...')
    sys.exit(0)

# Registrar los manejadores de señales
signal.signal(signal.SIGINT, signal_handler)  # Para Ctrl+C
signal.signal(signal.SIGTERM, signal_handler)  # Para comandos de terminación (ej. PM2)

def main():
    print("inicio")
    global nameBOT
    nameBOT = get_ip(redVPC, idBOT, idWork)
    print(nameBOT)
    while True:
        try:
            print("Obteniendo datos")
            resultado = obtener_trabajo(nameBOT)
            print(resultado)
            if resultado:
                print(resultado[7])
                upload_to_sharepoint(resultado[7],"/home/devbots/archivo/"+resultado[7])
                actualizar_trabajo(nameBOT, resultado[0])
        except Exception as error:
            print(f'Error en loop: {error}')
        delay(10)


def delay(seconds):
    try:
        time.sleep(seconds)
    except KeyboardInterrupt:
        print("Interrupción durante la espera. Saliendo...")

def actualizar_trabajo(nameBOT, id):
    connection = None
    try:
        # Obtener una conexión desde el pool
        connection = get_connection()  # Asumiendo que tienes una función get_connection definida en otro lugar
        cursor = connection.cursor()

        # Ejecutar el UPDATE
        sql_update = """
            UPDATE folder
            SET estado = 2, fecha_fin_carga = now()
            WHERE estado = 1
              AND ebot_id = %s
              AND id = %s
        """
        cursor.execute(sql_update, (nameBOT, id))

        # Confirmar la transacción
        connection.commit()

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"Error: {error}")
        if connection:
            connection.rollback()  # Hacer rollback si hay un error
        raise error

    finally:
        if connection:
            release_connection(connection)  # Liberar la conexión al pool


def obtener_trabajo(nameBOT):
    connection = None
    try:
        # Obtener una conexión desde el pool
        connection = get_connection()  # Asumiendo que tienes una función get_connection definida en otro lugar
        cursor = connection.cursor()

        # Seleccionar y bloquear la fila con FOR UPDATE
        sql_select = """
            SELECT *
            FROM folder
            WHERE estado = 1
                AND ebot_id = %s
            LIMIT 1
            FOR UPDATE;
        """
        cursor.execute(sql_select, (nameBOT,))
        select_result = cursor.fetchone()

        if select_result is None:
            # Si no hay filas, retornar None
            return None

        # Actualizar la fecha de inicio de carga
        sql_update = """
            UPDATE folder
            SET fecha_inicio_carga = now()
            WHERE id = %s;
        """
        cursor.execute(sql_update, (select_result[0],))  # select_result[0] es el ID de la fila

        # Confirmar la transacción
        connection.commit()

        # Retornar el resultado de la fila seleccionada
        return select_result

    except (Exception, psycopg2.DatabaseError) as error:
        print(f"Error: {error}")
        if connection:
            connection.rollback()  # Revertir cambios en caso de error
        raise error

    finally:
        if connection:
            release_connection(connection)  # Liberar la conexión al pool



if __name__ == "__main__":
    main()