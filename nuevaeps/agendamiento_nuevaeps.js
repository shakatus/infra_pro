const puppeteer = require('puppeteer');
const getID = require('./iplocal');
const pool = require('./dbConnection');
const fs = require('fs');
const fse = require('fs-extra');
const { exec } = require('child_process');
const path = require('path');
const { obtenerCredenciales } = require('./credenciales');
const { getSiteId, getDriveId, uploadFileToSharePoint, addItemToList } = require('./sharepointClient');
const config = require('/home/devbots/supervisor/.env/config');

const redVPC = "10.20.30.0";
const eps_id = "2";
const bot_id = "8";
const eps = "NuevaEPS"
let id_bot = isNaN(parseInt(process.argv[2])) ? 1 : parseInt(process.argv[2]);
let identificador = "";

let browser = null;
let page = null;
let DOC_LOGIN = "";
let PW_LOGIN = "";
let driveId = null;
let listId = "";

const URL_LOGIN    =    "https://portal.nuevaeps.com.co/Portal/home.jspx";

const SELECT_SUCURSAL = "#j_id114\\:sucIps";

const BOTON_CAMBIO_SUCURSAL = "#j_id114\\:acceptButton";

const LINK_SERVICIOS_EN_LINEA = "#j_id81";
const LINK_IPS = "#j_id69 > table > tbody > tr:nth-child(2) > td > a";
const SELECT_IPS = "#j_id114\\:ips";
let siteId =  null;


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

async function main()
{
	identificador = await getID(redVPC,bot_id,id_bot);
	console.log(identificador);
  tmpProfilePath = `/tmp/${id_bot}`;
  tmpProfilePathChrome = `/tmp/${id_bot}/chrome-profile-${process.pid}`;
	await credenciales();
  siteId = await getSiteId();
  driveId = await getDriveId(siteId);
	await inicarNavegador();
	while(true)
	//if(1==1)
	{		
		let datos = await obtenerDatos();
		if(datos)
		{
			const [dia, mes, año] = String(datos.fecha_agendamiento).split('/');
			const fechaFormateada = `${año}/${mes}/${dia}`;
      const filePath = `/home/devbots/Downloads/Validacion Derechos/${fechaFormateada}/${datos.p_sede}`;
			const fileName = `${datos.p_tipo_documento}_${String(datos.p_numero_documento)}.png`;
      datos.fileName = fileName
      datos.rutaSharePoint = `Validacion Derechos/${fechaFormateada}/${datos.p_sede}`
			datos.screenshot = `${filePath}/${fileName}`; 
			datos.filePath= filePath;
			await crearCarpeta(filePath);
			await iniciarSession();
			await buscarUsuario(datos);
		}
		await delay(500);
	}
}

async function credenciales()
{
  const datos = await obtenerCredenciales(1, eps_id); 
  DOC_LOGIN = datos.find(dato => dato.etiqueta === 'usuario').valor_descifrado;
  PW_LOGIN = datos.find(dato => dato.etiqueta === 'password').valor_descifrado;
  listId = datos.find(dato => dato.etiqueta === 'SHARE_LIST_VALIDACION_GUID').valor_descifrado;
}

async function inicarNavegador()
{
  await fse.copy('/home/devbots/.config/google-chrome/Profile1', tmpProfilePathChrome);
	try
	{
		browser = await puppeteer.launch({
		    headless: false, // Show the Chrome browser window
        userDataDir: tmpProfilePathChrome,
		    executablePath: '/usr/bin/google-chrome',
        //executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
		    args: [
		        '--window-size=400,300', // Set Chrome window size to 400x300
		        '--no-sandbox'//, // Disable sandbox for compatibility (use with caution)
		        //'--display=:0' // Show Chrome on the default X11 display (if using VNC)
		    ],
		    handleSIGINT: false // Prevent termination on Ctrl+C (if desired)
		});

		page = await browser.newPage(); 
		/*
		page.on('dialog', async dialog => {
			console.log('Diálogo detectado:', dialog.message());
			await dialog.accept(); // Aceptar automáticamente el diálogo
		});

		browser.on('targetcreated', async (target) => {
		    const newPage = await target.page();

		    // Si hay una nueva pestaña (popup), ciérrala
		    if (newPage) {
		      console.log('Popup detectado. Cerrando...');
		      await newPage.close();
		    }
		  });
		*/
		await page.goto("https://www.google.com.co/", { waitUntil: "networkidle0" });
		
		await page.goto(URL_LOGIN, { waitUntil: "networkidle0" });
		const client = await page.target().createCDPSession();
	} catch (err) {
		console.error('Error launching Puppeteer browser:', err);
	}
}

