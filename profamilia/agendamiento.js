const getIP = require('./iplocal');
const pool = require('./dbConnection');
const { obtenerCredenciales } = require('./credenciales');
const puppeteer = require('puppeteer');
const fse = require('fs-extra');
const fsPromises = require('fs').promises;
const { exec } = require('child_process');
const { pipeline } = require('stream/promises');
const fs = require('fs');
const csv = require('csv-parser');
const redVPC = "10.20.30.0";
const idBOT = "10";
let idWork = isNaN(parseInt(process.argv[2])) ? 1 : parseInt(process.argv[2]);
let nameBOT = "";

let browser  = null;

const ubicacion_archivos = "/home/devbots/Downloads/Agendamiento/";
let USER = "";
let PASSWORD = ""; 

async function credenciales(){
  const datos = await obtenerCredenciales(1, 4);

  USER = datos.find(dato => dato.etiqueta === 'PROFAMILIA_USER').valor_descifrado;
  PASSWORD = datos.find(dato => dato.etiqueta === 'PROFAMILIA_PASW').valor_descifrado;
  console.log("obtenemos usuario ")
}

async function obtenerTrabajo(nameBOT) {
    let client;

    try {
        // Obtener una conexión del pool
        client = await pool.connect();

        // Iniciar la transacción
        await client.query('BEGIN');

        // Seleccionar y bloquear la fila con FOR UPDATE
        const sqlSelect = `
            SELECT id, fecha
            FROM trabajos
            WHERE estado = 0
              AND ebot_id IN (0, $1)
              AND agendamiento = true
            LIMIT 1
            FOR UPDATE;
        `;
        const selectResult = await client.query(sqlSelect, [nameBOT]);

        if (selectResult.rows.length === 0) {
            // Si no hay filas, simplemente hacemos COMMIT para finalizar la transacción
            await client.query('COMMIT');
            return null;
        }

        idTrabajo = selectResult.rows[0].id;

        // Actualizar la tarea seleccionada
        const sqlUpdate = `
            UPDATE trabajos
            SET ebot_id = CASE WHEN id = $2 THEN $1 ELSE 0 END
            WHERE (ebot_id = $1 OR id = $2)
            AND estado=0;
        `;
        console.log(nameBOT);
        console.log(idTrabajo);
        await client.query(sqlUpdate, [nameBOT, idTrabajo]);

        // Confirmar la transacción (libera los bloqueos)
        await client.query('COMMIT');

        // Retornar el resultado de la fila seleccionada después de la actualización
        return selectResult.rows[0];

    } catch (error) {
        console.error('Error:', error);
        try {
            // Hacer rollback en caso de error (libera los bloqueos)
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('Error al hacer rollback:', rollbackError);
        }
        throw error;

    } finally {
        if (client) {
            try {
                client.release();
            } catch (releaseError) {
                console.error('Error al liberar la conexión:', releaseError);
            }
        }
    }
}

