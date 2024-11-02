import psycopg2
from psycopg2 import pool
import config  # Asumiendo que tienes un archivo config.py

def crear_pool_conexiones(db_host):
    try:
        # Crear un pool de conexiones
        connection_pool = psycopg2.pool.SimpleConnectionPool(
            1,  # Mínimo de conexiones
            10,  # Máximo de conexiones
            user=config.DATABASE_USER,
            password=config.DATABASE_PASSWORD,
            host=db_host,
            port=config.DATABASE_PORT if hasattr(config, 'DATABASE_PORT') else 5432,
            database=config.DATABASE_NAME
        )
        if connection_pool:
            print("Pool de conexiones creado exitosamente")
        return connection_pool

    except (Exception, psycopg2.DatabaseError) as error:
        print("Error al crear el pool de conexiones", error)
        return None


# Función para obtener una conexión del pool
def get_connection(connection_pool):
    try:
        # Obtener una conexión del pool
        connection = connection_pool.getconn()
        if connection:
            print("Conexión obtenida del pool")
        return connection
    except (Exception, psycopg2.DatabaseError) as error:
        print("Error al obtener una conexión del pool", error)

# Función para liberar la conexión
def release_connection(connection_pool, connection):
    try:
        # Liberar la conexión de vuelta al pool
        connection_pool.putconn(connection)
        print("Conexión liberada de vuelta al pool")
    except (Exception, psycopg2.DatabaseError) as error:
        print("Error al liberar la conexión", error)
        