async function iniciarSession() {
    const url = page.url();
    console.log(url);
    if(!url.includes("home.jspx"))
    {
        return;
    }
    while(true){
        await page.select('#loginForm\\:tipoId', '3');
        const selectValue = await page.$eval('#loginForm\\:tipoId', select => select.value);
        if (selectValue === '3') {          
            break;
        } 
    }
    while(true)
    {
        await page.$eval('#loginForm\\:id', (input, value) => input.value = value, DOC_LOGIN);
        // Verificar que el valor del input sea "10"
        const inputValue = await page.$eval('#loginForm\\:id', input => input.value);
        if (inputValue === DOC_LOGIN) {          
            break;
        } 
    }

    while(true)
    {
        await page.$eval('#loginForm\\:clave', (input, value) => input.value = value, PW_LOGIN);
        // Verificar que el valor del input sea "10"
        const inputValue = await page.$eval('#loginForm\\:clave', input => input.value);
        if (inputValue === PW_LOGIN) {          
            break;
        } 
    }
    await page.click('#loginForm\\:loginButton');

    const selectors = {
        'selector1': {
          promise: page.waitForSelector(LINK_SERVICIOS_EN_LINEA, {timeout: 50000}).then(() => 'selector1'),
          id: 'selector1'
        },
        'selector2': {
          promise: page.waitForSelector('#publico > table > tbody > tr:nth-child(2) > td > div:nth-child(1) > span', {timeout: 50000}).then(() => 'selector2'),
          id: 'selector2'
        }
      };

      const firstFound = await Promise.race(Object.values(selectors).map(selector => selector.promise));

      // Determine which selector was found first
      const foundSelectorId = Object.keys(selectors).find(key => selectors[key].id === firstFound);

      // Realiza acciones específicas basadas en el selector encontrado
      if (foundSelectorId === 'selector1') {
        console.log('inicio de session correcto');
        await complementarLogin();
        return;
        // Realiza operaciones específicas para selector1
      } else if (foundSelectorId === 'selector2') {
        const spanContent = await page.evaluate(() => {
          return document.querySelector('#publico > table > tbody > tr:nth-child(2) > td > div:nth-child(1) > span').textContent;
        });
        console.log('error '+spanContent);
        try{
          await page.goto(URL_LOGIN, { waitUntil: 'load', timeout: 50000 });

        }catch(err){
          console.log(err)
        }                   

      }

      await complementarLogin();

}

function convertirFechaDDMMYYYYaISO(fechaOriginal) {
    // Dividir la fecha en día, mes y año
    var partesFecha = fechaOriginal.split("/"); // ["04", "10", "2024"]
    
    // Crear una nueva instancia de fecha (restando 1 al mes porque JavaScript usa meses indexados desde 0)
    var fechaISO = new Date(partesFecha[2], partesFecha[1] - 1, partesFecha[0]);

    // Obtener día, mes y año de la fecha
    var dia = String(fechaISO.getDate()).padStart(2, '0');
    var mes = String(fechaISO.getMonth() + 1).padStart(2, '0'); // Los meses en JavaScript son indexados desde 0
    var anio = fechaISO.getFullYear();

    // Devolver la fecha en el formato "DD/MM/YYYY"
    return String(`${anio}-${mes}-${dia}`);
}