/////////////////////////////////////////////////////////////////////limpiar/////////////////////////////////////////////////////////////////////////////////
let tmpProfilePath="";
let tmpProfilePathChrome="";
const cleanUp = () => {
  
  try{
    browser.close();    
  }catch(err){
    console.log(err);
  }   
  console.log(`Intentando eliminar el perfil temporal: ${tmpProfilePath}`);
  exec(`rm -rf ${tmpProfilePath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error al eliminar el perfil temporal: ${stderr}`);
    } else {
      console.log(`Perfil temporal eliminado: ${tmpProfilePath}`);
    }
  });
  
};
// Registrar manejadores para diferentes señales del sistema
process.on('SIGINT', async () => {
  console.log("sigint");
  //await cleanUp();
  //process.exit(0);
});
process.on('SIGTERM', async () => {
  console.log("sigterm");
  await cleanUp();
  process.exit(0);
});
process.on('exit', async () => {
  console.log("exit");
  await cleanUp();
});
process.on('exit', (code) => {
    console.log(`El proceso salió con el código: ${code}`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function main() {
  if (!fs.existsSync(ubicacion_archivos)) {
    fs.mkdirSync(ubicacion_archivos, { recursive: true });
    console.log('Carpeta creada exitosamente.');
  } else {
    console.log('La carpeta ya existe.');
  }

  nameBOT = await getIP(redVPC,idBOT,idWork)
  tmpProfilePath = `/tmp/${idWork}`;
  tmpProfilePathChrome = `/tmp/${idWork}/chrome-profile-${process.pid}`;
  await credenciales();
	while (true) {
		try {
		  const resultado = await obtenerTrabajo(nameBOT);
		    
		  if (resultado) {
            console.log(resultado); 
		    await procesarSolicitud(resultado.id, resultado.fecha);
		  }
		} catch (error) {
		  console.error('Error en loop:', error);
		}
		// Esperar 1 minuto antes de repetir el ciclo (60000 ms = 1 minuto)
		await delay(5000); 
	}
}

async function procesarSolicitud(id, fecha){

  if (browser !== null) {
      await browser.close();
      browser = null;
  }

	browser = await puppeteer.launch({
    	executablePath: '/usr/bin/google-chrome',
      userDataDir: tmpProfilePathChrome,
    	args: [
    		'--allow-running-insecure-content', // Permite contenido inseguro (HTTP)
    		'--no-sandbox',
    		'--disable-setuid-sandbox'
    	],
    	headless: false // Si quieres ver el navegador, puedes poner false
    	});

	// Abre una nueva página
	const page = await browser.newPage();

	// Navega a una URL
	await page.goto('http://10.0.1.119/Agendamiento/login');

  await page.waitForSelector('#app_username');
  console.log("digita usuario");
  while(true)
  {
    await page.type('#app_username', USER);
    const suraname = await page.$eval('#app_username', element => element.value);
    if(suraname == USER)
    {
      break;
    }
  }
  console.log("digita password");
  while(true)
  {
    await page.type('#app_password', PASSWORD);
    const password_ = await page.$eval('#app_password', element => element.value);
    if(password_ == PASSWORD)
    {
      break;
    }
  }
  console.log("click en iniciar session")
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }), // Espera a que la navegación termine
    page.click('#j_idt11') // Reemplaza con el selector adecuado
  ]);
  
  await page.goto('http://10.0.1.119/Agendamiento/agreporep1');

  await page.waitForSelector('#report1Form\\:fechaIni_input');
  console.log("colocamos la fecha inicial")
  console.log(fecha)
  while(true){
  	await page.focus('#report1Form\\:fechaIni_input');
	  for (let i = 0; i < fecha.length; i++) {
    	await page.keyboard.press('Backspace');
  	}
	  await page.type('#report1Form\\:fechaIni_input', fecha);
	  const valorInput = await page.evaluate(() => {
	    return document.querySelector('#report1Form\\:fechaIni_input').value;
	  });
	  console.log(valorInput);
	  if(valorInput == fecha)
	  {
	  	await page.keyboard.press('Enter');
	  	break;
	  }
	}
  console.log("colocamos la fecha final")
  while(true){
  	await page.focus('#report1Form\\:fechaFin_input');
  	for (let i = 0; i < fecha.length; i++) {
    	await page.keyboard.press('Backspace');
  	}
	  await page.type('#report1Form\\:fechaFin_input', fecha);
	  const valorInput = await page.evaluate(() => {
	    return document.querySelector('#report1Form\\:fechaFin_input').value;
	  });
	  if(valorInput == fecha)
	  {
	  	await page.keyboard.press('Enter');
	  	break;
	  }
	}

	await page.focus("#report1Form\\:btn_search_rep1");

	await page.setRequestInterception(true);
  const cliente = await page.target().createCDPSession();
  await cambiarCarpeta(cliente,ubicacion_archivos+id); 


  let requestDetected = false;
  let habilitarRequestBusqueda = false;
  const requestListener = (request) => {
    console.log(request.url());
    const url = request.url();
    request.continue();
    if (url.includes('http://10.0.1.119/Agendamiento/javax.faces.resour') && habilitarRequestBusqueda == true) {
      requestDetected = true; // Marcamos que la URL fue detectada
    }
  };
  page.on('request', requestListener);

	habilitarRequestBusqueda = true
	while (!requestDetected) {
		console.log('Haciendo clic en el botón...');
		try{
			await page.click('#report1Form\\:btn_search_rep1'); // Reemplaza con el selector del botón
		}catch(err)
		{
			break;
		}
		// Esperar un poco antes de hacer clic nuevamente (evitar demasiado spam de clics)
		await delay(500);
	}
