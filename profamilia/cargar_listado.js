const fs = require('fs');
const readline = require('readline');
const pool = require('./dbConnection'); // Asegúrate de que este archivo exporte correctamente la conexión

async function insertarLinea(atencion, idfolder, eps, eps_id, ruta, nombrearchivo) {
  try {
    // La consulta SQL espera 9 valores, según lo que has definido
    const query = 'INSERT INTO tareas (folder_id, eps, ruta, atencion, ebot_id, estado, terminado, eps_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';
    
    // Aquí proporcionas los valores correctos. Agregué algunos valores predeterminados para los campos faltantes.
    await pool.query(query, [idfolder, eps, ruta, atencion, 0, 0, 0, eps_id]);
    
    console.log(`Línea insertada: atencion=${atencion}, nombrearchivo=${nombrearchivo}`);
  } catch (error) {
    console.error(`Error al insertar línea: atencion=${atencion}, nombrearchivo=${nombrearchivo}`, error);
  }
}


async function actualizarFolder(idFolder) {
  try {
    // Usar NOW() para establecer la fecha y hora actual
    const query = 'UPDATE folder SET estado = 1 WHERE id = $1';
    
    // Ejecutar la consulta de actualización
    await pool.query(query, [idFolder]);
    
    console.log(`Fecha de creación actualizada a la fecha actual para el folder con id: ${idFolder}`);
  } catch (error) {
    console.error(`Error al actualizar la fecha de creación para el folder con id: ${idFolder}`, error);
  }
}



async function leerArchivoPorLineas(rutaArchivo, eps, eps_id, ruta, nombrearchivo, id) {
  
  const fileStream = fs.createReadStream(rutaArchivo);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    await insertarLinea(line,id, eps, eps_id, ruta, nombrearchivo);
  }

  await actualizarFolder(id);
  rl.on('close', () => {
    console.log('Lectura completa del archivo');
  });
}

// Exportar la función
module.exports = { leerArchivoPorLineas };