async function agregar_item_lista(resultado, estado, datos){
  //console.log("https://profamiliaorg.sharepoint.com/:i:/r/sites/NacionalCuentasMedicas/Archivos/"+datos.rutaSharePoint+"/"+datos.fileName)
  const itemFields = {
    "Title":"",
    "Documento": String(datos.p_numero_documento),
    "Estado": estado,
    "Resultado": resultado,
    "Sede": datos.p_sede,
    "Fecha": convertirFechaDDMMYYYYaISO(datos.fecha_consulta),
    "TipoDocumento1": datos.p_texto_tipo_documento,
    "Imagen": "https://profamiliaorg.sharepoint.com/:i:/r/sites/NacionalCuentasMedicas/Archivos/"+datos.rutaSharePoint+"/"+datos.fileName
  };
  console.log(itemFields);
  try {
    await addItemToList(itemFields, siteId, listId); // Llama a la función para agregar el elemento
    console.log("Elemento agregado a la lista con éxito.");
  } catch (error) {
    console.error("Error al agregar el elemento a la lista:", error);
  }
}

async function finalizar(id, resultado, estado, datos) {
  await agregar_item_lista(resultado, estado, datos)
  try {
    // La consulta con placeholders de PostgreSQL ($1, $2, $3)
    const sql = `
            UPDATE agendamientos_citas 
            SET estado = $1, 
                    respuesta_estado = $2, 
                    fecha_fin_ejecucion = CURRENT_TIMESTAMP 
            WHERE id = $3`;
    
    console.log('Consulta SQL:', sql);
    console.log('Valores:', [estado, resultado, id]);

    // Ejecutar la consulta usando el pool (no es necesario obtener y liberar la conexión)
    const result = await pool.query(sql, [estado, resultado, id]);

    console.log(result);
    return result;
    
  } catch (error) {
    console.error('Error al actualizar el estado:', error);
    throw error; // Re-lanza el error para que pueda ser manejado por el llamador
  }
} 

async function cargar_prueba(datos){
  await page.screenshot({ path: String(datos.screenshot), fullPage: true });
  await uploadFileToSharePoint(driveId, datos.rutaSharePoint, datos.screenshot);
}

async function complementarLogin() {
  await page.waitForSelector(LINK_SERVICIOS_EN_LINEA);
  console.log("tier 1")
  while(true){
    await page.click(LINK_SERVICIOS_EN_LINEA);
    try{
      await page.waitForSelector(LINK_IPS);
      break;
    }catch(err){
      console.log(err)
    }
    await delay(500);
  }
  await delay(500);
  console.log("tier 2")
  while(true)
  {
    await page.click(LINK_IPS);
    try{
      await page.waitForSelector(SELECT_IPS);
      break;
    }catch(err){
      console.log(err)
    }
    await delay(500);
  }

  console.log("llegamos")
  await seleccionarSede();
}

async function seleccionarSede()
{
  while(true){
      await page.select(SELECT_IPS, '4;860013779;3733');//acaError
      const selectValue = await page.$eval(SELECT_IPS, select => select.value);
      if (selectValue === '4;860013779;3733') {          
          break;
      } 
  }

  while(true){
      await page.select(SELECT_SUCURSAL, "4;860013779;6574;860013779;7");
      const selectValue = await page.$eval(SELECT_SUCURSAL, select => select.value);
      if (selectValue === "4;860013779;6574;860013779;7") {          
          break;
      } 
  }
  console.log("click en cambio de sucursal");
  await page.click(BOTON_CAMBIO_SUCURSAL);
  try{
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
  }catch(err){}
  //await page.goto("https://portal.nuevaeps.com.co/Portal/pages/ips/autorizaciones/consultarEstadoAfiliacion.jspx");
  await page.waitForSelector("#j_id72 > table > tbody > tr:nth-child(1) > td > div");
  while(true){    
    await page.click("#j_id72 > table > tbody > tr:nth-child(1) > td > div");
    const displayStatus = await page.$eval('#option1161', element => {
        const style = window.getComputedStyle(element);
        return style.display; // Esto devolverá el valor de display, por ejemplo "none" o "block"
    });
    console.log(displayStatus);
    if(displayStatus == "block"){
      break;
    }
  }
  await delay(500);
  await page.click("#option1161 > table > tbody > tr:nth-child(1) > td:nth-child(2) > p > a");
}