//	page.off('request', requestListener);
  
	console.log("descargar....")
  

	while(true){
		  await page.waitForSelector('#report1Form\\:reporteDatalist > div.ui-datatable-header.ui-widget-header.ui-corner-top > button:nth-child(4)');
		  await page.click('#report1Form\\:reporteDatalist > div.ui-datatable-header.ui-widget-header.ui-corner-top > button:nth-child(4)');
		  try {	
		    const descargaDetectada = await esperarDescarga(page);
		    if (descargaDetectada) {
		      console.log('La descarga fue detectada correctamente.');
		      break;
		    }
		  } catch (error) {
		    console.log(error.message);
		  }
	}
  console.log("archivo descargado")
	await leerArchivo(ubicacion_archivos+id+"/reporteGeneral.csv",id,fecha)
  console.log("lectura del csv completada")
	await actualizarEPS(id);
	await actualizarEPSxAlias(id);
	await actualizarTarea(id);
  await deshabilitar(id)
	console.log("fin");
	/*
UPDATE agendamientos_citas ac
SET bot_id = c.eps_id
FROM contratos c
WHERE c.codigo_contrato = ac.p_contrato;
	*/
}

async function deshabilitar(id) {
  let client;
  try {
    client = await pool.connect(); // Obtiene el cliente del pool

    // Iniciar la transacción
    await client.query('BEGIN');

    // Nueva EPS
    const sqlUpdateNE = `
        UPDATE agendamientos_citas c
        SET estado = 4, respuesta_estado = 'No existe tipo identificacion'
        FROM datos_profamilia d
        WHERE d.codigo_identificacion = c.p_tipo_documento
        AND eps_id = 8
        AND d.descripcion_nueva_eps IS NULL
        AND c.trabajo_id = $1;
    `;
    await client.query(sqlUpdateNE, [id]);

    // Famisanar
    const sqlUpdateFS = `
        UPDATE agendamientos_citas c
        SET estado = 4, respuesta_estado = 'No existe tipo identificacion'
        FROM datos_profamilia d
        WHERE d.codigo_identificacion = c.p_tipo_documento
        AND eps_id = 5
        AND d.descripcion_famisanar IS NULL
        AND c.trabajo_id = $1;
    `;
    await client.query(sqlUpdateFS, [id]);

    // Asmet Salud
    const sqlUpdateAS = `
        UPDATE agendamientos_citas c
        SET estado = 4, respuesta_estado = 'No existe tipo identificacion'
        FROM datos_profamilia d
        WHERE d.codigo_identificacion = c.p_tipo_documento
        AND eps_id = 6
        AND d.descripcion_asmet_salud IS NULL
        AND c.trabajo_id = $1;
    `;
    await client.query(sqlUpdateAS, [id]);

    // Sura
    const sqlUpdateSU = `
        UPDATE agendamientos_citas c
        SET estado = 4, respuesta_estado = 'No existe tipo identificacion'
        FROM datos_profamilia d
        WHERE d.codigo_identificacion = c.p_tipo_documento
        AND eps_id = 7
        AND d.descripcion_sura IS NULL
        AND c.trabajo_id = $1;
    `;
    await client.query(sqlUpdateSU, [id]);

    // Salud Total
    const sqlUpdateST = `
        UPDATE agendamientos_citas c
        SET estado = 4, respuesta_estado = 'No existe tipo identificacion'
        FROM datos_profamilia d
        WHERE d.codigo_identificacion = c.p_tipo_documento
        AND eps_id = 9
        AND d.descripcion_salud_total IS NULL
        AND c.trabajo_id = $1;
    `;
    await client.query(sqlUpdateST, [id]);

    // Confirmar la transacción
    await client.query('COMMIT');
  } catch (error) {
    // Si algo falla, deshacer la transacción
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error al finalizar la transacción:', error);
  } finally {
    // Asegurarse de liberar el cliente
    if (client) {
      client.release();
    }
  }
}


