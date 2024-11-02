from dbConnection import get_connection, release_connection
import config  # Asumiendo que tienes un archivo `config.py` donde está `PASSWORD_CRYPTO`

def obtener_credenciales(empresa_id, bot_id):
    try:
        # Obtener una conexión desde dbConnection
        conexion = get_connection()
        cursor = conexion.cursor()

        # Consulta SQL con parámetros
        query = """
            SELECT etiqueta, pgp_sym_decrypt(valor_cifrado, %s) AS valor_descifrado
            FROM datos
            WHERE id_empresa = %s
            AND bot_id IN (0, %s)
        """

        values = (config.PASSWORD_CRYPTO, empresa_id, bot_id)

        # Ejecutar la consulta
        cursor.execute(query, values)
        
        # Obtener todos los resultados
        resultados = cursor.fetchall()

        # Procesar resultados (si quieres retornarlos como un diccionario)
        datos = [{'etiqueta': row[0], 'valor_descifrado': row[1]} for row in resultados]
        
        return datos

    except Exception as error:
        print("Error ejecutando la consulta", error)
        raise error
    finally:
        # Liberar la conexión con release_connection
        if conexion:
            release_connection(conexion)