async function buscarUsuario(datos) {
  // Espera a que el iframe esté disponible
  await page.waitForSelector('#tabla_contenido_panel > tbody > tr:nth-child(2) > td > iframe');
  const elementHandle = await page.$('#tabla_contenido_panel > tbody > tr:nth-child(2) > td > iframe');

  // Accede al contenido del iframe
  const iframeContent = await elementHandle.contentFrame();

  // Espera que el select esté disponible dentro del iframe
  await iframeContent.waitForSelector("#appForm\\:solTipdoc");
  console.log("Seleccionar tipo de documento");
  console.log(datos.descripcion_nueva_eps)
  await iframeContent.select("#appForm\\:solTipdoc", String(datos.descripcion_nueva_eps));

  while(true)
  {
      await iframeContent.$eval('#appForm\\:itNumdoc', (input, value) => input.value = value, String(datos.p_numero_documento));
      // Verificar que el valor del input sea "10"
      const inputValue = await iframeContent.$eval('#appForm\\:itNumdoc', input => input.value);
      if (inputValue === String(datos.p_numero_documento)) {          
          break;
      } 
  }
  await iframeContent.waitForSelector("#appForm\\:j_id53 > table > tbody > tr:nth-child(3) > td > input:nth-child(2)");
  await iframeContent.$eval("#appForm\\:j_id53 > table > tbody > tr:nth-child(3) > td > input:nth-child(2)", element => element.click());
  try{
    await iframeContent.waitForSelector("#appForm\\:msg > li > span");
    const contenido = await iframeContent.$eval('#appForm\\:msg > li > span', (element) => element.textContent);
    console.log("contenido");
    console.log(contenido);
    if (contenido.toLowerCase().includes("afiliado no existe".toLowerCase())) {
      await cargar_prueba(datos);
      await finalizar(datos.id, contenido, 3, datos);
      await page.reload();
      return;
    }
  }catch(err)
  {
    console.log(err);
  }


  await delay(1000);
  //#appForm > table
  //#appForm\:j_id79 > table
  const estadoAfiliacion = await iframeContent.evaluate(() => {
    // Seleccionar todas las filas del tbody
    const rows = document.querySelectorAll('#appForm\\:j_id79 > table > tbody > tr');
    
    // Recorrer las filas
    for (let row of rows) {
      const label = row.querySelector('td:first-child label'); // Obtener el label del primer td
      
      // Verificar que el label exista antes de acceder a innerText
      if (label && label.innerText) {
        console.log(label.innerText);
        if (label.innerText.includes('Estado Afiliación Usuario:')) {
          // Si se encuentra el label con el texto, obtener el valor del input del segundo td
          const input = row.querySelector('td:nth-child(2) input');
          return input ? input.value : null;
        }
      }
    }
    return null; // Devolver null si no se encuentra el título
  });
  

  console.log('Estado Afiliación Usuario:', estadoAfiliacion);
  await cargar_prueba(datos);
  if(estadoAfiliacion.includes("ACTIVO"))
  {
    await finalizar(datos.id, estadoAfiliacion, 1, datos)
  }else{
    await finalizar(datos.id, estadoAfiliacion, 2, datos)
  } 

  await iframeContent.$eval("#appForm\\:j_id175", element => element.click());

/*
#appForm\:j_id175
#tabla_contenido_panel > tbody > tr:nth-child(2) > td > iframe
#appForm\:j_id175

  const iframeElementHandle = await page.waitForSelector('#history-frame\\:xE2CZDKLZ3EjfCC-dDU6uA\\:8');

  const iframe = await iframeElementHandle.contentFrame();  // Accede al contenido del iframe

  const estadoAfiliacion = await iframe.evaluate(() => {
    // Seleccionar todas las filas del tbody
    const rows = document.querySelectorAll('#appForm\\:j_id79 > table > tbody > tr');
    
    // Recorrer las filas
    for (let row of rows) {
      const label = row.querySelector('td:first-child label'); // Obtener el label del primer td
      if (label && label.innerText.includes('Estado Afiliación Usuario:')) {
        // Si se encuentra el label con el texto, obtener el valor del input del segundo td
        const input = row.querySelector('td:nth-child(2) input');
        return input ? input.value : null;
      }
    }
    return null; // Devolver null si no se encuentra el título
  });

  console.log('Estado Afiliación Usuario:', estadoAfiliacion);

*/
  
  
}

async function delay(tiempo) {
  return new Promise(resolve => setTimeout(resolve, tiempo));
}