async function actualizarEPSxAlias(id) {
  let client;
  try {
    client = await pool.connect(); // Obtiene el cliente del pool

    // Iniciar la transacción
    await client.query('BEGIN');

    // Actualizar la fila
    const sqlUpdate = `
      UPDATE agendamientos_citas a
      SET eps_id = n.eps_agendamiento_id 
      FROM nombres_eps_profamilia n
      WHERE a.p_eps = n.nombre_digitado
      AND n.eps_id != 0
      AND a.trabajo_id = $1
      AND a.p_numero_documento != '-100'
      AND a.eps_id = 0
    `;

    await client.query(sqlUpdate, [id]);

    // Confirmar la transacción
    await client.query('COMMIT');
  } catch (error) {
    // Si algo falla, deshacer la transacción
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error al finalizar la transacción:', error);
  } finally {
    // Asegurarse de liberar el cliente
    if (client) {
      client.release();
    }
  }
}

async function actualizarEPS(id) {
  let client;
  try {
    client = await pool.connect(); // Obtiene el cliente del pool

    // Iniciar la transacción
    await client.query('BEGIN');

    // Actualizar la fila
    const sqlUpdate = `
			UPDATE agendamientos_citas ac
			SET eps_id = c.eps_agendamiento_id
			FROM contratos c
			WHERE c.codigo_contrato = ac.p_contrato
            AND ac.p_numero_documento != '-100'
			AND ac.trabajo_id=$1;
    `;

    await client.query(sqlUpdate, [id]);

    // Confirmar la transacción
    await client.query('COMMIT');
  } catch (error) {
    // Si algo falla, deshacer la transacción
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error al finalizar la transacción:', error);
  } finally {
    // Asegurarse de liberar el cliente
    if (client) {
      client.release();
    }
  }
}

async function actualizarTarea(id) {
  let client;
  try {
    client = await pool.connect(); // Obtiene el cliente del pool

    // Iniciar la transacción
    await client.query('BEGIN');

    // Insertar en agendamientos
    const sqlInsert = `
        INSERT INTO agendamientos(fecha_agendamiento, eps_id, trabajo_id, cantidad)
        SELECT fecha_consulta, eps_id, trabajo_id, COUNT(1)
        FROM agendamientos_citas
        WHERE eps_id != 0 
        AND trabajo_id = $1
        GROUP BY fecha_consulta, eps_id, trabajo_id
    `;

    await client.query(sqlInsert, [id]);

    // Actualizar el estado en trabajos
    const sqlUpdate = `
        UPDATE trabajos
        SET estado = 2
        WHERE id = $1
    `;
    await client.query(sqlUpdate, [id]);

    // Actualizar agendamiento_id en agendamientos_citas
    const sqlUpdate2 = `
      UPDATE agendamientos_citas c
      SET agendamiento_id = (
          SELECT id 
          FROM agendamientos a 
          WHERE c.trabajo_id = a.trabajo_id 
          AND c.eps_id = a.eps_id 
          LIMIT 1
      )
      WHERE trabajo_id = $1;
    `;
    await client.query(sqlUpdate2, [id]); // Corrección aquí para usar sqlUpdate2

    // Confirmar la transacción
    await client.query('COMMIT');

  } catch (error) {
    // Si algo falla, deshacer la transacción
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error al finalizar la transacción:', error);
  } finally {
    // Asegurarse de liberar el cliente
    if (client) {
      client.release();
    }
  }
}



