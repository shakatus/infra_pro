const getIP = require('./iplocal');
const pool = require('./dbConnection');
const puppeteer = require('puppeteer');
const fs = require('fs');
const fsPromises = require('fs').promises;
const yauzl = require('yauzl');
const AdmZip = require('adm-zip');
const { exec } = require('child_process');
const path = require('path');
const { readDirectories } = require("./renombrar.js")
const { leerArchivoPorLineas } = require("./cargar_listado.js")
const { obtenerCredenciales } = require('./credenciales');
const config = require('/home/devbots/supervisor/.env/config');


let USER = "";
let PASS = "";

const interval = 1000;
const ubicacion_archivos = "/home/devbots/archivo/";

const redVPC = "10.20.30.0";
const idBOT = "4";
const idWork = "1";
let nameBOT = "";

let eps;
let eps_id;
let contrato;
let fechainicial;
let fechafinal;
let ruta;
let ubicacion;
let contrato_nombre;
let nombre_archivo_zip;
let baseDirectory;
let archivoListado;
let nombrearchivo;
let id;
let ruta_share
let idTrabajo = 0;


let browser = null;


/////////////////////////////////////////////////////////////////////limpiar/////////////////////////////////////////////////////////////////////////////////
let tmpProfilePath="";
let tmpProfilePathChrome="";
const cleanUp = () => {
  
  try{
    browser.close();    
  }catch(err){
    console.log(err);
  }     
};
// Registrar manejadores para diferentes señales del sistema
process.on('SIGINT', async () => {
  console.log("sigint");
  await cleanUp();
  process.exit(0);
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
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function credenciales(){
  const datos = await obtenerCredenciales(1, idBOT);
  USER = datos.find(dato => dato.etiqueta === 'PROFAMILIA_USER').valor_descifrado;
  PASS = datos.find(dato => dato.etiqueta === 'PROFAMILIA_PASW').valor_descifrado;
  console.log("obtenemos usuario ")
}

async function main() {
  const linode_id = config.LINODE_ID;
	nameBOT = await getIP(redVPC,idBOT,idWork)
	console.log("El id de este "+nameBOT)
  const pid = process.pid;
  // Mostrar el PID en la consola
  console.log(`El PID del proceso es: ${pid}`)
  await credenciales();
	while (true) {
		try {
		  const resultado = await obtenerTrabajo(nameBOT);
      console.log(resultado);
		  if (resultado) {
		    console.log(resultado); 
		    await setearDatos(resultado.eps_id, resultado.eps, resultado.contrato, resultado.fecha, resultado.id, resultado.ruta);
		  }else{
        //await liberar_bot(linode_id);
        await delay(5000); 
      }
		} catch (error) {
		  console.error('Error en loop:', error);
		}
		// Esperar 1 minuto antes de repetir el ciclo (60000 ms = 1 minuto)
		
	}
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function liberar_bot(linode_id) {
  let client;
  try {
    client = await pool.connect(); // Obtiene el cliente del pool
    // Iniciar la transacción
    await client.query('BEGIN');

    // Ejecutar la función que actualiza y asigna
    const sqlUpdate = `SELECT actualizar_bot_y_asignar($1);`;
    await client.query(sqlUpdate, [linode_id]);

    // Confirmar la transacción
    await client.query('COMMIT');
  } catch (error) {
    // Si algo falla, deshacer la transacción
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error al hacer ROLLBACK:', rollbackError);
      }
    }
    console.error('Error al finalizar la transacción:', error);
    throw error; // Re-lanzar el error para que el caller pueda manejarlo
  } finally {
    // Asegurarse de liberar el cliente
    if (client) {
      client.release();
    }
  }
}

async function finalizarError(idTrabajo) {
  let client;
  try {
    client = await pool.connect(); // Obtiene el cliente del pool

    // Iniciar la transacción
    await client.query('BEGIN');

    // Actualizar la fila
    const sqlUpdate = `
      UPDATE folder
      SET estado = 0
      WHERE id = $1;
    `;
    console.log(sqlUpdate);
    console.log(idTrabajo);
    await client.query(sqlUpdate, [idTrabajo]);

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


async function obtenerTrabajo(nameBOT) {
    let client;

    try {
        // Obtener una conexión del pool
        client = await pool.connect();

        // Iniciar la transacción
        await client.query('BEGIN');

        // Seleccionar y bloquear la fila con FOR UPDATE
        const sqlSelect = `
            SELECT *
            FROM folder
            WHERE estado = 0
              AND ebot_id IN (0, $1)
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
            UPDATE folder
            SET ebot_id = CASE WHEN id = $2 THEN $1 ELSE 0 END,
            fecha_inicio_descarga = now()
            WHERE 
            (ebot_id = $1 OR id = $2)
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

async function setearDatos(_eps_id, _eps, _contrato, _fecha, _id, _ruta_share) {
  eps_id = _eps_id;
  eps = _eps;
  contrato = _contrato;
  fechainicial = _fecha;
  fechafinal = _fecha;
  id=_id;
  ruta_share = _ruta_share;
  
  // Descomponemos la fecha
  let [dia, mes, año] = fechainicial.split('/');

  // Construimos las rutas usando path.join para asegurarnos que funcionen bien en diferentes sistemas operativos
  ruta = path.join("Alistamiento", eps, año, mes, dia, contrato);
  ubicacion = "/home/devbots/Downloads/Alistamiento" + eps + "/";
  contrato_nombre = "Contrato_" + contrato;
  nombre_archivo_zip = contrato_nombre + ".zip";
  baseDirectory = path.join(ubicacion_archivos, ruta, contrato_nombre);
  archivoListado = path.join(ubicacion_archivos, ruta, "ListadoCarpetas.txt");
  nombrearchivo = ""; // Si tienes algún valor específico que quieras asignar, puedes hacerlo aquí

  await inciarDescarga();
}

async function inciarDescarga() {
  // Inicia el navegador
  
  browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
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
  await page.goto('http://10.0.1.119/historiasroot/acegilogin.jsf');

  await page.waitForSelector('#j_username');
  while(true)
  {
    await page.type('#j_username', USER);
    const suraname = await page.$eval('#j_username', element => element.value);
    if(suraname == USER)
    {
      break;
    }
  }

  while(true)
  {
    await page.type('#j_password', PASS);
    const password = await page.$eval('#j_password', element => element.value);
    if(password == PASS)
    {
      break;
    }
  }
  

  const [newPage] = await Promise.all([
    new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
    // Haz clic en el botón que abre el popup
    page.click('#loginForm\\:commandButton1')
  ]);


  await newPage.waitForSelector('#menu__id12_jsCookMenuBasic_menu > table > tbody > tr > td:nth-child(1) > span.ThemeTwoMainFolderText');


  while(true)
  {
    await newPage.hover("#menu__id12_jsCookMenuBasic_menu > table > tbody > tr > td:nth-child(1) > span.ThemeTwoMainFolderText");
    await newPage.click("#menu__id12_jsCookMenuBasic_menu > table > tbody > tr > td:nth-child(1) > span.ThemeTwoMainFolderText");
    await delay(500);
    newPage.click("#cmSubMenuID1 > table > tbody > tr:nth-child(3) > td.ThemeTwoMenuItemText");
    await delay(3000);
    const contenido = await newPage.evaluate(() => {
      const elemento = document.querySelector('#body\\:formSoportesFacturacion\\:infoUbication');
      return elemento ? elemento.textContent.trim() : null;
    });
    console.log(contenido)
    if(contenido)
    {      
      if(contenido.includes("Soportes Facturación Contrato"))
      {
        console.log("salimos")
        break;
      }
    }
  }

  await newPage.setRequestInterception(true);
  const cliente = await newPage.target().createCDPSession();
  await cambiarCarpeta(cliente,ubicacion);  

	const trackedRequests = new Map();

	newPage.on('request', request => {
	  console.log(request.url());
	  // Verificamos si la URL de la solicitud es la que estamos rastreando
	  for (let [urlSubstring, requestData] of trackedRequests.entries()) {
	    if (request.url().includes(urlSubstring)) {
	      // Guardamos la solicitud en el mapa y actualizamos el estado a 'pending'
	      trackedRequests.set(urlSubstring, { request, status: 'pending' });
	      console.log(`Tracking request: ${request.url()}`);
	    }
	  }
	  request.continue();
	});

	newPage.on('requestfinished', request => {
	  for (let [urlSubstring, requestData] of trackedRequests.entries()) {
	    if (request.url().includes(urlSubstring)) {
	      // Actualizamos el estado de la solicitud a 'finished'
	      trackedRequests.set(urlSubstring, { request, status: 'finished' });
	      console.log(`Request finished: ${request.url()}`);
	    }
	  }
	});

	newPage.on('requestfailed', request => {
	  for (let [urlSubstring, requestData] of trackedRequests.entries()) {
	    if (request.url().includes(urlSubstring)) {
	      // Actualizamos el estado de la solicitud a 'failed'
	      trackedRequests.set(urlSubstring, { request, status: 'failed' });
	      console.log(`Request failed: ${request.url()}`);
	    }
	  }
	});

	const trackRequest = (urlSubstring) => {
	  // Agregamos la URL al mapa manualmente con estado 'null'
	  trackedRequests.set(urlSubstring, { request: null, status: null });
	  console.log(`Added ${urlSubstring} to tracked requests with status null`);
	};

	const waitForRequestStatus = async (urlSubstring, timeout = 5000) => {
	  return new Promise((resolve, reject) => {
	    const timeoutId = setTimeout(() => {
	      const trackedRequest = trackedRequests.get(urlSubstring);
	      // Solo rechazamos si el estado sigue siendo null o no ha cambiado
	      if (trackedRequest && trackedRequest.status === null) {
	        trackedRequests.delete(urlSubstring);
	        reject(new Error(`Timeout waiting for request: ${urlSubstring}`));
	      }
	    }, timeout);

	    const interval = setInterval(() => {
	      const trackedRequest = trackedRequests.get(urlSubstring);

	      // Solo resolvemos la promesa si el estado es 'finished' o 'failed'
	      if (trackedRequest && (trackedRequest.status === 'finished' || trackedRequest.status === 'failed')) {
	        clearInterval(interval);
	        clearTimeout(timeoutId);
	        trackedRequests.delete(urlSubstring);
	        resolve(trackedRequest.status); // Devuelve solo 'finished' o 'failed'
	      }
	    }, 100); // Revisamos el estado cada 100 ms
	  });
	};

  const waitForDisplayChange = async (selector) => {
    let displayValue;

    // Bucle while para seguir verificando el estilo hasta que no sea "none"
    while (true) {
      displayValue = await newPage.evaluate((selector) => {
        const elemento = document.querySelector(selector);
        return window.getComputedStyle(elemento).display; // Obtiene el estilo display
      }, selector);

      //console.log(`Valor actual de display: ${displayValue}`);

      if (displayValue !== 'inline') {
        break; // Rompe el bucle si display ya no es "none"
      }

      // Espera medio segundo antes de volver a verificar
      await delay(500);
    }

    //console.log('El valor de display ya no es "none".');
  };

  
  console.log("colocamos el contrato")

  while(true)
  {
    await newPage.type('#body\\:formSoportesFacturacion\\:panelTabSoportesFacturacion\\:idUsuario', contrato);
    const input_contrato = await newPage.$eval('#body\\:formSoportesFacturacion\\:panelTabSoportesFacturacion\\:idUsuario', element => element.value);
    if(input_contrato == contrato)
    {
      break;
    }
  }

  await newPage.click('#body\\:formSoportesFacturacion\\:panelTabSoportesFacturacion\\:fechaInicial');

  //await waitForDisplayChange('#body\\:formSoportesFacturacion\\:regionSoportesFacturacion\\:status\\.start');

  await delay(1000);
  console.log("colocamos el fecha inicial")
  while(true)
  {
    await newPage.evaluate((fechainicial) => {
      const input = document.querySelector('#body\\:formSoportesFacturacion\\:panelTabSoportesFacturacion\\:fechaInicial');
      if (input) {
        input.value = fechainicial; // Asigna el valor pasado
      }
    }, fechainicial); // Aquí pasas la variable desde Node.js   
    const input_fechainicial = await newPage.$eval('#body\\:formSoportesFacturacion\\:panelTabSoportesFacturacion\\:fechaInicial', element => element.value);
    if(input_fechainicial == fechainicial)
    {
      break;
    }
  }

  console.log("colocamos el fecha final")
  while(true)
  {
    await newPage.evaluate((fechafinal) => {
      const input = document.querySelector('#body\\:formSoportesFacturacion\\:panelTabSoportesFacturacion\\:fechaFinal');
      if (input) {
        input.value = fechafinal; // Asigna el valor pasado
      }
    }, fechafinal); // Aquí pasas la variable desde Node.js
    const input_fechafinal = await newPage.$eval('#body\\:formSoportesFacturacion\\:panelTabSoportesFacturacion\\:fechaFinal', element => element.value);
    if(input_fechafinal == fechafinal)
    {
      break;
    }
  }

  trackRequest('/soportesFacturacion.jsf');
  await newPage.click('#body\\:formSoportesFacturacion\\:panelTabSoportesFacturacion\\:_id42');
  console.log("buscando...")
  //await waitForDisplayChange('#body\\:formSoportesFacturacion\\:regionSoportesFacturacion\\:status\\.start');
  try {
    const result = await waitForRequestStatus('/soportesFacturacion.jsf');
    console.log(`Request result: ${result}`);
  } catch (error) {
    console.error(error.message);
  }

  await delay(1000);
  await page.evaluate(() => {
    document.body.style.zoom = '0.6'; // 50% de zoom
  });
  
  try{
    const elementExists = await newPage.$('#body\\:formSoportesFacturacion\\:panelTabSoportesFacturacion\\:msgInfRepoFact > tbody > tr > td > span');
    if (elementExists) {
      // Obtener el contenido del elemento
      const elementContent = await newPage.evaluate(el => el.textContent, elementExists);
      console.log('El elemento existe y su contenido es:', elementContent);
      //await finalizarError(idTrabajo);
      console.log("salir");
      //browser.close();
      //return;
    } else {
      console.log('El elemento no existe.');
    }
  }catch(err){

  }

  console.log("descargando...");
  trackRequest("/"+nombre_archivo_zip);
 // const downloadPromise = waitForDownload(newPage);
  console.log("revisamos que exista el boton");
  try{
    await page.waitForSelector('#body\\:formSoportesFacturacion\\:panelTabSoportesFacturacion\\:panelGridSoportesFacturacion > tbody > tr:nth-child(4) > td > a');
    console.log("aparecio");
  }catch(err){
    console.log(err);
  }

  newPage.click('#body\\:formSoportesFacturacion\\:panelTabSoportesFacturacion\\:panelGridSoportesFacturacion > tbody > tr:nth-child(4) > td > a');
  try {
    const result = await waitForRequestStatus("/"+nombre_archivo_zip);
    console.log(`Request result: ${result}`);
  } catch (error) {
    console.error(error.message);
  }

  const respuesta = await checkZipFile(ubicacion+nombre_archivo_zip);
  browser.close();
  
  ensureDirectoryExistence(ubicacion_archivos+ruta);
  const zip = new AdmZip(ubicacion+nombre_archivo_zip);
  zip.extractAllTo(ubicacion_archivos+ruta, true);
  console.log("completado "+respuesta);
  
  //renombrar
  await readDirectories(baseDirectory, eps);
  console.log("fin de renombrar");
  
  //leer el archivo de listado tareas
  ///home/devbots/archivo/SURA/2024/septiembre/03/41003143/ListadoCarpetas.txt
  await leerArchivoPorLineas(archivoListado, eps, eps_id, baseDirectory.replace("home/devbots/archivo/",""), nombrearchivo, id);
  console.log(ubicacion+nombre_archivo_zip)
  await eliminarArchivoZip(ubicacion,nombre_archivo_zip);
  console.log("final")
  await actualizarFecha(id);
  
}

async function actualizarFecha(id) {
    let client;
    try {
        // Obtener una conexión del pool
        client = await pool.connect();

        // Actualizar la tarea seleccionada
        const sqlUpdate = `
            UPDATE folder
            SET fecha_fin_descarga = now()
            WHERE id = $1
            RETURNING *;
        `;
        const result = await client.query(sqlUpdate, [id]);

        // Retornar la fila actualizada
        return result.rows[0];

    } catch (error) {
        console.error('Error:', error);
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


async function cambiarCarpeta(client,ubicacion) {
    try {
        //await fsPromises.mkdir(nuevaruta, { recursive: true });
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: ubicacion, // Ruta a tu carpeta personalizada
        });            
    } catch (error) {
        console.error('Error al cambiar la ruta de descarga:', error);
    }
}

async function checkZipFile(filePath) {
  while (!fs.existsSync(filePath)) {
    console.log(`Esperando a que el archivo ${filePath} aparezca...`);
    await new Promise(resolve => setTimeout(resolve, interval)); // Espera antes de volver a intentar
  }

  console.log('El archivo ha sido encontrado. Verificando si es un archivo ZIP válido...');

  return new Promise((resolve, reject) => {
    function verifyFile() {
      fs.stat(filePath, (err, stats) => {
        if (err) {
          reject(new Error('Archivo no accesible: ' + err));
          return;
        }

        yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
          if (err) {
            console.log('Archivo ZIP aún no está completo o es inválido. Intentando de nuevo...');
            setTimeout(verifyFile, interval); // Reintentar después del intervalo
          } else {
            console.log('El archivo ZIP es válido y está completo');
            zipfile.close(); // Cerrar el archivo ZIP si es válido
            resolve(true); // Devolver true cuando el archivo esté listo
          }
        });
      });
    }

    verifyFile(); // Llamar a la función de verificación
  });
}

async function eliminarArchivoZip(ubicacion, nombre_archivo_zip) {
  try {
    const rutaArchivo = `${ubicacion}${nombre_archivo_zip}`;

    // Eliminar el archivo ZIP directamente usando fsPromises.unlink
    await fsPromises.unlink(rutaArchivo);
    console.log(`Archivo ZIP eliminado: ${rutaArchivo}`);
  } catch (error) {
    console.error(`Error al eliminar el archivo ZIP: ${error}`);
  }
}

function ensureDirectoryExistence(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

main()