function waitForResponseBody(page, timeout = 5000) {
  return new Promise((resolve, reject) => {
      let timeoutId = setTimeout(() => {
      reject(new Error('Timeout: no se recibió respuesta dentro del tiempo especificado.'));
      }, timeout);

      page.on('response', async response => {
      try {
          const url = response.url();
          console.log(url);
         // if(url.includes("autorizaciones1/block/send-receive-updates")){
        //    console.log("entramos");
            const body = await response.text();
            console.log(body);
            clearTimeout(timeoutId); // Si se recibe la respuesta, cancela el timeout
            resolve(body); // Resuelve la promesa con el body de la respuesta
         // }
      } catch (error) {
          clearTimeout(timeoutId); // Cancela el timeout en caso de error, pero no rechaza
          //reject(error); // Rechaza en caso de error al obtener el body
      }
      });
  });
}

async function obtenerDatos()
{
	while(true)
	{
		let cita =await pedirAtencion();
		if(cita){
      console.log(cita);
			return cita;
		}else{
      console.log("sin datos")
    }
		await delay(1000);
	}
}

async function pedirAtencion() {
    let client;

    try {
        // Obtener una conexión del pool
        client = await pool.connect();

        // Iniciar la transacción
        await client.query('BEGIN');

        // Seleccionar y bloquear la fila con FOR UPDATE
        const sqlSelect = `
            SELECT c.*, a.fecha_agendamiento, 
              (select descripcion_nueva_eps from datos_profamilia where codigo_identificacion=c.p_tipo_documento) descripcion_nueva_eps
              ,(select descripcion from datos_profamilia WHERE codigo_identificacion=c.p_tipo_documento limit 1) p_texto_tipo_documento
            FROM agendamientos_citas c
            JOIN agendamientos a on a.id = c.agendamiento_id
            WHERE c.p_numero_documento != '-100' 
            AND c.eps_id = $1 
            AND c.ebot_id in (0,$2) 
            AND c.estado = 0
            ORDER BY updated_at
            LIMIT 1
            FOR UPDATE;
        `;
        const selectResult = await client.query(sqlSelect, [bot_id,identificador]);

        if (selectResult.rows.length === 0) {
            // Si no hay filas, simplemente hacemos COMMIT para finalizar la transacción
            await client.query('COMMIT');
            return null;
        }

        const idAtencion = selectResult.rows[0].id;

        // Actualizar la tarea seleccionada
        const sqlUpdate = `
            UPDATE agendamientos_citas
            SET ebot_id = CASE WHEN id = $2 THEN $1 ELSE 0 END, 
                fecha_inicio_ejecucion = CASE WHEN id = $2 THEN CURRENT_TIMESTAMP ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP,
                linode_id = '${config.LINODE_ID}'
            WHERE (ebot_id = $1 OR id = $2)
            AND estado IN (0, 2);
        `;
        await client.query(sqlUpdate, [identificador, idAtencion]);

        // Confirmar la transacción (libera los bloqueos)
        await client.query('COMMIT');

        // Retornar el resultado de la selección
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

async function waitForAllSelector(page, selectors) {
  const waitForSelectors = selectors.map(selector => 
    page.waitForSelector(selector, { timeout: 10000 }).then(() => ({ selector, found: true })).catch(() => ({ selector, found: false }))
  );
  
  const results = await Promise.allSettled(waitForSelectors);

  // Extraemos los selectores que no fueron encontrados
  const notPresentSelectors = results
    .filter(result => result.value && !result.value.found)
    .map(result => result.value.selector);

  return notPresentSelectors;
}

async function crearCarpeta(filePath)
{
	console.log(filePath)
	try {
	  fs.mkdirSync(filePath, { recursive: true });
	} catch (err) {
	  console.error('Error al crear la carpeta:', err);
	}
}

async function obtenerTextoSeleccionado(page, selector) 
{
  // Esperar a que el select esté listo
  await page.waitForSelector(selector);

  // Obtener el texto de la opción seleccionada
  const textoSeleccionado = await page.$eval(selector, select => {
    const option = select.options[select.selectedIndex];
    return option.textContent.trim(); // Obtener el texto de la opción seleccionada
  });

  return textoSeleccionado;
}



main();