async function leerArchivo(ruta, id, fecha) {
    let rowCount = 0;
    let batchSize = 100;  // Tamaño del lote
    let batch = [];       // Array para acumular filas

    await pipeline(
        fs.createReadStream(ruta),
        csv(),
        async function*(source) {
            for await (const row of source) {
                rowCount++;
                console.log("Insertando línea " + rowCount);
                
                // Acumular la fila en el lote
                batch.push([
                    id,
                    fecha,
                    row['Sede'],
                    row['Fecha Registro'],
                    row['Fecha agendamiento'],
                    row['Hora agendamiento'],
                    row['Primer nombre'],
                    row['Segundo nombre'],
                    row['Primer apellido'],
                    row['Segundo apellido'],
                    row['Tipo documento'],
                    row['Número documento'],
                    row['Celular'],
                    row['Edad'],
                    row['EPS'],
                    row['Estado'],
                    row['Contrato'],
                    row['# Cita']
                ]);

                // Si el lote alcanza el tamaño especificado, insertar en la base de datos
                if (batch.length >= batchSize) {
                    await insertarLoteAgendamiento(batch);
                    console.log(`Insertado lote de ${batch.length} filas`);
                    batch = []; // Vaciar el lote
                }
            }

            // Insertar cualquier fila restante que no haya alcanzado el tamaño del lote
            if (batch.length > 0) {
                await insertarLoteAgendamiento(batch);
                console.log(`Insertado último lote de ${batch.length} filas`);
            }
        }
    );

    console.log(`Total de filas procesadas: ${rowCount}`);
    console.log('Todas las filas han sido procesadas.');
}

async function insertarLoteAgendamiento(batch) {
    let client;
    try {
        // Obtener una conexión del pool
        client = await pool.connect();

        // Iniciar la transacción
        await client.query('BEGIN');

        // SQL para insertar múltiples filas
        const values = batch.map((row, index) => 
            `(${row.map((_, i) => `$${index * row.length + i + 1}`).join(', ')})`
        ).join(', ');

        const sqlInsert = `
            INSERT INTO agendamientos_citas (
                trabajo_id, fecha_consulta, p_sede, p_fecha_registro, p_fecha_agendamiento, p_hora_agendamiento,
                p_primer_nombre, p_segundo_nombre, p_primer_apellido, p_segundo_apellido, 
                p_tipo_documento, p_numero_documento, p_celular, p_edad, p_eps, p_estado, p_contrato, p_num_cita
            )
            VALUES ${values}
            ON CONFLICT (fecha_consulta, p_tipo_documento, p_numero_documento) DO NOTHING;
        `;

        // Aplanar el array de batch para obtener todos los valores
        const flatBatch = batch.flat();

        // Ejecutar la consulta de inserción
        await client.query(sqlInsert, flatBatch);

        // Confirmar la transacción
        await client.query('COMMIT');

    } catch (error) {
        console.error('Error al insertar el lote:', error);
        try {
            // Hacer rollback en caso de error
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('Error al hacer rollback:', rollbackError);
        }
        throw error;
    } finally {
        if (client) {
            try {
                client.release(); // Liberar la conexión
            } catch (releaseError) {
                console.error('Error al liberar la conexión:', releaseError);
            }
        }
    }
}



function esperarDescarga(page) {
  return new Promise((resolve, reject) => {
    page.on('response', async (response) => {
      const url = response.url();
      const headers = response.headers();

//      console.log(url);
//      console.log(headers);

      // Verificar si el encabezado 'content-disposition' sugiere una descarga de archivo
      if (headers['content-disposition'] && headers['content-disposition'].includes('attachment')) {
        //console.log(`Descarga detectada: ${url}`);
        resolve(true); // Resolver la promesa cuando se detecta la descarga
      }
    });

    // Puedes agregar un timeout para evitar esperar indefinidamente si no se detecta ninguna descarga
    setTimeout(() => {
      reject(new Error('No se detectó ninguna descarga en el tiempo esperado.'));
    }, 60000); // Timeout de 30 segundos (puedes ajustar este valor)
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}	

async function cambiarCarpeta(client,ubicacion) {
    try {
        await fsPromises.mkdir(ubicacion, { recursive: true });
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: ubicacion, // Ruta a tu carpeta personalizada
        });            
    } catch (error) {
        console.error('Error al cambiar la ruta de descarga:', error);
    }
}

main();